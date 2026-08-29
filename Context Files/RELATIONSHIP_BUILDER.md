# Relationship Builder

## Purpose

The Relationship Builder is a CLI tool and library that takes the four core learning material files for a lesson — **Kursbuch** (coursebook), **Übungsbuch** (workbook), **Audio** (audio files), and **Lösungen** (solutions) — runs the extraction pipeline on each, and builds cross-file relationships to reconstruct the complete learning experience.

## Input Files

| File Type | Description | Detection Keywords |
|-----------|-------------|-------------------|
| `kursbuch` | Main coursebook/lesson book | kursbuch, lehrbuch, textbook, lesson_book |
| `ubungsbuch` | Workbook/exercise book | ubungsbuch, übungsbuch, workbook, exercise_book |
| `audio` | Audio tracks (MP3, WAV, etc.) | audio, mp3, wav, track, cd |
| `loesungen` | Solution/answer key | loesung, lösung, solution, answer, key, teacher |

## Pipeline

```
File Inputs (4 files)
        ↓
Extraction Pipeline (per file)
  ├── Document Classification
  ├── Layout Reconstruction (PyMuPDF)
  ├── Image Extraction
  ├── Educational Block Detection
  ├── Exercise Extraction (validated)
  ├── Question Decomposition
  ├── Image Linking
  ├── Audio Linking
  └── Solution Matching
        ↓
Cross-File Relationship Engine (Stage 10)
  ├── Chapter Matching (Lektion X)
  ├── Exercise Number Matching (Aufgabe N)
  ├── Audio Linking (Hören Sie Track N)
  └── Solution Matching (Lösung Seite X)
        ↓
Knowledge Graph Construction
        ↓
Persist to Database (lesson_materials table)
```

## Cross-File Relationship Types

### 1. Chapter Match (`chapter_match`)
Matches files that reference the same lesson/chapter number (e.g., "Lektion 3" in both Kursbuch and Übungsbuch).

**Confidence**: 0.95
**Rationale**: "Both files contain Lektion 3"

### 2. Exercise Number Match (`exercise_number_match`)
Matches exercises with the same number across files (e.g., "Aufgabe 5" in both Übungsbuch and Lösungen).

**Confidence**: 0.90
**Rationale**: "Both files contain Aufgabe 5"

### 3. Audio Link (`audio_link`)
Links exercises that reference audio tracks to the audio file.

**Detection patterns**:
- "Hören Sie Track 12"
- "Track 5"
- "CD 2 Track 3"

**Confidence**: 0.95
**Rationale**: "Exercise references Track 12 in audio file"

### 4. Solution Link (`solution_link`)
Links exercises to their solutions in the solution book.

**Detection patterns**:
- "Lösung Seite 210"
- "Lösung: ..."
- "Lehrerhandbuch"
- "Answer key"

**Confidence**: 0.85
**Rationale**: "Exercise references solution on page 210"

## CLI Usage

