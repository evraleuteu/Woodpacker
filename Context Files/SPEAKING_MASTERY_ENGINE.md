# Speaking Mastery Engine

## Purpose

Convert passive learning material into automatic spoken production using progressive Woodpecker repetition.

Instead of chatting with AI, every speaking activity originates directly from the uploaded material.

## Core Insight

Most learners can:
- Read
- Listen

But cannot:
- Speak spontaneously

The Speaking Mastery Engine solves this problem using Woodpecker repetition cycles.

## Pipeline

```
Uploaded Material
    ↓
Book Analyzer
    ↓
Knowledge Units
    ↓
Speaking Exercise Generator
    ↓
Speaking Mastery Engine
    ↓
Woodpecker Scheduler
    ↓
Adaptive Speaking Cycles
```

## Speaking Modes

### Mode 1 — Audio Recall

**Purpose:** Develop listening comprehension and verbal recall.

**Example:**

Audio: *"Anna fährt morgen nach Berlin."*

↓

Question: *"Wohin fährt Anna?"*

↓

Learner answers aloud.

↓

**AI evaluates:**
- Correctness
- Pronunciation
- Grammar
- Fluency

**If incorrect:**
1. Explain the mistake
2. Replay the original audio
3. Ask the same question again
4. Repeat until mastered

---

### Mode 2 — Pattern Mastery

**Purpose:** Automate reusable language structures.

**Example:**

Pattern: *Ich möchte...*

**Exercises:**
1. Ich möchte einen Kaffee.
2. Ich möchte Deutsch lernen.
3. Ich möchte nach Berlin fahren.
4. Ich möchte heute arbeiten.

**Finally:** Create your own sentence using "Ich möchte..."

Every pattern receives its own mastery score.

---

### Mode 3 — Voice Response

**Purpose:** Develop spontaneous speaking.

**Prompt:** *"Was machen Sie normalerweise am Wochenende?"*

Learner answers aloud.

**AI evaluates:**
- Grammar
- Vocabulary
- Pronunciation
- Fluency
- Naturalness

**Feedback:**

Original: *"Ich spiele Fußball mit meine Freunde."*

Correction: *"Ich spiele Fußball mit meinen Freunden."*

Then repeat until correct.

---

## Woodpecker Speaking Cycle

Each speaking exercise progresses through increasing levels of independence:

| Cycle | Support Level |
|-------|--------------|
| Cycle 1 | Full audio + transcript + translation + full hints |
| Cycle 2 | Audio + keywords only |
| Cycle 3 | Audio only, no transcript |
| Cycle 4 | Question only, no audio |
| Cycle 5 | Real-world scenario, no hints, fully spontaneous response |

This mirrors the original Woodpecker Method: repeat the same core material while gradually removing support until recall becomes automatic.

## Speak Until Mastered

A speaking exercise is not marked complete after one attempt. Instead, the learner repeats it until predefined mastery criteria are met.

### Mastery Criteria

| Metric | Threshold |
|--------|-----------|
| Pronunciation | ≥ 90% |
| Grammar | ≥ 95% |
| Fluency | ≥ 85% |
| Meaning Conveyed | 100% |

### Flow

```
Attempt
    ↓
AI Evaluation
    ↓
Pass? ──Yes──▶ Advance to next cycle
  │
  No
  │
  ▼
Feedback + Correction
    ↓
Repeat attempt
    ↓
AI Evaluation
    ↓
...loop until mastered
```

If performance drops in later cycles, the scheduler automatically reintroduces the exercise.

## AI Feedback Model

Structured feedback per attempt:

| Dimension | Score | Guidance |
|-----------|-------|----------|
| Pronunciation | 0–100 | "The 'ch' sound in 'ich' needs to be softer." |
| Grammar | 0–100 | "Use the dative: 'mit meinen Freunden'." |
| Vocabulary | 0–100 | "A more natural expression is 'Ich hätte gern...'" |
| Fluency | 0–100 | "Try speaking without pauses." |
| Naturalness | 0–100 | "This sounds slightly formal for casual conversation." |
| Confidence | 0–100 | "Speak a little louder and maintain a steady pace." |
| Meaning Accuracy | 0–100 | "The meaning was correctly conveyed." |
| Pattern Usage | 0–100 | "Good use of the 'Ich möchte...' pattern." |

## Combined Learning Sequence

Example: A lesson about restaurants.

**Step 1 — Listen**
Audio: *"Ich hätte gern eine Pizza."*

**Step 2 — Recall**
Question: *"Was möchte der Kunde?"*
Learner answers.

**Step 3 — Pattern Practice**
Pattern: *Ich hätte gern...*
Learner produces:
- Ich hätte gern Wasser.
- Ich hätte gern einen Salat.
- Ich hätte gern einen Kaffee.

**Step 4 — Voice Response**
AI: *"Bestellen Sie Ihr Abendessen."*
Learner speaks freely.
AI provides corrections.

**Step 5 — Repeat**
The same sequence reappears in later Woodpecker cycles with progressively less support.

## Speaking Sources

All exercises are generated from the user's own learning material:

- **Textbooks** → AI generates speaking drills from lesson content
- **Dialogues** → AI transforms into roleplay exercises
- **Vocabulary** → AI generates descriptive prompts
- **Grammar Lessons** → AI generates contextual speaking exercises
- **Listening Passages** → AI generates Audio Recall questions
- **Exercises** → AI converts into speaking prompts

## Database Schema Additions

### SpeakingSessions
- id
- user_id
- material_id
- session_type
- score
- duration
- created_at

### SpeakingAttempts
- id
- session_id
- prompt
- transcript
- feedback
- score

### SpeakingPatterns
- id
- pattern
- mastery_score
- last_practiced

### SpeakingMastery
- id
- user_id
- exercise_id
- mastery_level
- cycles_completed
- last_mastered
- needs_review

### SpeakingFeedback
- id
- attempt_id
- pronunciation_score
- grammar_score
- fluency_score
- confidence_score
- meaning_score
- pattern_score
- overall_score

### PatternMastery
- id
- pattern
- mastery_level
- total_attempts
- automaticity_score
- next_review