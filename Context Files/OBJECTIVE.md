# Objective

Redesign the upload system so users can upload an entire course folder instead of uploading individual files.

The system must automatically discover, analyze, verify, and display every file and subfolder contained within the uploaded directory.

The upload process should work exactly like a local file explorer.

---

# Supported Upload Types

The system must support:

```text id="cav3ak"
Single Folder Upload

Single File Upload

Multiple Folder Upload

Multiple File Upload

Mixed Upload
(Files + Folders)
```

Examples:

```text id="y0i7gu"
Kontext B2/
```

or

```text id="17r2wm"
Kontext B2/
Aspekte Neu B2/
Menschen B1/
```

---

# Recursive Folder Scanning

When a folder is uploaded, recursively scan every level.

Example:

```text id="tvtl3m"
Kontext B2
│
├── audio
│   ├── chapter1
│   │   ├── track1.mp3
│   │   └── track2.mp3
│   │
│   └── chapter2
│       └── track3.mp3
│
├── video
│   ├── lesson1.mp4
│   └── lesson2.mp4
│
├── extras
│   ├── worksheets
│   └── tests
│
├── Kursbuch.pdf
├── Übungsbuch.pdf
└── Unterrichtshandbuch.pdf
```

The system must discover everything automatically.

No depth limitation.

Scan folders inside folders indefinitely.

---

# Directory Reconstruction

Preserve the original directory structure.

Create an internal tree.

Example:

```text id="ph3f58"
Kontext B2
│
├── audio
│   ├── chapter1
│   │   ├── track1.mp3
│   │   └── track2.mp3
│   └── chapter2
│       └── track3.mp3
│
├── video
│   ├── lesson1.mp4
│   └── lesson2.mp4
│
├── Kursbuch.pdf
├── Übungsbuch.pdf
└── Unterrichtshandbuch.pdf
```

Store:

* File name
* Extension
* Full path
* Parent folder
* Child folder relationships
* File size
* Metadata

---

# Upload Dashboard

After upload, immediately display a directory explorer.

Example:

```text id="07z2ll"
📁 Kontext B2

├── 📁 audio
│   ├── 📁 chapter1
│   │   ├── 🎵 track1.mp3
│   │   └── 🎵 track2.mp3
│   │
│   └── 📁 chapter2
│       └── 🎵 track3.mp3
│
├── 📁 video
│   ├── 🎬 lesson1.mp4
│   └── 🎬 lesson2.mp4
│
├── 📁 extras
│
├── 📄 Kursbuch.pdf
├── 📄 Übungsbuch.pdf
└── 📄 Unterrichtshandbuch.pdf
```

Users must see exactly what was uploaded.

---

# Upload Validation

Before processing:

Verify every uploaded item.

Example:

```text id="uq29vv"
✓ Folder scanned

✓ Files indexed

✓ Metadata extracted

✓ Structure reconstructed

✓ No corrupted files

✓ No missing references
```

---

# Content Discovery

Once scanning finishes:

Classify files automatically.

Examples:

```text id="20h9xj"
PDF → Textbook

PDF → Workbook

PDF → Teacher Handbook

MP3 → Audio

MP4 → Video

DOCX → Worksheet

ZIP → Archive

JPG → Image
```

Store classification.

---

# Material Detection

Identify educational materials automatically.

Example:

```text id="mh1t8m"
Kursbuch.pdf
```

Classification:

```text id="shdrvl"
Course Book
```

Example:

```text id="95q0b0"
Übungsbuch.pdf
```

Classification:

```text id="87otwm"
Workbook
```

Example:

```text id="x4j2d7"
Unterrichtshandbuch.pdf
```

Classification:

```text id="xtx7v0"
Teacher Handbook
```

---

# Course Package Analysis

Determine whether the uploaded files belong to the same course.

Example:

```text id="h20vgh"
Kontext B2
```

contains:

```text id="s0gw4m"
Kursbuch
Übungsbuch
Audio
Teacher Handbook
```

System should detect:

```text id="f0bkxf"
Course Package Found
Confidence: 99%
```

---

# Nested Folder Handling

The system must never ignore nested folders.

Bad:

```text id="3dbowf"
audio/
```

Good:

```text id="pvyn6x"
audio/
  chapter1/
      track1.mp3

  chapter2/
      track2.mp3

  chapter3/
      track3.mp3
```

Every nested file must be indexed.

---

# Upload Summary

After upload generate:

```text id="06msr6"
Upload Summary

Folders Found: 14

Files Found: 382

PDF Files: 5

Audio Files: 243

Video Files: 18

Images: 76

Documents: 40

Unknown Files: 0
```

---

# Processing Gate

Only after:

```text id="9m36ln"
✓ Directory reconstructed

✓ Recursive scan complete

✓ File inventory complete

✓ Upload summary generated

✓ Material classification complete
```

may the course analysis begin.

---

# Success Criteria

The upload system should behave like Google Drive, Dropbox, Windows Explorer, and VS Code Explorer combined.

Users upload one folder.

The platform automatically:

1. Recursively scans every file and folder.
2. Preserves the original structure.
3. Displays the directory tree.
4. Detects educational materials.
5. Builds a complete file inventory.
6. Verifies completeness.
7. Passes the structured package to the course-mapping engine.

Nothing inside the uploaded folder hierarchy may be skipped, ignored, hidden, or lost.

---

# Completed Work — Real-Time Course Repository

Status: **in_progress** (upload folder system) + **done** (global course repository sync)

## Global Course Repository & Real-Time Sync — DONE

Per `CRITICAL_ISSUE.md`, uploaded materials must become a persistent global resource available across all pages without manual refresh.

### What was implemented

1. **Multi-course storage** (`src/lib/storage.ts`)
   - Courses stored as an array under `woodpacker:courses` (was: single `woodpacker:course`)
   - Active course tracked via `woodpacker:active-course`
   - Automatic migration from old single-course format on first load

2. **Event-driven updates** (`src/lib/storage.ts`)
   - `subscribe(callback)` — listens to CustomEvent (same-tab) + storage event (cross-tab)
   - Events published on save/clear/setActive:
     - `course:created` / `course:updated`
     - `materials:processed`
     - `knowledgegraph:updated`
     - `exercises:generated`
     - `course:deleted`
     - `course:active`
     - `repo:sync` (cross-tab sync)

3. **Reactive hook** (`src/lib/useCourse.ts`)
   - `useCourse()` — returns active course; re-renders on any repository event
   - `useCourses()` — returns all courses; re-renders on events
   - `useActiveCourseId()` — returns active course ID

4. **All pages updated** to use `useCourse()` hook
   - `dashboard/page.tsx`, `exercises/page.tsx`, `language/page.tsx`
   - `speaking/page.tsx`, `accent/page.tsx`, `materials/page.tsx`
   - `cycles/page.tsx`, `cycles/[cycle]/page.tsx`, `materials/[id]/page.tsx`

### Acceptance criteria met

- ✓ Materials persist across page refresh, route change, browser reload, new sessions
- ✓ Dashboard updates automatically when upload completes (no manual refresh)
- ✓ Exercises, Language Mastery, Speaking, Accent, Materials, and Cycles pages all read from the same global source
- ✓ Cross-tab sync: opening the Dashboard in a second tab reflects a new course uploaded in the first tab
- ✓ Backward compatible: existing `saveCourse`/`loadCourse`/`clearCourse` API preserved
- ✓ `npm run dev` compiles cleanly; `tsc --noEmit` passes; ESLint clean (no new warnings)

---

# Completed Work — Exercise Extraction Fixes

Status: **done**

## Exercise extraction validation

Per the `Exercise_Extraction_Skill` pack (`Context Files/Exercise_Extraction_Skill/`), the pipeline now validates every extracted exercise before it reaches a course.

### What was implemented

1. **`src/lib/exercise-validation.ts`** (new)
   - `validateExtractedExercise(raw, { requireAnswer })` — validates type, prompt quality, answerability, MC option integrity; strips markdown; rewrites MC answers to the exact option string
   - `isJunkExercisePrompt(prompt)` — rejects `›` arrows, track-number sequences, `CD/Track/Spur` prefixes, digit-only lines
   - `VALID_EXERCISE_TYPES` — the 8 valid types (single source of truth)
   - `REQUIRED_ANSWER_TYPES` — fill-blank, multiple-choice, translation, recall

