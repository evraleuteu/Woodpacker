# Woodpecker Speaking Engine

## Purpose

Transform passive learning material into automatic spoken production using structured Woodpecker repetition.

Unlike generic AI conversation apps, every speaking exercise is generated directly from the learner's uploaded material.

The goal is not to chat with AI.

The goal is to repeatedly produce language from the user's own textbooks, dialogues, listening exercises, grammar lessons, vocabulary lists, and course materials until speaking becomes automatic.

---

# Core Principle

Every speaking exercise originates from the user's learning material.

The AI does not generate random conversation topics.

Instead, the AI extracts knowledge from:

* Textbooks
* Dialogues
* Vocabulary Lists
* Grammar Lessons
* Listening Exercises
* Reading Passages
* Workbook Exercises

and converts them into structured speaking activities.

---

# System Architecture

```text
Uploaded Material
        │
        ▼
Knowledge Extraction Engine
        │
        ▼
Knowledge Units
        │
        ▼
Speaking Engine
        ├── Audio Recall
        ├── Pattern Mastery
        └── Voice Response + AI Feedback
        │
        ▼
Speak Until Mastered
        │
        ▼
Woodpecker Scheduler
        │
        ▼
Adaptive Repetition Cycles
```

---

# Knowledge Extraction Layer

The system first converts uploaded learning material into reusable knowledge units.

## Extracted Components

### Vocabulary Units

Example:

```text
Pizza
Wasser
Kaffee
Salat
```

### Grammar Patterns

Example:

```text
Ich möchte...
Ich hätte gern...
Könnten Sie...
```

### Dialogue Segments

Example:

```text
Kunde:
Ich hätte gern eine Pizza.

Kellner:
Möchten Sie etwas trinken?
```

### Listening Segments

Example:

```text
Anna fährt morgen nach Berlin.
```

### Question-Answer Pairs

Generated automatically from the material.

Example:

```text
Question:
Wohin fährt Anna?

Answer:
Nach Berlin.
```

These units become the foundation of all speaking exercises.

---

# Speaking Engine

The Speaking Engine contains three integrated training modes.

---

# Mode 1 — Audio Recall

## Purpose

Develop listening comprehension and verbal recall.

The learner listens first and then recalls information aloud.

---

## Example

Audio:

> Anna fährt morgen nach Berlin.

AI pauses.

Question:

> Wohin fährt Anna?

Learner answers:

> Sie fährt morgen nach Berlin.

---

## AI Evaluation

The system evaluates:

* Meaning Accuracy
* Grammar
* Pronunciation
* Fluency

---

## If Incorrect

The system:

1. Explains the mistake
2. Replays the original audio
3. Repeats the question
4. Requires another attempt

The learner continues until mastery is achieved.

---

## Why It Works

This directly applies the Woodpecker Method.

The learner repeatedly recalls the same information until retrieval becomes effortless.

---

# Mode 2 — Pattern Mastery

## Purpose

Develop automatic sentence production.

Instead of memorizing isolated words, learners master reusable language structures.

---

## Source Material Example

Textbook Pattern:

```text
Ich möchte...
```

---

## Generated Exercises

Prompt:

> Complete the sentence.

Learner:

> Ich möchte einen Kaffee.

Next:

> Ich möchte Deutsch lernen.

Next:

> Ich möchte nach München fahren.

---

## Independent Production

Eventually:

> Create your own sentence using "Ich möchte..."

Learner creates original examples.

---

## Pattern Tracking

Each pattern receives:

* Mastery Score
* Automaticity Score
* Total Repetitions
* Next Review Date

The system tracks long-term speaking ability for every language structure.

---

# Mode 3 — Voice Response

## Purpose

Develop active spoken communication.

The learner responds to prompts derived from the uploaded material.

---

## Example

Prompt:

> Was machen Sie normalerweise am Wochenende?

Learner:

> Ich spiele Fußball mit meine Freunde.

---

## AI Analysis

The system evaluates:

* Grammar
* Vocabulary
* Pronunciation
* Fluency
* Naturalness
* Confidence
* Meaning Accuracy

---

## Feedback Example

### Learner Answer

> Ich spiele Fußball mit meine Freunde.

### Correction

> Ich spiele Fußball mit meinen Freunden.

### Explanation

Use the dative plural after "mit".

---

## Repetition Loop

The learner repeats the corrected sentence until it is produced correctly.

---

# Combined Learning Sequence

Example lesson:

## Restaurant Lesson

### Step 1 — Listen

Audio:

> Ich hätte gern eine Pizza.

---

### Step 2 — Recall

Question:

> Was möchte der Kunde?

Learner answers aloud.

---

### Step 3 — Pattern Practice

Pattern:

