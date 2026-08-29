# Validation Rules — exercise-validation.ts

Canonical spec for `src/lib/exercise-validation.ts`. The code is the single
source of truth; this document explains each gate so prompts (`prompt_rules.md`)
and code stay in sync.

## Entry points

- `isJunkExercisePrompt(prompt)` — cheap pre-filter, applied inside
  `validateExtractedExercise` and reused anywhere prompts are screened.
- `validateExtractedExercise(raw, { requireAnswer })` — full validation.
  `requireAnswer:false` at discovery (pipeline.ts:143) and heuristic fallback
  (pipeline.ts:367); `requireAnswer:true` at materials generation
  (pipeline.ts:307).

## Rejection gates (in order)

| Gate | Condition | Failure reason |
| --- | --- | --- |
| Type | `type` not in `VALID_EXERCISE_TYPES` | `invalid-type:<value>` |
| Prompt empty | no prompt after trim | `empty-prompt` |
| Prompt length | `< 8` or `> 2000` chars | `prompt-too-short` / `prompt-too-long` |
| Page marker | prompt contains `[PAGE n]` | `contains-page-marker` |
| Junk pattern | `isJunkExercisePrompt` true | `junk-prompt` |
| Letters | `< 2` letters (incl. accented) | `no-letters` |
| All-caps title | no lowercase letters and length `< 40` | `all-caps-title` |
| Track-number name | `name` matches `/^\d+(\.\d+)?$/` | `track-number-name:<name>` |
| Page without number | `page` non-empty but no digit | `page-without-number` |
| Missing answer | `requireAnswer` and type in `REQUIRED_ANSWER_TYPES` and no answer | `missing-answer` |
| Answer too long | fill-blank `> 150` chars, others `> 800` | `answer-too-long:<type>` |
| MC options | `< 2` options (after strip, max 6 kept) | `too-few-options` |
| Duplicate options | normalized options not all distinct | `duplicate-options` |
| MC answer mismatch | answer not among options (exact or prefix match) | `answer-not-in-options` |

## Junk prompt patterns (`isJunkExercisePrompt`)

Reject a prompt when it:

- contains `›` (page arrow)
- starts with a sequence of 3+ numbers: `^\s*\d+(\.\d+)?(\s+\d+(\.\d+)?){2,}\b`
  (e.g. `"1 1.07 2 3 4 5"`)
- starts with `cd`, `track`, or `spur` (case-insensitive), optionally `cd 1`
- consists only of digits/whitespace/punctuation: `^[\d\s.,:;()\-–—]+$`
- is empty

## Cleanup the validator performs

- `stripMarkdown`: removes `**bold**`, `__bold__`, backtick code, `*italic*`.
- `normalize`: trim, lowercase, collapse whitespace, strip leading
  `a) ` / `b. ` style letters — used for MC answer/option comparison.
- MC answers are rewritten to the exact option string that matched.
- References are trimmed, capped (`name` 60 chars, `page` 30 chars), and
  control characters removed.

## Sync invariants

1. `VALID_EXERCISE_TYPES` is the single source of truth for valid types.
   `heuristics.ts` and the prompts must use/name exactly these values.
2. `REQUIRED_ANSWER_TYPES` (`fill-blank`, `multiple-choice`, `translation`,
   `recall`) is the single source of truth for which types need an answer.
   `MATERIALS_SYSTEM` must list exactly these as "must carry answer".
3. Every junk pattern in `prompt_rules.md` must appear here, and vice versa.

## Extending validation

When adding a gate:

1. Add the check in `validateExtractedExercise` with a unique failure reason
   string (kebab-case).
2. Mirror it in the appropriate system prompt (`prompt_rules.md` + the prompt
   constant in `pipeline.ts`).
3. Add the new junk pattern to `isJunkExercisePrompt` if it is a prompt-level
   pattern.
4. Verify with the test corpus from `extraction_fixer_skill.md` — every junk
   sample must produce `valid:false` with the expected reason.