```bash
# Build relationships for a lesson
woodpacker-extract build-relationships Kursbuch.pdf Ubungsbuch.pdf Audio.mp3 Loesungen.pdf \
  --user-id USER_ID \
  --lesson-id lesson-1 \
  --lesson-title "Lesson 1: Veränderungen" \
  --output relationships.json

# With database storage (requires DATABASE_URL)
woodpacker-extract build-relationships Kursbuch.pdf Ubungsbuch.pdf Audio.mp3 Loesungen.pdf \
  --user-id USER_ID \
  --lesson-id lesson-1 \
  --store
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `files` | Yes | Exactly 4 files (order auto-detected by filename) |
| `--user-id` | Yes | User ID owning the lesson |
| `--lesson-id` | Yes | Lesson identifier (e.g., `lesson-1`) |
| `--lesson-title` | No | Lesson title (default: "Lesson") |
| `--output` / `-o` | No | Write JSON to file |
| `--indent` | No | JSON indent (default: 2) |
| `--store` | No | Persist to database (requires DATABASE_URL) |

### Auto-Detection

The CLI auto-detects file types from filenames. Order doesn't matter — the tool identifies each file's role from keywords in the filename.

## Output Schema

```json
{
  "lesson_material": {
    "user_id": "string",
    "lesson_id": "string",
    "title": "string",
    "language": "de",
    "status": "processed"
  },
  "files": {
    "kursbuch": {
      "file_type": "kursbuch",
      "original_filename": "Kursbuch.pdf",
      "classification": {"file_id": "...", "file_name": "...", "file_type": "lesson_book", "confidence": 0.85},
      "exercises": [...],
      "items": [...],
      "images": [...],
      "audio_refs": [...],
      "page_count": 12,
      "word_count": 2500
    },
    "ubungsbuch": { ... },
    "audio": { ... },
    "loesungen": { ... }
  },
  "links": [
    {
      "from_exercise_id": "ex-kursbuch-0-0",
      "to_exercise_id": "ex-ubungsbuch-1-0",
      "relationship_type": "exercise_number_match",
      "confidence": 0.9,
      "rationale": "Both files contain Aufgabe 5"
    },
    {
      "from_exercise_id": "ex-kursbuch-0-0",
      "to_exercise_id": "audio-track-12",
      "relationship_type": "audio_link",
      "confidence": 0.95,
      "rationale": "Exercise references Track 12 in audio file"
    }
  ]
}
```

## Database Schema

The output maps to the following Prisma models:

### `LessonMaterial`
- `id`, `user_id`, `lesson_id`, `title`, `language`, `status`, `created_at`, `updated_at`
- Relations: `files` (LessonMaterialFile[])

### `LessonMaterialFile`
- `id`, `lesson_material_id`, `file_type`, `original_filename`, `object_key`, `minio_bucket`, `file_size`, `mime_type`, `page_count`, `word_count`
- JSON fields: `classification`, `exercises`, `items`, `images`, `audio_refs`
- Relation: `lesson_material` (LessonMaterial)

### `LessonMaterialLink`
- `id`, `lesson_material_id`, `from_exercise_id`, `to_exercise_id`, `relationship_type`, `confidence`, `rationale`, `created_at`
- Indexes on `lesson_material_id`, `from_exercise_id`, `to_exercise_id`

### Unique Constraint
- `LessonMaterialFile`: `@@unique([lesson_material_id, file_type])` — one file per type per lesson

## Implementation Details

### Core Modules

| Module | Purpose |
|--------|---------|
| `extraction-service/src/woodpacker_extraction/relationship_builder.py` | Core relationship building logic |
| `extraction-service/src/woodpacker_extraction/storage.py` | Database persistence (Prisma) |
| `extraction-service/src/woodpacker_extraction/cli.py` | CLI entry point (`build-relationships` command) |

### Key Functions

| Function | Description |
|----------|-------------|
| `build_relationships()` | Main entry point — processes 4 files, builds links |
| `RelationshipBuilder.process_files()` | Runs pipeline on each file, then cross-links |
| `_build_chapter_matches()` | Matches Lektion X across files |
| `_build_exercise_number_matches()` | Matches Aufgabe N across files |
| `_build_audio_links()` | Links "Hören Sie Track N" to audio file |
| `_build_solution_links()` | Links "Lösung Seite X" to solutions file |

### Configuration

Environment variables (in `.env`):
- `DATABASE_URL` — PostgreSQL connection string (for `--store`)
- `EXTRACTION_SERVICE_PATH` — Path to extraction service (for subprocess fallback)
- `OPENCODE_API_KEY`, `OPENCODE_API_URL`, `OPENCODE_MODEL` — LLM for exercise classification

## Quality Control

The builder verifies:
- ✅ Every file classified with confidence ≥ 0.70
- ✅ Chapter matches found across core files
- ✅ Exercise numbers matched across workbook/solutions
- ✅ Audio references resolved to audio file
- ✅ Solution references matched to solutions file
- ⚠️ Links below 0.70 confidence flagged for verification

## Example

Given these files for Lesson 1:
- `Kursbuch_Lektion1.pdf` → detected as `kursbuch`
- `Ubungsbuch_Lektion1.pdf` → detected as `ubungsbuch`
- `Track12.mp3` → detected as `audio`
- `Loesungen_Lektion1.pdf` → detected as `loesungen`

The builder will:
1. Extract exercises from each
2. Match "Lektion 1" across all files → `chapter_match`
3. Match "Aufgabe 5" in Kursbuch and Übungsbuch → `exercise_number_match`
4. Link "Hören Sie Track 12" in Kursbuch to audio file → `audio_link`
5. Link "Lösung Seite 45" in Kursbuch to Loesungen → `solution_link`
6. Output unified JSON and optionally store in database

## Related Files

- `Context Files/LEARNING_MATERIAL_RELATIONSHIP_ENGINE.md` — Full relationship engine specification
- `Context Files/BOOK_ANALYZER.md` — Book analysis pipeline
- `Context Files/EXERCISE_CLASSIFIER.md` — Exercise type taxonomy
- `extraction-service/src/woodpacker_extraction/relationship_builder.py` — Implementation
- `extraction-service/src/woodpacker_extraction/storage.py` — Database persistence
- `extraction-service/src/woodpacker_extraction/cli.py` — CLI command
- `prisma/schema.prisma` — Database schema