```text
Ich hätte gern...
```

Learner produces:

* Ich hätte gern Wasser.
* Ich hätte gern einen Salat.
* Ich hätte gern einen Kaffee.

---

### Step 4 — Voice Response

Prompt:

> Bestellen Sie Ihr Abendessen.

Learner responds freely.

AI provides corrections.

---

### Step 5 — Repeat

The same content reappears in future Woodpecker cycles with progressively less support.

---

# AI Feedback Model

Feedback should never be limited to "Correct" or "Incorrect".

Every attempt receives structured analysis.

| Dimension        | Score | Guidance                                          |
| ---------------- | ----- | ------------------------------------------------- |
| Pronunciation    | 0–100 | The "ch" sound in *ich* needs to be softer.       |
| Grammar          | 0–100 | Use the dative: *mit meinen Freunden*.            |
| Vocabulary       | 0–100 | A more natural expression is *Ich hätte gern...*. |
| Fluency          | 0–100 | Try speaking without pauses.                      |
| Naturalness      | 0–100 | This sounds slightly formal.                      |
| Confidence       | 0–100 | Speak a little louder and maintain a steady pace. |
| Meaning Accuracy | 0–100 | The intended meaning was correctly conveyed.      |
| Pattern Usage    | 0–100 | Good use of the target structure.                 |

---

# Speak Until Mastered

Speaking exercises are not completed after a single correct attempt.

Instead, learners repeat until mastery criteria are achieved.

---

## Mastery Requirements

| Metric           | Threshold |
| ---------------- | --------- |
| Pronunciation    | ≥ 90%     |
| Grammar          | ≥ 95%     |
| Fluency          | ≥ 85%     |
| Meaning Accuracy | 100%      |

Only then can the learner progress.

---

## Mastery Flow

```text
Attempt
    ↓
AI Evaluation
    ↓
Pass?
 ├── Yes → Advance To Next Cycle
 │
 └── No
        ↓
Feedback
        ↓
Correction
        ↓
Repeat Attempt
        ↓
AI Evaluation
        ↓
Repeat Until Mastered
```

If performance drops during later reviews, the exercise automatically returns to active practice.

---

# Woodpecker Speaking Cycle

The same speaking content is repeated with progressively reduced support.

## Cycle 1 — Full Support

* Audio
* Transcript
* Translation
* Hints

Review Interval:

```text
30 Days
```

---

## Cycle 2 — Guided Recall

* Audio
* Keywords Only

Review Interval:

```text
15 Days
```

---

## Cycle 3 — Audio Only

* Audio
* No Transcript

Review Interval:

```text
7 Days
```

---

## Cycle 4 — Question Only

* No Audio
* No Transcript

Review Interval:

```text
3 Days
```

---

## Cycle 5 — Real-Life Production

* Scenario Based
* No Hints
* Fully Spoken Response

Review Interval:

```text
1 Day
```

The learner repeatedly produces the same language until speaking becomes automatic.

---

# Speaking Sources

Every speaking exercise is generated from uploaded learning material.

| Source             | Generated Speaking Activities      |
| ------------------ | ---------------------------------- |
| Textbooks          | Recall, Patterns, Speaking Prompts |
| Dialogues          | Roleplays, Recall Questions        |
| Vocabulary         | Descriptions, Sentence Production  |
| Grammar Lessons    | Pattern Mastery Exercises          |
| Listening Lessons  | Audio Recall Questions             |
| Workbook Exercises | Speaking Conversions               |

No generic AI conversations are used.

All speaking practice remains tied to the learner's curriculum.

---

# Database Schema

## SpeakingSessions

```text
id
user_id
material_id
session_type
score
duration
created_at
```

---

## SpeakingAttempts

```text
id
session_id
exercise_id
prompt
transcript
feedback
score
created_at
```

---

## SpeakingPatterns

```text
id
pattern
mastery_score
automaticity_score
last_practiced
next_review
```

---

## SpeakingMastery

```text
id
user_id
exercise_id
mastery_level
cycles_completed
last_mastered
needs_review
```

---

## SpeakingFeedback

```text
id
attempt_id
pronunciation_score
grammar_score
fluency_score
confidence_score
meaning_score
pattern_score
overall_score
created_at
```

---

## PatternMastery

```text
id
pattern
mastery_level
total_attempts
automaticity_score
next_review
```

---

# Product Vision

The Woodpecker Speaking Engine transforms any textbook, workbook, dialogue, grammar lesson, or listening exercise into a complete speaking curriculum.

The learner repeatedly recalls, reproduces, and speaks the same material across structured Woodpecker cycles until speech becomes automatic.

The result is not passive knowledge.

The result is spontaneous speaking ability built directly from the learner's own learning resources.