2. **`src/lib/pipeline.ts`** — validation wired at all 3 extraction sites:
   - Discovery (`llmDiscover`, line ~143): `requireAnswer:false` (source may not expose answers)
   - Materials generation (`assembleCourse`, line ~307): `requireAnswer:true` (every generated exercise must be answerable)
   - Heuristic fallback (`assembleCourse`, line ~367): `requireAnswer:false`
   - Local `isJunkExercisePrompt`/`VALID_EXERCISE_TYPES` removed (imported from validation module)

3. **Prompt hardening** — `DISCOVERY_SYSTEM` and `MATERIALS_SYSTEM` now explicitly exclude CD track listings (`1.07`, `CD 1, Track 3`, `Spur 5`), TOC entries, bare titles, CEFR levels, page arrows (`› 20`), and require exact `page`/`name` references.

### Acceptance criteria met

- ✓ No track listings / titles / level markers reach the course as exercises
- ✓ Every generated exercise is answerable; MC answers are one of the options verbatim
- ✓ Skill pack documents rules for prompts (`prompt_rules.md`) and validation (`validation_rules.md`) with a sync invariant
- ✓ `tsc --noEmit` passes; ESLint clean

---

# Completed Work — Duolingo-Style Exercise Deck (Practice Space)

Status: **done**

Full redesign of the exercise play page into a Duolingo-style challenge deck. See `Context Files/FLASHCARD_CHARACTERISTICS.md` for the complete reference.

### What was implemented

1. **`src/components/exercises/FlashcardDeck.tsx`** — new deck:
   - Dark glass card, viewport-fixed layout (page never scrolls, card scrolls internally)
   - Back button, badge + item counter, challenge title, avatar/source row with Listen (TTS)
   - Per-type answer areas: SentenceBuilder, GapFiller, option tiles, textarea + word bank, VoiceRecorder, reading passage box, audio-centered listening flow (waveform, replay, speed 0.5–1.5×, transcript toggle, mode select: choice/reconstruct/dictation)
   - Feedback: correct → green glow + success bounce + confetti + XP; incorrect → gentle shake + hint (Lightbulb reveals answer), never "Wrong"
   - "Why?" → `ExplanationModal` (Correct answer → Your attempt → Why → Common mistakes → Example sentences → Related concepts)
   - Keyboard nav (←/→/Enter/1–9), `aria-live`, `MotionConfig reducedMotion="user"`

2. **`src/components/exercises/VoiceRecorder.tsx`** (new) — MediaRecorder mic input (speaking/roleplay/pattern-drill)

3. **`src/app/exercises/[id]/play/page.tsx`** — ProgressHeader + `useGameStats` (`addXp` on result), `sourceText` attach (reading passage / listening transcript), `findLesson` helper

4. **`src/lib/exercise-config.ts`** — type → challenge title / XP / practice dimension / avatar emotion; badge specs

### Acceptance criteria met

- ✓ Every exercise requires an answer input — no dead-end "no answer key" state
- ✓ Listening exercises are audio-centered with transcript/speed/mode controls
- ✓ XP, streak, daily goal and badges persist via `useGameStats` (localStorage `woodpacker:game-stats`)
- ✓ Reduced motion + high contrast (`prefers-contrast: more` in `globals.css`)
- ✓ `tsc --noEmit` passes; ESLint clean

---

# Completed Work — Deck Quality, Polish & Bug Fixes

Status: **done**

## Bug fixes

1. **Listening submit bug** (`FlashcardDeck.tsx`) — `canSubmit` always returned `false` for listening cards, so the Check button in **dictation** and **multiple-choice** listening modes could never submit. Fixed: listening now submits when the chosen mode has input (`listenMode === 'dictation'` with typed text; choice uses the selected option).
2. **Microphone unavailable dead-end** (`VoiceRecorder.tsx` + `FlashcardDeck.tsx`) — if `getUserMedia` failed, the user was stuck on speaking/roleplay cards with no way to continue. Added `onUnavailable` callback: the deck shows "Microphone unavailable — you can still check the card and continue" and enables Check.
3. **TTS locale** (`exercise-enrich.ts`) — `course.language` is a language name ("German"), not a BCP-47 code, so `speechSynthesis` fell back to a hardcoded default. Added `LANGUAGE_TO_LOCALE` mapping (30 languages) + `normalizeLocale`; falls back to content inference.
4. **Lint warnings (5) removed** — unused `setPdfPages`/`audioPlaying`/`videoPlaying` state in `materials/[id]` (pdf pagination was never wired; state removed), `clearCourse` import in `upload`, `next/image` warning via disable comment for data-URL previews.

