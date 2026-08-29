"""Relationship Builder - Cross-file linking for Woodpacker learning materials.

Takes the 4 core files (Kursbuch, Übungsbuch, Audio, Lösungen), runs the
extraction pipeline on each, then builds cross-file relationships:
- Chapter matching (Lektion X across files)
- Exercise number matching (Aufgabe N across files)
- Audio linking (Hören Sie Track N → audio file)
- Solution matching (Lösung Seite X → solution file)

Output structure maps to the LessonMaterial / LessonMaterialFile / LessonMaterialLink
Prisma models for persistence.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .pipeline import run_pipeline
from .models import (
    MaterialClassification,
    ExerciseRef,
    ExerciseItem,
    ExtractedImageModel,
    LearningMaterialGraph,
)

logger = logging.getLogger(__name__)

# Core file type mapping
FILE_TYPE_MAP = {
    "kursbuch": ["kursbuch", "lehrbuch", "textbook", "lesson_book", "main"],
    "ubungsbuch": ["ubungsbuch", "übungsbuch", "workbook", "exercise_book", "exercises"],
    "audio": ["audio", "mp3", "wav", "m4a", "track", "cd"],
    "loesungen": ["loesung", "lösung", "solution", "answer", "key", "teacher"],
}

LESSON_PATTERNS = [
    re.compile(r"lektion\s*(\d+)", re.IGNORECASE),
    re.compile(r"lesson\s*(\d+)", re.IGNORECASE),
    re.compile(r"modul\s*(\d+)", re.IGNORECASE),
    re.compile(r"kapitel\s*(\d+)", re.IGNORECASE),
    re.compile(r"unit\s*(\d+)", re.IGNORECASE),
]

EXERCISE_NUM_PATTERNS = [
    re.compile(r"aufgabe\s*(\d+)", re.IGNORECASE),
    re.compile(r"exercise\s*(\d+)", re.IGNORECASE),
    re.compile(r"task\s*(\d+)", re.IGNORECASE),
    re.compile(r"aufg\.\s*(\d+)", re.IGNORECASE),
    re.compile(r"ex\.\s*(\d+)", re.IGNORECASE),
]

AUDIO_REF_PATTERNS = [
    re.compile(r"hören\s+sie\s+(?:track|spur|cd)?\s*(\d+)", re.IGNORECASE),
    re.compile(r"track\s*(\d+)", re.IGNORECASE),
    re.compile(r"cd\s*(\d+)\s*(?:track\s*(\d+))?", re.IGNORECASE),
    re.compile(r"audio\s*(\d+)", re.IGNORECASE),
]

SOLUTION_REF_PATTERNS = [
    re.compile(r"lösung\s+(?:seite|page)\s*(\d+)", re.IGNORECASE),
    re.compile(r"loesung\s+(?:seite|page)\s*(\d+)", re.IGNORECASE),
    re.compile(r"solution\s+(?:page|p\.)\s*(\d+)", re.IGNORECASE),
    re.compile(r"lehrerhandbuch", re.IGNORECASE),
    re.compile(r"answer\s+key", re.IGNORECASE),
]


@dataclass
class FileInput:
    """Input file specification for the relationship builder."""
    path: str
    file_type: str  # "kursbuch" | "ubungsbuch" | "audio" | "loesungen"
    original_filename: str
    user_id: str
    lesson_id: str
    object_key: str | None = None
    minio_bucket: str | None = None


@dataclass
class ProcessedFile:
    """Result of running the extraction pipeline on a single file."""
    file_type: str
    original_filename: str
    classification: MaterialClassification
    exercises: list[dict]
    items: list[dict]
    images: list[dict]
    audio_refs: list[dict]
    raw_text: str
    page_count: int
    word_count: int
    extraction_result: dict


def detect_file_type(filename: str) -> str | None:
    """Auto-detect file type from filename."""
    lower = filename.lower()
    for ftype, keywords in FILE_TYPE_MAP.items():
        if any(k in lower for k in keywords):
            return ftype
    return None


def extract_lesson_number(text: str) -> str | None:
    """Extract lesson/chapter number from text."""
    for pattern in LESSON_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(1)
    return None


def extract_exercise_number(text: str) -> str | None:
    """Extract exercise/aufgabe number from text."""
    for pattern in EXERCISE_NUM_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(1)
    return None


def extract_audio_references(text: str) -> list[int]:
    """Extract audio track numbers from text."""
    tracks = []
    for pattern in AUDIO_REF_PATTERNS:
        for match in pattern.finditer(text):
            if match.group(1):
                tracks.append(int(match.group(1)))
            elif len(match.groups()) > 1 and match.group(2):
                tracks.append(int(match.group(2)))
    return list(set(tracks))


def extract_solution_references(text: str) -> list[int]:
    """Extract solution page numbers from text."""
    pages = []
    for pattern in SOLUTION_REF_PATTERNS:
        for match in pattern.finditer(text):
            if match.group(1):
                pages.append(int(match.group(1)))
    return list(set(pages))


class RelationshipBuilder:
    """Builds cross-file relationships between learning materials."""

    def __init__(self, user_id: str, lesson_id: str, lesson_title: str = "Lesson"):
        self.user_id = user_id
        self.lesson_id = lesson_id
        self.lesson_title = lesson_title or f"Lesson {lesson_id}"
        self.processed_files: dict[str, ProcessedFile] = {}
        self.links: list[dict] = []

    def process_files(self, file_inputs: list[FileInput]) -> dict[str, Any]:
        """Process all input files through the pipeline and build relationships."""
        # Stage 1: Run extraction pipeline on each file
        for f in file_inputs:
            logger.info("Processing %s (%s)", f.original_filename, f.file_type)
            result = run_pipeline(f.path, f"{f.file_type}-{len(self.processed_files)}")
            self.processed_files[f.file_type] = ProcessedFile(
                file_type=f.file_type,
                original_filename=f.original_filename,
                classification=MaterialClassification(**result["classifications"][0]),
                exercises=result.get("exercises", []),
                items=result.get("questions", []),
                images=result.get("images", []),
                audio_refs=result.get("audio", []),
                raw_text=result.get("course", {}).get("raw_text", ""),
                page_count=result.get("page_count", 0),
                word_count=result.get("word_count", 0),
                extraction_result=result,
            )

        # Stage 2: Build cross-file relationships
        self._build_chapter_matches()
        self._build_exercise_number_matches()
        self._build_audio_links()
        self._build_solution_links()

        # Stage 3: Assemble output for database storage
        return self._assemble_output()

    def _build_chapter_matches(self) -> None:
        """Match chapters/lessons across files by lesson number."""
        lesson_by_file: dict[str, str] = {}
        for ftype, pf in self.processed_files.items():
            lesson_num = extract_lesson_number(pf.raw_text)
            if lesson_num:
                lesson_by_file[ftype] = lesson_num

        # Create chapter_match links between files sharing the same lesson number
        for ft1, num1 in lesson_by_file.items():
            for ft2, num2 in lesson_by_file.items():
                if ft1 >= ft2:
                    continue
                if num1 == num2:
                    self._add_link(
                        from_file=ft1,
                        to_file=ft2,
                        relationship_type="chapter_match",
                        confidence=0.95,
                        rationale=f"Both files contain Lektion {num1}",
                    )

    def _build_exercise_number_matches(self) -> None:
        """Match exercises by number (Aufgabe N) across files."""
        # Build exercise number -> exercise_id mapping per file
        ex_by_num: dict[str, dict[str, str]] = {}  # file_type -> {num: exercise_id}
        for ftype, pf in self.processed_files.items():
            ex_by_num[ftype] = {}
            for ex in pf.exercises:
                num = extract_exercise_number(ex.get("name", "") or ex.get("exercise_title", ""))
                if num:
                    ex_by_num[ftype][num] = ex["exercise_id"]

        # Match exercises with same number across files
        all_types = list(ex_by_num.keys())
        for i, ft1 in enumerate(all_types):
            for ft2 in all_types[i+1:]:
                for num, ex_id1 in ex_by_num[ft1].items():
                    if num in ex_by_num[ft2]:
                        ex_id2 = ex_by_num[ft2][num]
                        self._add_link(
                            from_exercise_id=ex_id1,
                            to_exercise_id=ex_id2,
                            relationship_type="exercise_number_match",
                            confidence=0.9,
                            rationale=f"Both files contain Aufgabe {num}",
                        )

    def _build_audio_links(self) -> None:
        """Link exercises referencing audio tracks to audio files."""
        # Get audio file info
        audio_file = self.processed_files.get("audio")
        if not audio_file:
            return

        # Find exercises that reference audio tracks
        for ftype, pf in self.processed_files.items():
            if ftype == "audio":
                continue
            for ex in pf.exercises:
                tracks = extract_audio_references(ex.get("prompt", "") + " " + ex.get("name", ""))
                if tracks:
                    for track in tracks:
                        self._add_link(
                            from_exercise_id=ex["exercise_id"],
                            to_exercise_id=f"audio-track-{track}",
                            relationship_type="audio_link",
                            confidence=0.95,
                            rationale=f"Exercise references Track {track} in audio file",
                        )

    def _build_solution_links(self) -> None:
        """Link exercises to solutions in the solution book."""
        solutions_file = self.processed_files.get("loesungen")
        if not solutions_file:
            return

        # Build solution page -> exercise_id mapping from solutions file
        sol_page_to_ex: dict[int, str] = {}
        for ex in solutions_file.exercises:
            pages = extract_solution_references(ex.get("prompt", "") + " " + ex.get("name", ""))
            for page in pages:
                sol_page_to_ex[page] = ex["exercise_id"]

        # Match exercises in other files to solutions
        for ftype, pf in self.processed_files.items():
            if ftype == "loesungen":
                continue
            for ex in pf.exercises:
                # Check if exercise references a solution page
                pages = extract_solution_references(ex.get("prompt", "") + " " + ex.get("name", ""))
                for page in pages:
                    if page in sol_page_to_ex:
                        self._add_link(
                            from_exercise_id=ex["exercise_id"],
                            to_exercise_id=sol_page_to_ex[page],
                            relationship_type="solution_link",
                            confidence=0.85,
                            rationale=f"Exercise references solution on page {page}",
                        )

    def _add_link(self, from_file: str | None = None, to_file: str | None = None,
                  from_exercise_id: str | None = None, to_exercise_id: str | None = None,
                  relationship_type: str = "chapter_match", confidence: float = 0.8,
                  rationale: str = "") -> None:
        """Add a relationship link."""
        if from_exercise_id and to_exercise_id:
            self.links.append({
                "from_exercise_id": from_exercise_id,
                "to_exercise_id": to_exercise_id,
                "relationship_type": relationship_type,
                "confidence": confidence,
                "rationale": rationale,
            })

    def _assemble_output(self) -> dict[str, Any]:
        """Assemble final output for database storage."""
        file_outputs = {}
        for ftype, pf in self.processed_files.items():
            file_outputs[ftype] = {
                "file_type": ftype,
                "original_filename": pf.original_filename,
                "classification": pf.classification.model_dump() if pf.classification else None,
                "exercises": pf.exercises,
                "items": pf.items,
                "images": pf.images,
                "audio_refs": pf.audio_refs,
                "page_count": pf.page_count,
                "word_count": pf.word_count,
            }

        return {
            "lesson_material": {
                "user_id": self.user_id,
                "lesson_id": self.lesson_id,
                "title": self.lesson_title,
                "language": "de",
                "status": "processed",
            },
            "files": file_outputs,
            "links": self.links,
        }


def build_relationships(
    file_inputs: list[FileInput],
    user_id: str,
    lesson_id: str,
    lesson_title: str = "Lesson",
) -> dict[str, Any]:
    """Convenience function to build relationships from file inputs."""
    builder = RelationshipBuilder(user_id, lesson_id, lesson_title)
    return builder.process_files(file_inputs)