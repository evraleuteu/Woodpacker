# Exercise Classifier

## Purpose

Identify learning activity types and map them to the flashcard deck.

## Exercise Types (implemented — `VALID_EXERCISE_TYPES`)

The app implements exactly these 8 types (`src/lib/exercise-validation.ts`):

| Type | Challenge title | XP | Practice dimension |
| --- | --- | --- | --- |
| `translation` | Write this sentence | 15 | vocabulary |
| `multiple-choice` | Choose the correct answer | 10 | grammar |
| `fill-blank` | Complete the sentence | 12 | grammar |
| `recall` | Which word means this? | 10 | vocabulary |
| `pattern-drill` | Match the sentence pattern | 12 | grammar |
| `roleplay` | Say it aloud | 15 | speaking |
| `comprehension` | Read and answer | 8 | reading |
| `assessment` | Apply what you learned | 20 | other |

XP +5 bonus for perfect (first-try) answers.

## Practice Dimensions

- vocabulary
- grammar
- listening
- speaking
- reading
- other

Dimensions drive XP/badge attribution and the Cycles practice plan
(`src/lib/plan.ts`). The Cycle Progression drills every practice item 5 times
(30 → 15 → 7 → 3 → 1 day intervals).

## Speaking exercise types (roadmap)

Audio Recall, Pattern Mastery, Voice Response, Read Aloud, Shadowing, Roleplay,
Monologue, Retelling — roadmap targets. Currently speaking is covered by
`roleplay` (VoiceRecorder) and TTS-driven listening drills.

## General Learning

- Recall
- Concept Understanding
- Application
- Problem Solving
- Case Study

## Accent Learning

- Pronunciation
- Stress
- Intonation
- Rhythm
- Shadowing

## Output

Extracted exercises must pass `validateExtractedExercise` before entering a
course. See `Context Files/Exercise_Extraction_Skill/` (validation_rules.md)
for the rejection gates.

```json
{
  "type": "fill-blank",
  "prompt": "Ergänzen Sie die Endungen: Er ___ gestern ___ Hause.",
  "answer": "war … zu",
  "page": "S. 34",
  "name": "Aufgabe 5a"
}
```

## References

- `src/lib/exercise-validation.ts` — types + validation
- `src/lib/exercise-config.ts` — type → title/XP/dimension/emotion
- `src/lib/types/exercise.ts` — `PremiumExercise`, `GameStats`, `Badge`
- `Context Files/FLASHCARD_CHARACTERISTICS.md` — deck behavior per type