## Polish

5. **Dashboard "Today's Mission"** (`dashboard/page.tsx`) — progress bar and percentage now reflect live `useGameStats` daily-goal progress (was hardcoded 0%); footer shows streak days + total XP alongside the daily minute estimate.

## Roadmap backlog (deferred, not implemented)

- Wire `GameBoard` matching into the deck (component exists, unused)
- Speaking accent evaluation (speech recognition scoring)
- Reading passage tap-to-translate / inline definitions
- Replace legacy `ExerciseSession` in `/cycles/[cycle]` with `FlashcardDeck`

---

# Completed Work — Durable Background Jobs (BullMQ + Redis)

Status: **done**

Replaces the in-memory `jobs = new Map()` transform registry with a durable BullMQ queue, satisfying TECHNICAL_STACK.md rules 8–13 (BullMQ for long-running jobs, processing in workers, recoverable/idempotent/retryable operations).

## What changed

1. **`src/lib/redis.ts`** (new) — ioredis connection factory (`maxRetriesPerRequest: null` for BullMQ), env-driven host/port/password/db. Redis is provisioned in `compose.yaml` (persistent, `--appendonly yes`).
2. **`src/lib/transform-queue.ts`** (new) — `woodpacker-transform` queue singleton (globalThis-guarded), `enqueueTransform()` with `jobId`, `attempts: 3`, exponential backoff (10s), jobs retained on complete/fail; `getTransformJob()` + `toTransformJobStatus()` map BullMQ jobs back to the legacy `TransformJob` shape the client poller expects.
3. **`src/lib/transform-worker.ts`** (new) — lazy singleton Worker (lockDuration 15min, lockRenewTime 5min, stalledInterval 60s, maxStalledCount 2 — long LLM calls never trip the stall check; a dead process's jobs are reclaimed and retried). Started by the API route so `next dev` works without a separate process.
4. **`src/lib/pipeline.ts`** — `runPipeline(job: Job<TransformJobData>)`; progress written via `job.updateProgress(...)`, the built `Course` returned as the job's return value, failures thrown (BullMQ retries, then marks failed with `failedReason`). `createJob`/`getJob`/`jobs` Map removed.
5. **`src/worker.ts`** (new) — standalone worker entry (`npm run worker`) for production; graceful SIGINT/SIGTERM shutdown.
6. **`src/app/api/transform/route.ts`** — POST enqueues (returns `{ id }`), GET reads durable job state; 503 with actionable message when Redis is down.
7. **`scripts/smoke-transform.ts`** + `npm run smoke:transform` — end-to-end queue smoke test (enqueue → worker → done → result retrieval), verified against the local Redis container.

## Recovery semantics

- Jobs survive server restarts (Redis AOF persistence) and resume or retry.
- Transient failures retry up to 3× with exponential backoff; stalled jobs are reclaimed after the lock expires (bounded by `maxStalledCount`).
- Completed/failed jobs remain queryable by id (not auto-removed).

## Verify

- `docker compose up -d redis` (already running)
- `npx tsx scripts/smoke-transform.ts` → job completes, `result` is the assembled Course
- Upload flow: POST `/api/transform` returns `{ id }`, GET `/api/transform?id=` polls phase/progress/result

---

# Completed Work — Learning Material Relationship Engine

Status: **done**

Implements `Context Files/LEARNING_MATERIAL_RELATIONSHIP_ENGINE.md`: the AI no longer treats uploaded files independently — it builds a relationship graph across all materials and links every exercise to the resources it requires.

## What changed

1. **`src/lib/relationships.ts`** (new) — the engine core:
   - `detectTrackRefs` — "Hören Sie Track 12", "CD 1, Track 3", "Video 5" → typed `{kind, numbers}` refs
   - `detectPageRefs` / `detectSolutionRef` / `detectReadingRef` / `extractExerciseLabels` — "Siehe Seite 45", "Lösung im Lehrerhandbuch", "Aufgabe 5a"
   - `linkExerciseResources` — Phase 4 unified exercise object: matches track refs against all uploaded media (via `matchMediaNumbers`), pulls solution snippets from handbook/reference bodies by exercise-label matching, links page-bearing assets as readings, infers `page` when a prompt references a page
2. **`src/lib/types.ts`** — `Exercise` extended with `requiredAudio`, `requiredVideo`, `requiredReadings`, `solutions` (unified exercise object fields).
3. **`src/lib/pipeline.ts`** — `assembleCourse` post-pass runs `linkExerciseResources` for every lesson exercise using its `ChapterGroup` (spine/workbook/handbook/media linked by chapter number).
4. **`src/lib/exercise-validation.ts`** — `publishExercise` gate preserves the new unified-object fields.
5. **`src/components/exercises/FindMe.tsx`** — refs now start with the exercise's linked `requiredAudio`/`requiredVideo` (priority order), and the question panel shows a "Solution (handbook)" block when solutions were located.
6. **`src/components/exercises/FlashcardDeck.tsx`** — Flashcard Generation Rules:
   - exercises with `requiredAudio` render a real uploaded-track `<audio>` player first; answers (Check + Hint) stay locked until the audio has been played
   - exercises with `requiredVideo` render a `<video>` player first with the same lock
   - after answering, the "Solution (handbook)" reveal section renders from `solutions`
   - all related resources appear inside a single exercise card

## Verify

- `npx eslint src/lib/relationships.ts src/components/exercises/FlashcardDeck.tsx`
- `npx tsc --noEmit -p tsconfig.json`
- Upload a Kursbuch + Audios + Lösungen package → exercises get `requiredAudio`/`solutions`; the flashcard deck shows the real track player and gates the answer until it plays

---

# Completed Work — Exercise Answer-Entry System Redesign (Type-Aware Dispatch + Structured Answers + Progress Persistence)

Status: **done**

Redesign Woodpacker's exercise answer-entry system so each exercise type renders its native interaction using structured answers + per-type validators, with answers persisted back into the mastery/repetition flow — consolidating on `FlashcardDeck` renderer (removing `ExerciseSession`) and keeping existing DB data intact.

## What was implemented

### 1. Unified `FlashcardDeck.tsx` renderer
- **`src/components/exercises/FlashcardDeck.tsx`** (full rewrite):
  - Single `renderInteractive(resolvedType)` switch dispatching to typed components:
    - `ChoiceCard` — multiple-choice / multiple-select / article-selection / case-selection / true-false
    - `GapFiller` — fill-blank / gap-text (independent per-blank tracking)
    - `SentenceBuilder` — translation / sentence-completion / grammar-transformation / free-text / assessment
    - `SentenceBlocks` — word-order (block reordering)
    - `GameBoard` — matching / pattern-drill (memory-match pairs)
    - `SpeakingRecorder` — speaking / roleplay / image-description
    - `AudioPlayer` — listening (choice/reconstruct/dictation)
  - Removed: local `speak`/waveform/listenMode machinery (owned by `AudioPlayer`)
  - All feedback, avatar, media, screenshot, page link, reading passage, solutions, explanation modal, confetti, keyboard nav preserved

### 2. Canonical `ExerciseType` + `UserAnswer` type layer
- **`src/lib/exercise-model.ts`** — single source of truth:
  - 22 hyphenated `ExerciseType` values (`fill-blank`, `gap-text`, `word-order`, `multiple-select`, `article-selection`, `case-selection`, `true-false`, `pattern-drill`, etc.)
  - Structured `UserAnswer` union per type (`{type:'multiple-choice', selectedOptionId}`, `{type:'gap-text', values}`, `{type:'word-order', orderedTokenIds}`, `{type:'matching', pairs}`, `{type:'conjugation', fields}`, etc.)
  - `ExerciseValidator` / `ValidationResult` contracts
  - `ValidatedExerciseShape` for normalized exercise data
  - `ExerciseStructure` (segments, conjugation, matching, tokens)

- **`src/lib/exercise-classifier.ts`** (§10 classification layer):
  - `resolveExerciseType()` — infers fine-grained type from coarse DB type + prompt + structure (never trusts extracted type blindly)
  - Structure-driven overrides (segments→gap-text, conjugation table, matching pairs, tokens→word-order)
  - Prompt-driven overrides (true/false, article/case selection, gap markers)
  - `toCoarseType()` + `SEMANTIC_TYPES` (free-text/translation/speaking/image-description need LLM evaluation)

- **`src/lib/exercise-resolver.ts`** — `toValidatedExercise()` normalizes `PremiumExercise` → `ValidatedExerciseShape`, synthesizes structure for legacy rows (word-order tokens from answer)

- **`src/lib/exercise-validators.ts`** — per-type validator registry:
  - Deterministic validators for choice/gap/word-order/matching/conjugation/article/case
  - Semantic/LLM stubs for free-text/translation/speaking/image-description
  - `VALIDATORS` registry + `validateAnswer()` entry point

- **`src/lib/types/exercise.ts`** — `PremiumExercise` extended with `subtype`, `structured`, `optionItems`, `acceptedAnswers`, `locale`

### 3. Components emit structured answers
- `ChoiceCard.tsx` — `allowMultiple`, emits `{type:'multiple-choice'|'multiple-select', ...}`
- `GapFiller.tsx` — independent per-blank tracking, emits `{type:'fill-blank'|'gap-text', values:Record<idx,word>}`
- `SentenceBuilder.tsx` / `SentenceBlocks.tsx` — emits `{type:'word-order', orderedTokenIds}` or `{type:'translation'|'sentence-completion'|'free-text', text}`
- `GameBoard.tsx` — emits `{type:'pattern-drill', completed:true}`
- `SpeakingRecorder.tsx` / `AudioPlayer.tsx` — emit structured `speaking`/`listening` answers

### 4. Removed legacy `ExerciseSession.tsx`
- Deleted `src/components/exercises/ExerciseSession.tsx`
- **`src/app/cycles/[cycle]/page.tsx`** repointed to `FlashcardDeck` with `PremiumExercise[]` mapped from `PracticeItem[]`

### 5. Progress persistence
- **`src/storage/storage.service.ts`** — added `upsertProgress(userId, exerciseId, {score})` + `listProgressByExercise(userId)`
- **`src/app/api/progress/route.ts`** (new) — `POST` creates/updates `Progress` row (`score`, `attempts`, `last_reviewed`); `GET` by `exerciseId` or all
- **`FlashcardDeck.handleAnswer`** — fires `fetch('/api/progress')` on every submission, feeding the cycles repetition queue

### 6. DB schema alignment (per spec)
- `Exercise` model unchanged (8-value `ExerciseType` enum + `options Json?` + `answer String?`)
- New fine-grained types stored via `subtype Json?` column; coarse `type` preserved for backward compat
- Migration adds `subtype Json?` + `accepted_answers Json?` (out of scope for this pass)

## Verification
- ✅ `npx tsc --noEmit` — zero `src/` errors (32 pre-existing backend NestJS decorator errors unrelated to changes)
- ✅ `npx eslint` on all touched files — zero errors, zero warnings
- ✅ `python -m pytest` in `extraction-service` — 19/19 tests pass (validation + extraction gates)
- ✅ Frontend exercise components type-check cleanly with hyphenated `ExerciseType` literals

---



---

# Completed Work — Image OCR / Vision Transcription Pipeline

Status: **done**

Fixes "nothing is detected" for image uploads (screenshots/photos of textbook pages): images never became text anywhere in the pipeline, so discovery produced zero exercises and course assembly had no lessons.

## What was implemented

1. **src/lib/llm.ts** — 	ranscribeImage(dataUrl) + isionConfigured():
   - Multimodal OpenAI-compatible call with image_url content part
   - Model: OPENCODE_VISION_MODEL (default qwen/qwen-2.5-vl-7b-instruct:free, free tier)
   - Strict OCR prompt: verbatim transcription, labels ("1a"), blanks ("______"), TIPP/GRAMMATIK boxes, [PAGE 1] framing
2. **src/app/api/extract/image/route.ts** (new) — vision-LLM transcription first; falls back to extraction service POST /extract/image (Surya). Returns { text, engine: 'vision'|'surya' }; 503 with reasons when both fail.
3. **src/lib/parse.ts** — parseAsset() for images: OCR via /api/extract/image, sets 	ext + pageCount: 1; failure keeps media-only behavior (no crash). New parseImage() helper.
4. **src/app/upload/page.tsx** — accurate empty-state message ("No text extractable — stored as media only").
5. **Extraction service** — POST /extract/image (png/jpg/webp → Surya OCR, [PAGE 1]-framed text, 415/413/503 errors), ocr.py refactored: reusable ocr_image(PIL image) shared by PDF-page OCR and the new endpoint; /health engines now report ision + surya.

## Verify

- 
 px tsc --noEmit; 
 px eslint on touched files
- Extraction service: POST /extract/image with a textbook screenshot returns German text
- E2E: upload the two textbook screenshots → discovery extracts Grammatik fill-ins + Persönlichkeitstest tasks

---

# Completed Work — Deterministic Layout-First Document Understanding Pipeline

Status: **done** — the PDF detection stack has been completely rebuilt per spec.

## Core principle

Layout analysis detects structure. LLMs only enrich already-detected blocks.

## New pipeline (LangGraph, 9 nodes, each logged with timing + confidence + retries)

    PDF Loader → Layout Detection → Block Extraction → OCR →
    Classification → Relationships → Knowledge Graph →
    Exercise Detection → Storage

### Stage 1 · PDF Loader (`layout/crops.py`)
PyMuPDF renders every page at `RENDER_DPI` (default 200): page images, embedded images (rects), text layer, coordinates. Output `PageModel {page,width,height,blocks}` — no classification here.

### Stage 2 · Layout Detection (`layout/providers/*`)
Interchangeable providers behind a `LayoutProvider` registry (`provider_order()`):

| Priority | Provider | When |
|---|---|---|
| Primary | Google Document AI | `GOOGLE_APPLICATION_CREDENTIALS` + `GOOGLE_CLOUD_PROJECT` + `DOCAI_PROCESSOR_ID` |
| Fallback | PaddleOCR PP-Structure V3 | `paddleocr` importable |
| Last-resort | Surya LayoutPredictor | installed (offline) |
| Always-available | **PyMuPDF-native** | digital text layer → deterministic ground truth; OCR-based providers engage only for scanned pages |

Every block has mandatory `bbox [x1,y1,x2,y2]` + `type` (16 types) + `confidence`. Types: `title, subtitle, paragraph, exercise, instruction, question, answer_area, image, table, header, footer, audio_reference, video_reference, page_number, caption, unknown`.

### Stage 3 · Block Extraction (`layout/crops.py`)
Crop every block independently (`page_{n:03d}_block_{idx:03d}.png`), stored as artifacts. `page_{n}.png` + `blocks/*.png` mirror the on-disk `courses/{id}/blocks/` hierarchy when MinIO is configured.

### Stage 4 · OCR per Block (`layout/ocr.py`)
Never the whole page. Priority: Google Document AI (reused from layout) → Google Vision OCR → PaddleOCR → Surya → text-layer (digital blocks never OCRed, `confidence: 1.0, engine: "text_layer"`).

### Stage 5 · Block Classification (`layout/classify.py`)
Rules first — geometry (header/footer/page_number), numbering (`1.`/`a)`→question), German imperatives (`Kreuzen Sie an.`→instruction), media cues, gap markers (`___`/`(arbeiten)`→answer_area), matching cues. Only when `confidence < CLASSIFY_LLM_MIN_CONFIDENCE` (default 0.55) and `OPENCODE_API_KEY` is set does a **bounded** LLM tie-break run (`CLASSIFY_LLM_MAX_CALLS` per doc, default 24).

### Stage 6 · Image Understanding (`layout/vision_images.py`)
Vision applied **only** to `image` blocks (max `IMAGE_VISION_MAX_PER_DOC`, default 12) → `{image_id, description, keywords}`.

### Stage 7 · Relationship Builder (`layout/relationships.py`)
Deterministic edges: `HAS_QUESTION` (instruction→question), `HAS_IMAGE`, `HAS_AUDIO`/`BELONGS_TO`, `PRECEDES` (reading order), `RELATED_TO` (geometry proximity, confidence 0.95–0.6).

### Stage 8 · Knowledge Graph (`layout/knowledge_graph.py`)
Nodes: `Lesson, Exercise, Question, Image, Audio, Video, Solution, Grammar, Vocabulary, Dialogue`. Edges: `HAS_EXERCISE, HAS_IMAGE, HAS_AUDIO, HAS_SOLUTION, RELATED_TO, BELONGS_TO`.

### Stage 9 · Exercise Type Detection (`layout/exercises.py`)
15 types with confidence: `multiple_choice, fill_blank, matching, ordering, listening, speaking, reading, writing, dialogue, image_description, grammar, vocabulary, true_false, drag_drop, open_question`. Scoring from imperatives, `a) b) c)` options, gaps, `Hören Sie/Track/Audio`, image proximity; LLM refinement only under `EXERCISE_LLM_MIN_CONFIDENCE` (0.55) bounded by `EXERCISE_LLM_MAX_CALLS` (16).

### Stage 10 · Storage (`layout/storage.py` + `layout/graph.py:node_storage`)
`DocumentBundle` persisted as structured JSON + page renders + block crops to `ARTIFACTS_DIR/{file_id}/` (or `courses/{course_id}/analysis/{file_id}/` in MinIO). Each detection has `{id, page, bbox, exercise_type, instruction, questions, images, audio}` with coordinates mandatory.

## LangGraph orchestration (`layout/graph.py`)
StateGraph with explicit nodes, `_timed` wrapper (duration_ms + confidence `{avg,min,n}`), `_with_retries` (env `NODE_RETRIES`), checkpointed (`LAYOUT_CHECKPOINT_DB` or `MemorySaver`). Heavy PIL renders kept out of checkpoint state (`_RUNTIME` side-channel per thread) — msgpack-safe. `run_layout_pipeline(pdf_path, file_id)` is the entry point; `pipeline.py:run_layout_analysis` adds `to_legacy_result` projection so both Next.js (`/extract/exercises` flashcards) and NestJS (`/extract/batch|/object` exercises/items/knowledgeGraph/quality/telemetry) keep working without schema migration.

## HTTP seams (backward-compatible)

* `POST /detect/layout` — stages 1–4 only (debugging providers/boxes)
* `POST /analyze` + `POST /analyze/object` — full bundle
* `GET  /inspect/documents` / `/inspect/documents/{id}` / `/inspect/documents/{id}/pages/{n}/image.png` / `/inspect/documents/{id}/blocks/{block_id}.png` — artifact inspector
* `POST /extract`, `/extract/batch`, `/extract/object` — now default to the layout engine (`engine=layout`; `graph`/`pipeline` accepted as `layout` aliases, `legacy_graph` for rollback)
* `GET  /api/layout-inspector/[...path]` (Next.js) — same-origin proxy for the inspector (`src/app/api/layout-inspector/[...path]/route.ts`)

## Pipeline Inspector (`src/app/developer/layout-inspector/page.tsx`)

Left: document selector (from `/inspect/documents`), page navigation, original page image with bbox overlay (colored by block type; click→select), cropped-block thumbnail grid. Right: tabbed JSON views — Layout / OCR / Classification / Relationships / Exercises / Knowledge Graph / Telemetry (timing + confidence). Selecting a block shows the detail card: coordinates, OCR text, classification (`method`, `signals`), linked exercise/image/audio via `relationships`. Every element has coordinates; reading order is column-aware and preserved.

## Transform worker (`src/lib/extraction-client.ts` + `src/lib/pipeline.ts`)

`analyzeObjectsViaLayout(assets)` (new) calls `POST /analyze/object` per PDF `objectKey` → flashcards from `legacy.flashcards` (each carries `stable_key`); `extractFlashcardsFromService` remains for text assets. `runPipeline` tries layout path first (MinIO-stored PDFs), merges text-path results, only then falls to in-app heuristics — LLM usage is minimized, determinism is preserved.

## Verify

- `extraction-service/.venv/Scripts/python -m pytest tests/test_layout_pipeline.py` — 28 tests (every stage + telemetry + artifact + adapter)
- `extraction-service/.venv/Scripts/python -m pytest tests/ -q` — 82/82 pass
- `npm run build` — succeeds; Inspector reachable at `/developer/layout-inspector` (Sidebar under Developer)
