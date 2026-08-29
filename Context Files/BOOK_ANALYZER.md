# Book Analyzer — Rebuild Document Detection & Extraction System

## Purpose

Convert educational material (PDF) into structured learning data.

## Status

**This spec replaces the previous PDF detection pipeline in full.**

The current architecture relies heavily on page-level LLM Vision analysis with
OCR fallback. That approach produced inconsistent results, poor exercise
detection, incorrect reading order, missed relationships between content
blocks, and unreliable extraction of language-learning materials.

The new system is a **deterministic document-understanding pipeline where
layout analysis is the primary source of truth and LLMs are only used for
semantic classification and edge cases.**

## Supported Sources

### Books
- Textbooks
- Workbooks

### Notes
- Personal notes
- Lecture notes

### Study Material
- Slides
- PDFs

## Current Problems (why this rebuild exists)

### Problem 1: Page-Level Vision Analysis

Current workflow:

```text
PDF Page
    ↓
LLM Vision
    ↓
Attempt to identify content
```

Issues:

* Hallucinates structure
* Misses exercise boundaries
* Incorrect reading order
* Merges unrelated content
* Inconsistent results between runs
* Expensive

### Problem 2: OCR as Fallback

Current workflow:

```text
Vision First
    ↓
OCR Only If Needed
```

Issues:

* Layout information is lost
* Images and exercises become disconnected
* Multi-column pages fail
* Tables are corrupted
* Exercise numbering becomes unreliable

### Problem 3: No Document Object Model

The system lacks a structured representation of a page. There is no unified
model for text blocks, images, tables, exercises, audio references, video
references, instructions, or solutions.

---

# New Architecture

## Core Principle

**LLMs must NOT detect document structure.**

Layout analysis must detect document structure.

LLMs should only enrich already-detected blocks.

## Pipeline Overview

```text
PDF
 ↓
Page Extraction
 ↓
Layout Detection
 ↓
Block Extraction
 ↓
OCR Per Block
 ↓
Block Classification
 ↓
Relationship Builder
 ↓
Knowledge Graph
 ↓
Exercise Detection
 ↓
Exercise Type Classification
 ↓
Storage
```

---

# Stage 1: PDF Processing

## Requirements

Use **PyMuPDF**.

Extract:

* Page images
* Embedded images
* Text layer
* Coordinates

For every page generate:

```json
{
  "page": 1,
  "width": 2480,
  "height": 3508,
  "blocks": []
}
```

No content classification occurs here. Only extraction.

---

# Stage 2: Layout Detection

## Purpose

Detect every visual element on the page.

## Provider Priority (interchangeable providers required)

| Priority | Tool | Role |
| --- | --- | --- |
| 1 | Google Document AI | Primary layout + OCR |
| 2 | PaddleOCR PP-Structure V3 | Fallback |
| 3 | Surya | Last-resort fallback |

## Detect These Block Types

```text
title
subtitle
paragraph
exercise
instruction
question
answer_area
image
table
header
footer
audio_reference
video_reference
page_number
caption
unknown
```

## Output Format

```json
{
  "block_id": "page_25_block_14",
  "page": 25,
  "type": "text",
  "bbox": [x1, y1, x2, y2],
  "confidence": 0.98
}
```

Every block must have coordinates. **Coordinates are mandatory.**

---

# Stage 3: Block Extraction

After layout detection, crop every block independently:

```text
Page
 ├─ Block 1
 ├─ Block 2
 ├─ Block 3
 └─ Block 4
```

Generate cropped assets:

```text
page_1_block_1.png
page_1_block_2.png
page_1_block_3.png
```

Store all cropped assets.

---

# Stage 4: OCR Layer

Perform OCR on individual blocks. **Never OCR the entire page.**

## OCR Priority

1. Google Document AI OCR
2. Google Vision OCR
3. PaddleOCR
4. Surya OCR

## OCR Output

```json
{
  "block_id": "page_5_block_12",
  "text": "Ordnen Sie die Wörter zu.",
  "confidence": 0.99
}
```

---

# Stage 5: Block Classification

Classify every block.

## Categories

```text
exercise
instruction
question
answer_area
image
table
paragraph
header
footer
caption
reference
unknown
```

## Rules First

Use deterministic rules before LLM.

Examples:

### Exercise

Contains `1.` `2.` `3.` or `a)` `b)` `c)` → likely exercise.

### Listening Exercise

Contains `Hören Sie`, `Audio`, `Track`, `CD` → classify as listening-related.

### Matching Exercise

Contains `Ordnen Sie zu`, `Verbinden Sie`, `Zuordnen` → classify as matching.

Only use LLM classification when confidence is low.

---

# Stage 6: Image Understanding

Only image blocks may use Vision models. **Never analyze entire pages.**

