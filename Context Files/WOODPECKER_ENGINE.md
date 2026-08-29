# Woodpecker Engine

## Purpose

Convert extracted knowledge into mastery cycles.

## Standard Cycles

- Cycle 1 — 30 Days
- Cycle 2 — 15 Days
- Cycle 3 — 7 Days
- Cycle 4 — 3 Days
- Cycle 5 — 1 Day

## Generated Sessions

Includes:
- Vocabulary
- Grammar
- Listening
- Speaking
- Accent
- Recall
- Pattern Mastery
- Audio Recall
- Voice Response

## Adaptive Mode

The system increases repetition for weak areas.

## Speak Until Mastered

Speaking exercises require:
- Pronunciation score ≥ 90%
- Grammar accuracy ≥ 95%
- Fluency score ≥ 85%
- Correct meaning conveyed

Only after meeting all criteria does the exercise advance to the next cycle.

## Implemented Cycles (Current Code)

The Cycles system is implemented in `src/lib/cycles.ts`,
`src/lib/plan.ts` and `src/app/cycles/`:

- **5 cycles**, durations 30 / 15 / 7 / 3 / 1 days (`CYCLE_DURATIONS`), with
  progressive support reduction: full support (audio + transcript + hints) →
  audio + keywords → audio only → question only, no audio → full spontaneous,
  no hints (`CYCLE_SUPPORT`).
- **Practice plan** (`buildPracticePlan`): items from vocabulary, grammar,
  reading, listening, hearing and speaking dimensions, with per-dimension
  daily quotas and estimated minutes.
- **Lock/unlock progression** (`cycleStates`, `cycleComplete`): a cycle unlocks
  only when every item of the previous cycle is done; failed or skipped items
  return to the end of the queue until answered correctly.
- **Persistence**: per-item progress in localStorage via `loadCyclesProgress` /
  `saveCyclesProgress` (`src/lib/storage.ts`).
- **Cycles pages**: `/cycles` (practice dimensions + overview tabs),
  `/cycles/[cycle]` (session card + item list + next-cycle unlock bar).
- Cycle sessions render through `ExerciseSession` (legacy variant) —
  the exercises play page uses the new `FlashcardDeck` (see
  `FLASHCARD_CHARACTERISTICS.md`).