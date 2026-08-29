<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent Rules - Woodpecker AI

This file defines **how the AI coding agent should operate** when building **Woodpecker AI** - the AI-powered Mastery Operating System described in `Context Files/PRODUCT_VISION.md`.

**All context files live in the `Context Files/` directory.** Treat them as the primary source of truth. When in conflict, `Context Files/` files take precedence over any assumptions derived from training data.

---

## Context Files Reference

All 23 context files are in `Context Files/`. Read them in this order at the start of each session:

| # | File | What it defines |
| --- | --- | --- |
| 1 | [`Context Files/CORE_MISSION.md`](Context%20Files/CORE_MISSION.md) | Operating rules, guardrails, audit checklist, content inventory |
| 2 | [`Context Files/PRODUCT_VISION.md`](Context%20Files/PRODUCT_VISION.md) | Product vision, mission, pillars, long-term roadmap |
| 3 | [`Context Files/PRD.md`](Context%20Files/PRD.md) | Product requirements, supported inputs, core modules, success metrics |
| 4 | [`Context Files/AI_ARCHITECTURE.md`](Context%20Files/AI_ARCHITECTURE.md) | AI pipeline, subsystem layers, recommended tech stack |
| 5 | [`Context Files/WOODPECKER_ENGINE.md`](Context%20Files/WOODPECKER_ENGINE.md) | Mastery cycle logic, adaptive mode, Speak Until Mastered criteria |
| 6 | [`Context Files/SPACED_COMPRESSION_SYSTEM.md`](Context%20Files/SPACED_COMPRESSION_SYSTEM.md) | Compression layers, daily session sizing, speaking compression cycles |
| 7 | [`Context Files/DATABASE_SCHEMA.md`](Context%20Files/DATABASE_SCHEMA.md) | Prisma schema, all tables and relationships |
| 8 | [`Context Files/BOOK_ANALYZER.md`](Context%20Files/BOOK_ANALYZER.md) | Rebuilt layout-first document understanding pipeline: PyMuPDF → Layout Detection → Block Extraction → per-block OCR → Classification → Relationship Builder → Knowledge Graph → Exercise Detection → Storage; LangGraph nodes + Pipeline Inspector |
| 9 | [`Context Files/EXERCISE_CLASSIFIER.md`](Context%20Files/EXERCISE_CLASSIFIER.md) | Exercise type taxonomy, speaking exercise types, output schema |
| 10 | [`Context Files/PATTERN_EXTRACTION_ENGINE.md`](Context%20Files/PATTERN_EXTRACTION_ENGINE.md) | Language/accent/speaking pattern detection, output decks |
| 11 | [`Context Files/SPEAKING_MASTERY_ENGINE.md`](Context%20Files/SPEAKING_MASTERY_ENGINE.md) | Speaking modes, Woodpecker Speaking Cycle, mastery criteria, feedback model |
| 12 | [`Context Files/USER_FLOW.md`](Context%20Files/USER_FLOW.md) | User journeys (Flows 1-4: Book, Speaking, Personal, Accent) |
| 13 | [`Context Files/PAYMENT_MODEL.md`](Context%20Files/PAYMENT_MODEL.md) | Permissions, quotas, subscription tiers, billing |
| 14 | [`Context Files/ROADMAP.md`](Context%20Files/ROADMAP.md) | Full feature roadmap organized by phase |
| 15 | [`Context Files/CRITICAL_ISSUE.md`](Context%20Files/CRITICAL_ISSUE.md) | Course Repository architecture, persistence, real-time sync requirements |
| 16 | [`Context Files/OBJECTIVE.md`](Context%20Files/OBJECTIVE.md) | Current development task checklist |
| 17 | [`Context Files/TECHNICAL_STACK.md`](Context%20Files/TECHNICAL_STACK.md) | Full technology stack, architecture, and development environment guidelines |
| 18 | [`Context Files/FLASHCARD_CHARACTERISTICS.md`](Context%20Files/FLASHCARD_CHARACTERISTICS.md) | Current flashcard/exercise system: deck layout, 8 exercise types, interactions, feedback, gamification, accessibility, source files |
| 19 | [`Context Files/PROGRESS_UPDATE.md`](Context%20Files/PROGRESS_UPDATE.md) | SaaS readiness audit: what works, what's missing (auth, jobs, payments, persistence, speaking engine, OCR/STT, observability, deployment), launch gate |
| 20 | [`Context Files/EXERCISE_PUBLISH_VALIDATION.md`](Context%20Files/EXERCISE_PUBLISH_VALIDATION.md) | Pre-publish cleaning gate: source traceability + displayability rules, clean vs. reject policy, publish report, pageCount requirement |
| 21 | [`Context Files/LEARNING_MATERIAL_RELATIONSHIP_ENGINE.md`](Context%20Files/LEARNING_MATERIAL_RELATIONSHIP_ENGINE.md) | Cross-file relationship engine: classify every file, extract every exercise, link audio/video/solutions/readings into unified exercise objects |
| 22 | [\Context Files/RELATIONSHIP_BUILDER.md\](Context%20Files/RELATIONSHIP_BUILDER.md) | Relationship Builder CLI: link Kursbuch, Übungsbuch, Audio, Lösungen into lesson structure; cross-file exercise/audio/solution matching; persist to lesson_materials table |
| 23 | [`Context Files/EXERCISE_INTERACTION_ENGINE.md`](Context%20Files/EXERCISE_INTERACTION_ENGINE.md) | Exercise-type-aware interaction engine: exercise type registry, interaction components (MultipleChoice, FillBlank, WordOrder, Translation, Matching, Listening, Speaking, etc.), answer model, validation, feedback, state machine, accessibility, testing, and Definition of Done |