Process:

```text
Image Block
 ↓
Vision Model
 ↓
Description
 ↓
Keywords
```

Output:

```json
{
  "image_id": "img_23_2",
  "description": "Nurse speaking with patient",
  "keywords": ["hospital", "patient", "nurse"]
}
```

---

# Stage 7: Relationship Builder

Build relationships between blocks:

```text
Instruction
    ↓
Exercise
    ↓
Image
    ↓
Audio
```

Must determine:

* Which instruction belongs to which exercise
* Which image belongs to which exercise
* Which audio belongs to which exercise
* Which solution belongs to which exercise

## Example Output

```json
{
  "exercise_id": "A1_25_3",
  "instruction_block": "block_15",
  "question_blocks": ["block_16", "block_17"],
  "image_blocks": ["img_25_1"],
  "audio_references": ["track_3"]
}
```

---

# Stage 8: Knowledge Graph

Create graph nodes.

Node types:

```text
Lesson
Exercise
Question
Image
Audio
Video
Solution
Grammar
Vocabulary
Dialogue
```

Relationships:

```text
HAS_EXERCISE
HAS_IMAGE
HAS_AUDIO
HAS_SOLUTION
RELATED_TO
BELONGS_TO
```

---

# Stage 9: Exercise Type Detection

Supported types:

```text
multiple_choice
fill_blank
matching
ordering
listening
speaking
reading
writing
dialogue
image_description
grammar
vocabulary
true_false
drag_drop
open_question
```

Store a confidence score with every classification:

```json
{
  "exercise_type": "matching",
  "confidence": 0.97
}
```

---

# Stage 10: Storage Model

Every detected object must be persisted.

```json
{
  "id": "exercise_123",
  "page": 12,
  "bbox": [100, 200, 500, 700],
  "exercise_type": "matching",
  "instruction": "...",
  "questions": [],
  "images": [],
  "audio": []
}
```

---

# LangGraph Requirements

Create a LangGraph pipeline with explicit nodes:

```text
PDF Loader
 ↓
Layout Detection
 ↓
Block Extraction
 ↓
OCR
 ↓
Classification
 ↓
Relationship Builder
 ↓
Knowledge Graph
 ↓
Exercise Detection
 ↓
Storage
```

Each node must:

* Produce structured JSON
* Be independently testable
* Log execution time
* Log confidence scores
* Support retries

---

# Debugging Requirements

Build a **Pipeline Inspector** page.

For every page show:

### Left Panel

* Original PDF page
* Bounding boxes
* Cropped blocks

### Right Panel

* Layout JSON
* OCR JSON
* Classification JSON
* Relationships JSON
* Exercise JSON

Allow clicking a block to inspect:

* Coordinates
* OCR text
* Classification
* Linked exercise
* Linked image
* Linked audio

---

# Success Criteria

The system is complete only when:

* Every page element is detected with coordinates
* Reading order is preserved
* Exercises are correctly isolated
* Images are linked to exercises
* Audio references are linked to exercises
* OCR is block-based
* Layout detection is primary
* LLM usage is minimized
* Full pipeline is visible in the Pipeline Inspector
* All outputs are deterministic, reproducible, and stored as structured JSON

---

## Outputs (downstream, unchanged)

Once blocks are classified, exercises extracted, and relationships built, the
final analysis summary keeps its shape:

```json
{
  "chapters": 12,
  "lessons": 18,
  "knowledge_units": 442,
  "exercises": 327,
  "speaking_prompts": 156,
  "patterns": 89
}
```

Downstream consumers (`LEARNING_MATERIAL_RELATIONSHIP_ENGINE.md`,
`RELATIONSHIP_BUILDER.md`, `EXERCISE_CLASSIFIER.md`) read from the persisted
Stage-10 objects instead of raw LLM output.

---

## Legacy Pipeline (current code — superseded)

Implemented in `src/lib/pipeline.ts` + `src/lib/heuristics.ts`
(page-level vision / chunked LLM discovery). This remains the running code
until the LangGraph pipeline lands; it is **deprecated by this spec** and must
not be extended. Its extraction rules that remain valid downstream are
preserved in `Context Files/Exercise_Extraction_Skill/` (extraction rules:
never CD track listings, TOC entries, bare titles, CEFR levels, page arrows,
index/solution-key fragments).

## References

- `Context Files/RELATIONSHIP_BUILDER.md` — cross-file relationship CLI (builds on Stage 7/8)
- `Context Files/LEARNING_MATERIAL_RELATIONSHIP_ENGINE.md` — cross-file relationship engine
- `Context Files/EXERCISE_CLASSIFIER.md` — flashcard-deck type mapping for detected exercises
- `Context Files/Exercise_Extraction_Skill/` — validation gates still applied downstream
