# AI Architecture

## Core Architecture

### Ingestion Layer
Accepts:
- PDFs
- EPUBs
- Audio
- Images
- Notes

### Document Understanding Pipeline (Book Analyzer v2)
Deterministic layout-first pipeline — **layout analysis detects document structure; LLMs only enrich already-detected blocks** (never page-level vision):

1. PDF Processing (PyMuPDF: page images, embedded images, text layer, coordinates)
2. Layout Detection (Google Document AI → PaddleOCR PP-Structure V3 → Surya; interchangeable providers; every block carries mandatory `bbox` + confidence)
3. Block Extraction (crop every block independently)
4. OCR Per Block (Document AI → Google Vision → PaddleOCR → Surya; never whole-page OCR)
5. Block Classification (deterministic rules first; LLM only on low confidence)
6. Image Understanding (vision per image block only)
7. Relationship Builder (instruction/question/image/audio/solution ↔ exercise)
8. Knowledge Graph (`HAS_EXERCISE`, `HAS_IMAGE`, `HAS_AUDIO`, `HAS_SOLUTION`, …)
9. Exercise Detection + Type Classification (15 types, confidence-scored)
10. Storage (every detected object persisted as structured JSON)

Implemented as a LangGraph pipeline (independently testable nodes, execution-time + confidence logging, retries) with a Pipeline Inspector debug page. Full spec: [`Context Files/BOOK_ANALYZER.md`](Context%20Files/BOOK_ANALYZER.md). The legacy page-level vision + chunked-LLM discovery pipeline in `src/lib/pipeline.ts` is deprecated by this spec.

### Speech-to-Text Service
Processes audio.

### Accent Analyzer
Analyzes:
- Pronunciation
- Rhythm
- Intonation
- Stress

### Pattern Extraction Engine
Extracts recurring structures.

### Knowledge Graph
Maps relationships.

### Speaking Generator (NEW)
Generates from uploaded material:
- Recall questions
- Speaking prompts
- Pattern drills
- Roleplays
- Monologues
- Retelling exercises
- Pronunciation exercises

### Audio Generator (NEW)
Generates audio for speaking exercises.

### Speaking Engine (UPDATED)
Responsible for:
- Audio Recall mode
- Pattern Mastery mode
- Voice Response mode
- Speech-to-text
- Conversation management

### Speech Recognition
Transcribes learner speech.

### Pronunciation Engine (NEW)
Scores pronunciation accuracy.

### Grammar Analyzer (NEW)
Analyzes grammatical correctness.

### Fluency Analyzer (NEW)
Measures fluency and naturalness.

### Adaptive Feedback Engine (NEW)
Provides structured feedback:
- Pronunciation corrections
- Grammar corrections
- Vocabulary suggestions
- Fluency tips
- Confidence coaching

### Mastery Engine (NEW)
Tracks:
- Speak Until Mastered criteria
- Pattern mastery scores
- Cycle progression
- Automatic reintroduction of weak items
### Exercise Generator

Creates learning activities.

### Woodpecker Scheduler

Creates repetition cycles for language learning.

## Knowledge Mastery (Premium — Coming Soon)

Knowledge Graph, Mastery Engine, and Recall systems for Medicine, Engineering, Law, Nursing, and Certifications will be available in the Mastery plan.

## Pipeline

```
Uploaded Material
    ↓
Book Analyzer
    ↓
Knowledge Graph
    ↓
Pattern Extraction Engine
    ↓
Speaking Generator
    ↓
Audio Generator
    ↓
Speaking Engine
    ↓
Speech Recognition
    ↓
Pronunciation Engine + Grammar Analyzer + Fluency Analyzer
    ↓
Adaptive Feedback Engine
    ↓
Mastery Engine
    ↓
Woodpecker Scheduler
```

## Implemented Pipeline (Current Code)

> **Superseded for PDF processing.** The layout-first Document Understanding
> Pipeline (above, `BOOK_ANALYZER.md`) replaces the page-level vision + LLM
> discovery flow below. Keep the code running until the LangGraph pipeline
> lands; do not extend it.

The pipeline implemented in `src/lib/pipeline.ts` (client-side, `chatJson`
LLM + heuristic fallback):

```
sanitizeAssets (text extraction, 24 assets max, 250k chars each)
    ↓
DISCOVERY_SYSTEM (llmDiscover — per 24k-char chunk, concurrency 4)
    chapters / topics / concepts / vocabulary / grammar / objectives /
    exercises / dialogues / sentences   → validateExtractedExercise (requireAnswer:false)
    ↓
buildPackagePlan (spine/workbook/handbook/reference/media grouping)
    ↓
RECONSTRUCT_SYSTEM (llmReconstruct — blueprint: modules, lessons, concepts,
    duplicates, path)  → heuristic reconstructBlueprint fallback
    ↓
MATERIALS_SYSTEM (llmMaterials — per lesson: vocabulary, grammar, reading,
    listening, speaking, writing, exercises)
    → validateExtractedExercise (requireAnswer:true)
    ↓
assembleCourse → Course (modules/lessons/exercises/materials/concepts/path/stats)
    ↓
Exercises play page → FlashcardDeck (see FLASHCARD_CHARACTERISTICS.md)
```

If the LLM discovery or reconstruction fails, the pipeline falls back to
`heuristics.ts` (local mode) and `reconstructBlueprint`.

Exercise extraction is validated at all three extraction sites via
`src/lib/exercise-validation.ts` — see
`Context Files/Exercise_Extraction_Skill/` for the fix workflow.

## Recommended Stack

### Frontend
- Next.js
- TypeScript
- Tailwind

### Backend
- NestJS

### AI
- GPT-5
- Whisper
- Embeddings

### Database
- PostgreSQL
- pgvector

### Storage
- Cloudflare R2

### Queue
- BullMQ