# Prompt Rules — Extraction System Prompts

Canonical rules for `DISCOVERY_SYSTEM` and `MATERIALS_SYSTEM` in
`src/lib/pipeline.ts`. Every rule below must also exist as a code-level check in
`src/lib/exercise-validation.ts` (see `validation_rules.md`).

## Junk that is NEVER an exercise

The model must skip these, always:

- Audio/video CD track listings: `"1.07"`, `"CD 1"`, `"CD 1, Track 3"`,
  `"Spur 5"` — including any line whose `name` matches `/^\d+(\.\d+)?$/`.
- Table-of-contents entries.
- Chapter or activity titles standing alone (e.g. `"Sie oder du?"`).
- CEFR level markers (`A1`, `B2`, `C1`) and standalone level labels
  (`LERNWORTSCHATZ`).
- Page references and page arrows (`"› 20"`, `"S. 34"` as a standalone line).
- Index or solution-key fragments.
- Lines with no letters, digit-only sequences, or `›` anywhere in the prompt.

A line is an exercise only if it gives the learner an actual task:
imperatives ("Listen and tick", "Ergänzen Sie", "Read and answer"), blanks,
questions, roleplays.

## References — page and name

- `page`: the printed page number visible in that page's text (e.g.
  `"Kursbuch S. 34"` or just `"S. 34"`); if no printed number is visible, use
  the `[PAGE n]` marker index (e.g. `"S. 34"` from `[PAGE 34]`).
- `name`: the exercise label EXACTLY as printed (`"Aufgabe 5a"`, `"Übung 3b"`,
  `"Exercise 1"`, `"1b"`). Never invent names. A `name` that is a plain number
  is a track listing — reject the exercise.
- If an exercise has no counterpart in the source, `page` and `name` are `""`,
  never invented.

## Answerability (MATERIALS_SYSTEM only)

Every generated exercise must be answerable:

- Required answer types: `fill-blank`, `multiple-choice`, `translation`,
  `recall` — these MUST carry a non-empty `answer`.
- `multiple-choice`: exactly 4 options, the answer MUST be one of the options
  verbatim (no "all of the above", no answer not present in the list), and no
  two options may be duplicates.
- Open-ended types (`pattern-drill`, `roleplay`, `comprehension`,
  `assessment`) do not need an answer key.
- Discovery (`DISCOVERY_SYSTEM`) may emit exercises without answers — the
  source may not expose them. Never fabricate an answer at discovery time.

## Content fidelity

- Use ONLY vocabulary, grammar, and content from the lesson blueprint and
  source material. Do not invent new topics.
- Exercises must reflect what the author intended for the chapter.
- Keep caps: discovery 25 exercises/lesson-chunk, materials 20 exercises.
- Discovery dedupes by normalized prompt — avoid near-duplicate prompts.

## Schema (must match the code's expectations)

Discovery exercise object:

```json
{ "type": "string", "prompt": "string", "page": "string", "name": "string" }
```

Materials exercise object:

```json
{
  "type": "fill-blank|multiple-choice|translation|recall|pattern-drill|roleplay|comprehension|assessment",
  "prompt": "string",
  "answer": "string",
  "options": ["string"],
  "page": "string",
  "name": "string"
}
```

`type` values are exactly `VALID_EXERCISE_TYPES` from `exercise-validation.ts`.
If a type is added or removed in code, update these prompts in the same change.

## Sync invariant

For every new "never an exercise" rule added here, add the matching check to
`isJunkExercisePrompt` / `validateExtractedExercise`. A rule that lives only in
the prompt will eventually be violated; a rule that lives only in code rejects
legitimate items the model was told to extract.