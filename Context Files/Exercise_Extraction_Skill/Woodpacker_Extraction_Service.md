# Woodpacker Extraction Service

## Purpose

The Extraction Service is the core intelligence layer of Woodpacker.

Its responsibility is to transform uploaded learning materials into a structured educational knowledge graph that can power:

* Flashcards
* Speaking exercises
* Listening exercises
* Writing exercises
* Woodpecker repetition cycles
* Mastery tracking
* Adaptive review scheduling

The system must preserve relationships between:

* Kursbuch
* Übungsbuch
* Lehrerhandbuch
* Lösungen
* Audio
* Video
* Images
* Vocabulary lists
* Grammar sections

The extraction service is NOT a document chunking system.

The extraction service is an educational content reconstruction engine.

---

# Core Principle

Most RAG systems do:

```text
PDF
↓
OCR
↓
Chunking
↓
Embeddings
↓
Chat
```

This destroys educational structure.

Woodpacker must instead perform:

```text
PDF
↓
Layout Reconstruction
↓
Educational Structure Extraction
↓
Knowledge Graph Creation
↓
Learning Unit Creation
↓
Exercise Generation
```

---

# Technology Stack

## Orchestration

Use:

```text
NestJS
BullMQ
Redis
```

Purpose:

* Job creation
* Queue management
* Retry handling
* Progress tracking

Do NOT use n8n for extraction.

n8n may later be used for:

* Email notifications
* Webhooks
* Integrations

Extraction intelligence belongs inside Python services.

---

## Storage

### PostgreSQL

Stores:

* Courses
* Chapters
* Lessons
* Topics
* Exercises
* Questions
* Answers
* Grammar rules
* Vocabulary
* Media references

### pgvector

Stores:

* Semantic embeddings
* Concept relationships
* Knowledge search

---

## Object Storage

### MinIO

Stores:

```text
/course-id
    /pdf
    /images
    /audio
    /video
```

Examples:

```text
image_001.webp
audio_023.mp3
video_005.mp4
```

Never store large media in PostgreSQL.

---

# Python Extraction Service

Use a dedicated Python microservice.

Responsibilities:

```text
PDF Processing
OCR
Vision Analysis
Structure Extraction
Knowledge Graph Construction
```

---

# PDF Processing Layer

## Library

### PyMuPDF

Use PyMuPDF as the primary PDF engine.

Reasons:

* Fast
* Stable
* Image extraction
* Coordinate extraction
* Layout reconstruction

Use for:

```python
page text extraction
image extraction
bounding boxes
page rendering
```

Do not use PDF chunking.

---

# OCR Layer

## Preferred OCR

### Google Document AI

Preferred over GPT Vision for OCR.

Reasons:

* Better OCR accuracy
* Better layout understanding
* Better tables
* Better forms
* Better document structure

Use for:

```text
Text detection
Paragraph detection
Table detection
Reading order
```

---

## Secondary OCR

### Surya OCR

Use as fallback.

Reasons:

* Open source
* High quality
* Works offline

---

## Avoid

```text
Tesseract
```

Accuracy is insufficient for textbook extraction.

---

# Vision Understanding Layer

## Preferred

### GPT-5 Vision

Purpose:

NOT OCR.

Purpose:

```text
Exercise understanding
Image understanding
Relationship detection
Educational structure detection
```

Example:

```text
Describe the image.

[family eating dinner]
```

GPT identifies:

```json
{
  "exercise_type": "image_description",
  "image_reference": true
}
```

---

# Extraction Architecture

## Stage 1

Document Classification

Detect:

```text
Kursbuch
Übungsbuch
Lösungen
Audio
Video
Teacher Handbook
Vocabulary Book
Grammar Book
```

Output:

```json
{
  "document_type": "uebungsbuch"
}
```

---

## Stage 2

Layout Reconstruction

Extract:

```json
{
  "page": 20,
  "blocks": []
}
```

Blocks:

```text
title
paragraph
table
image
exercise
grammar
vocabulary
dialogue
```

Every block must have coordinates.

Example:

