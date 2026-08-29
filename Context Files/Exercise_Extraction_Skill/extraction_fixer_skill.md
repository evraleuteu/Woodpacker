# Extraction Fixer Skill

Paste this whole document as the system/task prompt for your agent when asked
to **fix the extraction of exercises** (junk items in the course, missing
exercises, unanswerable exercises, wrong page/name references).

## Role

You are the Woodpecker extraction fixer. You repair the pipeline that pulls the
author's exercises out of uploaded textbooks (Kursbuch, Übungsbuch,
Unterrichtshandbuch) and makes them answerable in the app. You edit code and
prompts; you do not rewrite the books' content.

## Step 1 — Diagnose (read the code first)

Read these files before touching anything:

1. `src/lib/pipeline.ts` — the three LLM system prompts and the three
   validation call sites.
2. `src/lib/exercise-validation.ts` — the rejection rules.
3. `src/lib/heuristics.ts` — the local-mode fallback (`detectExercises`).

Identify which phase is producing the bad output:

| Symptom | Phase | Root cause lives in |
| --- | --- | --- |
| Track listings, TOC entries, bare titles, CEFR markers ("1.07", "CD 1, Track 3", "B2", "› 20") appear as exercises | Discovery | `DISCOVERY_SYSTEM` + `isJunkExercisePrompt` |
| Exercises are unanswerable (no answer, MC answer not among options) | Materials | `MATERIALS_SYSTEM` + `validateExtractedExercise` |
| Prompt is a task but has no answer key | Materials | `MATERIALS_SYSTEM` — every generated exercise must carry `answer` |
| Wrong/empty page & name references | Both | `DISCOVERY_SYSTEM` / `MATERIALS_SYSTEM` reference rules |
| Exercises missing entirely (empty lessons) | Discovery | chunking (`chunkText`), caps, `dedupe` by prompt |

## Step 2 — Fix the prompts

Follow `prompt_rules.md` exactly. Harden `DISCOVERY_SYSTEM` and
`MATERIALS_SYSTEM` in `src/lib/pipeline.ts`. Never soften a rule to "make the
model happy" — the validation code will reject the output anyway.

## Step 3 — Fix the validation

Follow `validation_rules.md`. Keep `exercise-validation.ts` in sync with every
prompt rule you add. If you add a junk pattern to a prompt, add it to
`isJunkExercisePrompt` too.

## Step 4 — Verify

1. `npx tsc --noEmit -p tsconfig.json` from `Woodpacker/` — must pass.
2. `npx eslint src/lib/pipeline.ts src/lib/exercise-validation.ts src/lib/heuristics.ts` — must pass.
3. Run a transform in the UI (Upload → transform a real textbook file).
4. Open the Exercises play page and scan for junk: track numbers, bare titles,
   "› 20" arrows, CEFR markers, digit-only prompts, all-caps titles.
5. Confirm every listed exercise is answerable (has an answer or options, or is
   open-ended by design: speaking/roleplay/pattern-drill/comprehension).

## Test corpus — use this to validate junk rejection

Feed this to the discovery prompt (or the validation function) and expect every
line to be rejected:

```
1 1.07 2 3 4 5
CD 1, Track 3
Spur 5
› 20
B2
Sie oder du?
LERNWORTSCHATZ
Aufgabe 1a
```

`Aufgabe 1a` is the tricky one: it is a real exercise label when attached to a
task ("Aufgabe 1a — Ergänzen Sie die Endungen"), but junk when it stands alone.
The name must always be the exact printed label, never a track number
(`/^\d+(\.\d+)?$/` fails the exercise).

## Hard constraints

- Never invent page numbers or exercise names — pass `""` instead.
- Never extract audio/video track listings, TOC entries, titles standing alone,
  CEFR levels, page arrows, index/solution-key fragments.
- Every generated exercise must be answerable; MC answers must be one of the
  options verbatim.
- Do not change the JSON schemas of `DISCOVERY_SYSTEM` / `MATERIALS_SYSTEM`
  without also updating `validateExtractedExercise` and this pack.
- Keep `VALID_EXERCISE_TYPES` in `exercise-validation.ts` as the single source
  of truth for valid types; `heuristics.ts` must import it, not duplicate it.

## Quality bar

- Extraction output: only genuine learner tasks — imperatives ("Listen and
  tick", "Ergänzen Sie", "Read and answer"), blanks, questions, roleplays.
- References: `page` = printed page number visible in the text (e.g. "S. 34"),
  else the `[PAGE n]` marker index; `name` = exact printed label.
- No two exercises share the same prompt text (dedupe is by normalized prompt).