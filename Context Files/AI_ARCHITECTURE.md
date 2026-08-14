# AI Architecture

## Core Architecture

### Ingestion Layer
Accepts:
- PDFs
- EPUBs
- Audio
- Images
- Notes

### OCR Service
Extracts text.

### Speech-to-Text Service
Processes audio.

### Book Analyzer
Extracts:
- Structure
- Exercises
- Knowledge

### Accent Analyzer
Analyzes:
- Pronunciation
- Rhythm
- Intonation
- Stress

### Pattern Extraction Engine
Extracts recurring structures.

### Knowledge Graph
Maps relationships.

### Speaking Generator (NEW)
Generates from uploaded material:
- Recall questions
- Speaking prompts
- Pattern drills
- Roleplays
- Monologues
- Retelling exercises
- Pronunciation exercises

### Audio Generator (NEW)
Generates audio for speaking exercises.

### Speaking Engine (UPDATED)
Responsible for:
- Audio Recall mode
- Pattern Mastery mode
- Voice Response mode
- Speech-to-text
- Conversation management

### Speech Recognition
Transcribes learner speech.

### Pronunciation Engine (NEW)
Scores pronunciation accuracy.

### Grammar Analyzer (NEW)
Analyzes grammatical correctness.

### Fluency Analyzer (NEW)
Measures fluency and naturalness.

### Adaptive Feedback Engine (NEW)
Provides structured feedback:
- Pronunciation corrections
- Grammar corrections
- Vocabulary suggestions
- Fluency tips
- Confidence coaching

### Mastery Engine (NEW)
Tracks:
- Speak Until Mastered criteria
- Pattern mastery scores
- Cycle progression
- Automatic reintroduction of weak items
### Exercise Generator

Creates learning activities.

### Woodpecker Scheduler

Creates repetition cycles for language learning.

## Knowledge Mastery (Premium — Coming Soon)

Knowledge Graph, Mastery Engine, and Recall systems for Medicine, Engineering, Law, Nursing, and Certifications will be available in the Mastery plan.

## Pipeline

```
Uploaded Material
    ↓
Book Analyzer
    ↓
Knowledge Graph
    ↓
Pattern Extraction Engine
    ↓
Speaking Generator
    ↓
Audio Generator
    ↓
Speaking Engine
    ↓
Speech Recognition
    ↓
Pronunciation Engine + Grammar Analyzer + Fluency Analyzer
    ↓
Adaptive Feedback Engine
    ↓
Mastery Engine
    ↓
Woodpecker Scheduler
```

## Recommended Stack

### Frontend
- Next.js
- TypeScript
- Tailwind

### Backend
- NestJS

### AI
- GPT-5
- Whisper
- Embeddings

### Database
- PostgreSQL
- pgvector

### Storage
- Cloudflare R2

### Queue
- BullMQ