```json
{
  "type": "exercise",
  "bbox": [120,300,700,900]
}
```

---

## Stage 3

Image Extraction

Extract all images.

Store in MinIO.

Example:

```json
{
  "image_id": "img_001",
  "page": 20,
  "bbox": [100,200,400,500]
}
```

---

## Stage 4

Educational Block Detection

Detect:

```text
Lesson
Grammar
Vocabulary
Reading
Listening
Speaking
Writing
Exercise
```

Output:

```json
{
  "lesson": "Sie oder Du",
  "type": "grammar"
}
```

---

## Stage 5

Exercise Extraction

Example:

```text
1a
Lesen Sie...
```

```text
1b
Ordnen Sie zu...
```

Output:

```json
{
  "exercise_id": "1a"
}
```

```json
{
  "exercise_id": "1b"
}
```

Never merge exercises.

---

## Stage 6

Question Decomposition

Example:

```text
Er _____ nach Berlin.
```

Output:

```json
{
  "question_id": "5.1",
  "type": "fill_blank",
  "question": "Er _____ nach Berlin."
}
```

Every blank becomes a separate question.

---

## Stage 7

Image Linking

Example:

```text
Beschreiben Sie das Bild.
```

Link:

```json
{
  "exercise_id": "4a",
  "linked_images": [
    "img_001"
  ]
}
```

Required for speaking exercises.

---

## Stage 8

Audio Linking

Detect:

```text
Hören Sie Track 12.
```

Link:

```json
{
  "exercise_id": "5",
  "audio_id": "track_12"
}
```

---

## Stage 9

Solution Matching

Find answers from:

```text
Lösungen
Teacher Handbook
Answer Keys
```

Output:

```json
{
  "question_id": "5.1",
  "answer": "zieht"
}
```

---

## Stage 10

Relationship Engine

Build relationships.

Example:

```text
Kursbuch
↓
Lesson 2
↓
Topic
↓
Übungsbuch
↓
Audio
↓
Solutions
```

Output:

```json
{
  "topic": "Duzen und Siezen",
  "lesson": "2",
  "related_exercises": [],
  "related_audio": [],
  "related_images": []
}
```

---

# Knowledge Graph Layer

Use LangGraph.

Not LangChain alone.

LangGraph is required because extraction is a multi-stage workflow.

---

## LangGraph Nodes

### Node 1

Document Classifier

---

### Node 2

Layout Analyzer

---

### Node 3

Exercise Detector

---

### Node 4

Question Extractor

---

### Node 5

Image Linker

---

### Node 6

Audio Linker

---

### Node 7

Solution Matcher

---

### Node 8

Knowledge Graph Builder

---

### Node 9

Validation Engine

---

# Validation Layer

Never trust a single AI extraction.

Run validation.

Example:

Page contains:

```text
Exercise 1a
Exercise 1b
Exercise 2
Exercise 3
```

Expected:

```json
{
  "exercise_count": 4
}
```

Detected:

```json
{
  "exercise_count": 3
}
```

Action:

```text
REPROCESS PAGE
```

---

# Output Schema

The final extraction output should be:

```json
{
  "course": {},
  "chapters": [],
  "lessons": [],
  "topics": [],
  "grammar_rules": [],
  "vocabulary": [],
  "images": [],
  "audio": [],
  "exercises": [],
  "questions": [],
  "answers": [],
  "relationships": []
}
```

This schema becomes the source of truth for every Woodpacker feature.

---

# Future Features Enabled

Because the system stores educational structure instead of chunks, it can generate:

* Flashcards
* Speaking drills
* Listening recall
* Cloze exercises
* Writing tasks
* Exam simulations
* Woodpecker review cycles
* Adaptive mastery systems
* AI tutoring

without reprocessing the original documents.

---

# Golden Rule

Never extract PDFs into chunks.

Always reconstruct:

```text
Document
↓
Lesson
↓
Exercise
↓
Question
↓
Knowledge Unit
↓
Knowledge Graph
↓
Learning Experience
```

Everything in Woodpacker should be built from the knowledge graph, not from raw document chunks.