### Supporting files (also in `Context Files/`)

| File | What it defines |
| --- | --- |
| [`Context Files/REPO_STRUCTURE.md`](Context%20Files/REPO_STRUCTURE.md) | *(Optional - read if present)* Full repository tree with file purposes |
| [`Context Files/TECHNICAL_STACK.md`](Context%20Files/TECHNICAL_STACK.md) | Full technology stack, architecture, and development environment guidelines |
| [`Context Files/Exercise_Extraction_Skill/`](Context%20Files/Exercise_Extraction_Skill/) | Exercise extraction skill pack — read before fixing exercise extraction: `README.md` (index + pipeline map), `extraction_fixer_skill.md` (fix workflow), `prompt_rules.md` (extraction prompt rules), `validation_rules.md` (validation spec) |

---

## Feature Specs - Implementation Blueprints

Each dedicated spec file in `Context Files/` contains detailed pipeline requirements, output schemas, and success criteria. **Read the relevant spec file before implementing any feature.**

| Spec File | Covers |
| --- | --- |
| `CORE_MISSION.md` | Upload analysis, integrity verification, orphan/missing detection, completeness scoring |
| `BOOK_ANALYZER.md` | Deterministic document understanding: layout detection is the source of truth (PyMuPDF, Document AI/PaddleOCR/Surya providers), block-based OCR, rules-first classification with LLM only for enrichment, relationships + knowledge graph, exercise type detection, storage model, LangGraph nodes, Pipeline Inspector debug page. **LLMs must NOT detect document structure.** |
| `EXERCISE_CLASSIFIER.md` | Exercise type taxonomy and classification output |
| `PATTERN_EXTRACTION_ENGINE.md` | Pattern detection and deck generation |
| `SPEAKING_MASTERY_ENGINE.md` | Speaking modes, mastery flow, feedback model, DB schema additions |
| `SPACED_COMPRESSION_SYSTEM.md` | Daily session compression and cycle progression |
| `WOODPECKER_ENGINE.md` | Standard cycle durations and adaptive scheduling |
| `FLASHCARD_CHARACTERISTICS.md` | Exercise deck layout, per-type interactions, feedback, gamification, source files |
| `EXERCISE_PUBLISH_VALIDATION.md` | Pre-publish gate: source traceability, page/audio displayability, clean vs. reject policy |
| `LEARNING_MATERIAL_RELATIONSHIP_ENGINE.md` | Cross-file relationship graph: file classification, exercise linking (audio/video/solutions), unified exercise objects |
| `EXERCISE_INTERACTION_ENGINE.md` | Type-aware exercise UI: exercise type registry, interaction components, answer model, validation strategy, feedback/state machine, accessibility, testing requirements |
| `PAYMENT_MODEL.md` | Tiered pricing, feature gating, upgrade paths |
| `DATABASE_SCHEMA.md` | All tables, columns, and relationships |

