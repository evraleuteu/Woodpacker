# Progress Update — SaaS Readiness Audit

Status: **in_progress** (as of 2026-08-17)

Audit of what is implemented vs. what is required to make Woodpecker a fully working SaaS.

---

## What Already Works (Complete Demo Loop)

The product currently delivers an end-to-end learning loop:

- **Upload** (`/upload`) — folder upload via `webkitdirectory` + `webkitGetAsEntry` recursive scan, drag & drop, chunk upload, duplicate detection, MinIO object storage, `LearningMaterial` rows in PostgreSQL
- **Parsing** — PDF (`pdfjs-dist`), DOCX (`mammoth`), TXT, audio/video/image classification
- **AI transform** — `src/lib/pipeline.ts`: LLM discovery (`llmDiscover`), course assembly (`assembleCourse`), knowledge graph, exercise generation with validation (`src/lib/exercise-validation.ts`)
- **Course persistence** — global Course Repository (`src/lib/storage.ts` + `useCourse.ts`): localStorage + PostgreSQL JSON blob via `/api/course`; real-time cross-page/cross-tab sync via CustomEvent/storage events
- **Practice** — Duolingo-style `FlashcardDeck` (8 exercise types, listening modes, voice recording, TTS, XP/streak/badges in `woodpacker:game-stats`)
- **Pages** — Dashboard, Materials, Exercises, Language Mastery, Speaking, Accent, Cycles, Onboarding, Mastery
- **Infrastructure** — `compose.yaml` (Postgres 18, Redis 8, MinIO), Prisma schema + 3 migrations, 14 models generated to `src/generated/prisma`

---

## What Is Missing — SaaS Readiness Gaps

Priority order. Items 1–6 block a public launch; 7–10 are required for production quality.

### 1. Authentication (BLOCKING — none exists)

- No signup/login, no middleware, no session handling
- Every API call uses a hardcoded local user (`src/storage/storage.service.ts:424` → `local@woodpacker.local`)
- All users would share one account; zero data isolation
- `TECHNICAL_STACK.md` §16 specifies Clerk; nothing is wired
- No auth on any `/api/*` route; any request can read/write the local user's courses

### 2. Background Job Processing (BLOCKING)

- BullMQ + ioredis are installed but **never used**
- `src/lib/pipeline.ts:11` keeps jobs in an in-memory `Map` — a server restart kills in-flight transforms; no retries, no idempotency, no recovery (violates `TECHNICAL_STACK.md` rules 8–13)
- Long-running transforms run inside the Next.js API request path

### 3. Payments & Plan Gating (BLOCKING)

- No Stripe, no checkout, no webhooks
- `subscription_plan` enum (free/plus/premium) exists in schema but is never enforced
- `PAYMENT_MODEL.md` tiers (Free/Pro/Mastery/Institution) have no feature gating or quota limits (upload count, active programs, speaking limits)

### 4. Real Structured Persistence (BLOCKING for multi-user)

- Courses stored as a JSON blob in the `Course.data` column + localStorage
- `Progress`, `SpeakingSession`, `SpeakingAttempt`, `PatternMastery`, `WoodpeckerCycle` tables exist but are unused
- XP/streak/daily goal persist only in localStorage (`woodpacker:game-stats`) — no cross-device sync, no server-side source of truth
- No per-user query layer on the API routes

### 5. Speaking / Accent Engine (core differentiator — unimplemented)

- Only Chrome `webkitSpeechRecognition` with no scoring; `VoiceRecorder` records audio but nothing analyzes it
- No pronunciation / fluency / grammar / accent scoring, no "Speak Until Mastered" engine (roadmap Phase 3–4)
- No audio upload → analysis pipeline (Flow 4 — Accent Learning)

### 6. OCR & Audio Transcription

- Scanned PDFs and MP3/WAV lesson audio cannot be processed (no OCR, no STT)
- Listening exercises cannot be generated from the most common textbook formats

### 7. Observability & Analytics

- No Sentry (`TECHNICAL_STACK.md` §16), no PostHog, no error tracking in workers
- No `PostHog` events for upload/processing/exercise/session completion

### 8. Deployment & CI/CD

- No production deployment config, no Dockerfile for the app, no CI pipeline
- No managed Postgres/Redis/MinIO/R2 provisioning; no production env setup
- `README.md` is still the default create-next-app template

### 9. Missing Backend Layer (documented but absent)

- `backend/` is empty — the documented NestJS API was never created
- All orchestration lives in Next.js API routes (`/api/upload`, `/api/course`, `/api/materials`, `/api/transform`)

### 10. Secondary Gaps

- No pgvector semantic search / embeddings (tables not in schema)
- No ZIP bundle upload support (PRD lists ZIP as a supported input)
- No email/notifications, no webhooks, no rate limiting
- TTS is browser-dependent (`speechSynthesis`) — no server TTS
- `MAX_FILES = 24` hard cap in `/api/upload`
- No institution/admin dashboards (roadmap Phase 7)

---

## Definition of "Fully Working SaaS"

Launch gate: items 1–4 done (auth + durable jobs + payments + per-user persistence), speaking/accent engine (5) functioning for at least Chrome, OCR/STT (6) covering PDF + MP3, observability (7), and a deployable production setup (8).

---