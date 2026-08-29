# Exercise Extraction Skill Pack — Index

Skill pack for **fixing the extraction of exercises** in the Woodpecker pipeline.
Use these files as agent instructions (Claude Code, a Claude Project, or any AI
agent with file access to the repo). They complement
`agent_prompt_flashcard_generator.md` (which generates *new* flashcards) — this
pack fixes the *extraction* of the author's exercises from uploaded materials.

## Files in this pack

| File | Use when |
| --- | --- |
| `extraction_fixer_skill.md` | You are asked to fix or debug exercise extraction. Full workflow: diagnose → fix prompts → fix validation → verify. |
| `prompt_rules.md` | You are editing the LLM system prompts in `src/lib/pipeline.ts` (`DISCOVERY_SYSTEM`, `MATERIALS_SYSTEM`). Canonical prompt rules. |
| `validation_rules.md` | You are editing `src/lib/exercise-validation.ts` or adding rejection rules. Canonical validation spec. |

## Pipeline map — where extraction happens

```
upload → sanitizeAssets (src/lib/pipeline.ts)
        → DISCOVERY_SYSTEM  (pipeline.ts:67)     extracts exercises, requireAnswer:false (validation call at :143)
        → llmReconstruct    (RECONSTRUCT_SYSTEM)  matches chapters/files — no exercise content
        → MATERIALS_SYSTEM  (pipeline.ts:201)    generates answerable exercises, requireAnswer:true (validation call at :307)
        → heuristic fallback (src/lib/heuristics.ts detectExercises, call site pipeline.ts:367, requireAnswer:false)
        → validateExtractedExercise (src/lib/exercise-validation.ts)
        → lesson.exercises in the course → play page (src/app/exercises/[id]/play)
```

## Key files

- `Woodpacker/src/lib/pipeline.ts` — the three LLM prompts and the three validation call sites (lines 143, 307, 367).
- `Woodpacker/src/lib/exercise-validation.ts` — `validateExtractedExercise`, `isJunkExercisePrompt`, `VALID_EXERCISE_TYPES`.
- `Woodpacker/src/lib/heuristics.ts` — local-mode `detectExercises` / `classifyExercise` (heuristic path must respect the same junk rules).

## Golden rule

**The prompt rules and the validation code must agree.** Every junk pattern the
prompts tell the model to avoid must also be rejected by
`isJunkExercisePrompt`/`validateExtractedExercise`, and vice versa. If a fix
only touches one side, extraction is still broken.

## Verification (always run after a fix)

From `Woodpacker/`:

```bash
npx tsc --noEmit -p tsconfig.json
npx eslint src/lib/pipeline.ts src/lib/exercise-validation.ts src/lib/heuristics.ts
```

Then re-run a course transform in the UI (Upload page) and check the Exercises
play page for junk items (track numbers, titles, page arrows, level markers).

## Status vocabulary

`todo | in_progress | blocked | done` — record completed work in
`Context Files/OBJECTIVE.md`.