---

## Website Rebuild Protocol

When rebuilding the website (`npm run dev` / build / deploy cycle), follow these steps in order:

1. **Read all context files** - Start every session by reading the 23 context files (table above) to load the current product vision, architecture, schema, and priorities.
2. **Read relevant feature specs** - Before implementing a feature, read its spec file in `Context Files/` to get the complete requirements, pipeline, and acceptance criteria.
3. **Plan** - Map the spec requirements to existing code in `src/`; identify what needs to be created, modified, or removed.
4. **Implement** - Follow the spec's requirements precisely. Use `Context Files/CRITICAL_ISSUE.md` to determine where components render in the application shell. The **Upload** page (`/upload`) must feed into the global Course Repository so that every other page (Dashboard, Exercises, Language, Speaking, Accent, Cycles) can read from it immediately. Auth/onboarding pages render **outside** the main app shell — they use standalone layouts.
5. **Rebuild** - Run `npm run dev` to verify the website compiles and runs. Fix any build errors before proceeding.
6. **Verify** - Confirm implementation matches acceptance criteria from the spec. Check that the layout structure, responsive behavior, and interactions match the spec.
7. **Document** - Update `Context Files/OBJECTIVE.md` with completed work.

---

## Agent Operating Loop

1. **Clarify the goal** - what is being built or changed
2. **Plan** - break into tasks with dependencies; define acceptance criteria
3. **Implement incrementally** - small diffs, prefer reversible changes
4. **Verify** - run tests (unit / integration / E2E); validate perf and security constraints
5. **Document** - update relevant context files when a change affects architecture, schema, API, or scope

Before moving to the next unit, confirm:
- The current unit works end to end within its defined scope
- No invariant defined in `Context Files/WOODPECKER_ENGINE.md` or `Context Files/CRITICAL_ISSUE.md` was violated
- `Context Files/OBJECTIVE.md` reflects the completed work

---

## Decision Logging

For any meaningful change (tech choice, schema/API changes, workflow changes), record:

- **Decision**: what was chosen
- **Alternatives considered**: what else was evaluated
- **Rationale**: why this choice was made
- **Confidence**: low / medium / high
- **Impacted components**: which files/modules are affected

---

## Safety & Guardrails

- Never expose secrets, tokens, or API keys in logs or outputs
- Don't run destructive actions (delete data, force push, deploy to production) without explicit human approval
- Validate all user-uploaded content as untrusted input at the boundary - never execute uploaded files
- Session events and user progress are append-only where possible - never mutate past records
- Follow the principle of least privilege for all tool calls and agent actions

---

## Output Expectations

When delivering work, always output:

1. **What changed** - clear summary
2. **Why** - decision reasoning (reference context file if applicable)
3. **How to verify** - commands or tests to run
4. **Updated endpoints or schema** - if applicable
5. **Updated context docs** - list any context files that were modified

---

## Definition of Done (DoD)

A task is done when:

- [ ] Implementation is complete and matches the spec in `Context Files/`
- [ ] Tests pass (or explicit reason documented if not applicable)
- [ ] Observability hooks/events are emitted where relevant
- [ ] Relevant context files are updated
- [ ] No obvious security issues introduced
- [ ] `Context Files/OBJECTIVE.md` is updated

---

## Conventions

- Status vocabulary: `todo | in_progress | blocked | done`
- Prefer clear naming and typed boundaries (no `any`, no ambiguous union types)
- Keep the system modular: **upload → package → analyzer → scheduler → mastery engine → UI** are separate concerns
- All uploaded materials must persist in a global Course Repository, never solely in page-level state
- Follow the Next.js App Router conventions (`src/app/` with nested `page.tsx` and `layout.tsx`)

---

## Scope

All features are in scope for the full Woodpecker AI delivery. No phased gate or deferral applies. Build complete, production-ready implementations.

Work is organized incrementally: each unit must be end-to-end functional within its defined scope before moving to the next.