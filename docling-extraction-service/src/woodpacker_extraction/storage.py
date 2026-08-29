"""Database storage service for lesson materials.

Persists the relationship builder output to the PostgreSQL database
using the generated Prisma client (prisma-client-py).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import logging

logger = logging.getLogger(__name__)

# Prisma is optional - only imported when needed
Prisma = None  # type: ignore


def _get_prisma_class():
    """Lazy import of Prisma client (generated package or installed runtime)."""
    global Prisma
    if Prisma is None:
        try:
            from generated import Prisma as PrismaClass  # type: ignore
        except ImportError:
            try:
                from prisma import Prisma as PrismaClass  # type: ignore
            except ImportError:
                raise RuntimeError(
                    "Prisma client not available. Run `prisma generate` (see prisma/schema.prisma)."
                )
        Prisma = PrismaClass
    return Prisma


def _now() -> datetime:
    return datetime.now(timezone.utc)


class LessonMaterialStorage:
    """Handles persistence of lesson materials and relationships to the database."""

    def __init__(self, prisma: Any | None = None):
        self._prisma = prisma
        self._owns_client = prisma is None

    async def connect(self) -> Any:
        """Get or create Prisma client connection."""
        PrismaClass = _get_prisma_class()
        if self._prisma is None:
            self._prisma = PrismaClass()
            await self._prisma.connect()
        return self._prisma

    async def disconnect(self) -> None:
        """Disconnect if we own the client."""
        if self._owns_client and self._prisma:
            await self._prisma.disconnect()
            self._prisma = None

    async def __aenter__(self) -> "LessonMaterialStorage":
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.disconnect()

    def _file_json_fields(self, fdata: dict[str, Any], include_optional: bool = False) -> dict[str, Any]:
        """Json columns for LessonMaterialFile, wrapped for the generated client.

        None values are omitted (the client rejects None for Json fields).
        """
        from generated import fields

        out: dict[str, Any] = {}
        for key in ("classification", "exercises", "items", "images", "audio_refs"):
            value = fdata.get(key) if include_optional else fdata.get(key, [])
            if value is not None:
                out[key] = fields.Json(value)
        for key in ("object_key", "minio_bucket"):
            value = fdata.get(key)
            if value is not None:
                out[key] = value
        return out

    async def store_lesson_material(
        self,
        user_id: str,
        lesson_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Store a complete lesson material with files and links."""
        prisma = await self.connect()

        lm = lesson_data["lesson_material"]
        now = _now()

        # Create or update lesson material
        lesson_material = await prisma.lessonmaterial.upsert(
            where={
                "user_id_lesson_id": {
                    "user_id": user_id,
                    "lesson_id": lm["lesson_id"],
                }
            },
            data={
                "create": {
                    "user_id": user_id,
                    "lesson_id": lm["lesson_id"],
                    "title": lm["title"],
                    "language": lm.get("language", "de"),
                    "status": lm.get("status", "processed"),
                },
                "update": {
                    "title": lm["title"],
                    "language": lm.get("language", "de"),
                    "status": lm.get("status", "processed"),
                    "updated_at": now,
                },
            },
        )

        # Store files
        file_records = {}
        for ftype, fdata in lesson_data.get("files", {}).items():
            file_record = await prisma.lessonmaterialfile.upsert(
                where={
                    "lesson_material_id_file_type": {
                        "lesson_material_id": lesson_material.id,
                        "file_type": fdata["file_type"],
                    }
                },
                data={
                    "create": {
                        "lesson_material": {"connect": {"id": lesson_material.id}},
                        "file_type": fdata["file_type"],
                        "original_filename": fdata["original_filename"],
                        **self._file_json_fields(fdata, include_optional=True),
                        "page_count": fdata.get("page_count"),
                        "word_count": fdata.get("word_count"),
                    },
                    "update": {
                        "original_filename": fdata["original_filename"],
                        **self._file_json_fields(fdata, include_optional=True),
                        "page_count": fdata.get("page_count"),
                        "word_count": fdata.get("word_count"),
                        "updated_at": now,
                    },
                },
            )
            file_records[ftype] = file_record

        # Store links. LessonMaterialLink stores plain source/target exercise
        # ids (from the extraction), so no exercise lookup is needed.
        for link in lesson_data.get("links", []):
            await prisma.lessonmateriallink.create(
                data={
                    "lesson_material_id": lesson_material.id,
                    "from_exercise_id": link["from_exercise_id"],
                    "to_exercise_id": link["to_exercise_id"],
                    "relationship_type": link["relationship_type"],
                    "confidence": link["confidence"],
                    "rationale": link["rationale"],
                },
            )

        return {
            "lesson_material": lesson_material,
            "files": file_records,
            "links_count": len(lesson_data.get("links", [])),
        }

    async def get_lesson_material(
        self,
        user_id: str,
        lesson_id: str,
    ) -> dict[str, Any] | None:
        """Retrieve a complete lesson material with all files and links."""
        prisma = await self.connect()

        lesson = await prisma.lessonmaterial.find_first(
            where={
                "user_id": user_id,
                "lesson_id": lesson_id,
            },
            include={
                "files": True,
            },
        )

        if not lesson:
            return None

        links = await prisma.lessonmateriallink.find_many(
            where={"lesson_material_id": lesson.id},
            order={"created_at": "desc"},
        )

        return {
            "lesson_material": lesson,
            "files": {f.file_type: f for f in lesson.files},
            "links": links,
        }

    async def list_user_lessons(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List all lessons for a user."""
        prisma = await self.connect()

        lessons = await prisma.lessonmaterial.find_many(
            where={"user_id": user_id},
            take=limit,
            skip=offset,
            order={"created_at": "desc"},
            include={
                "files": True,
            },
        )

        return [
            {
                **lesson,
                "files": {f.file_type: f for f in lesson.files},
            }
            for lesson in lessons
        ]

    async def delete_lesson(
        self,
        user_id: str,
        lesson_id: str,
    ) -> bool:
        """Delete a lesson material and all associated data."""
        prisma = await self.connect()

        lesson = await prisma.lessonmaterial.find_first(
            where={"user_id": user_id, "lesson_id": lesson_id},
        )
        if not lesson:
            return False

        await prisma.lessonmaterial.delete(where={"id": lesson.id})
        return True


async def store_relationships(
    user_id: str,
    lesson_data: dict[str, Any],
) -> dict[str, Any]:
    """Convenience function to store lesson material relationships."""
    async with LessonMaterialStorage() as storage:
        return await storage.store_lesson_material(user_id, lesson_data)