# Book Analyzer

## Purpose

Convert educational material into structured learning data.

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

## Outputs

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

## Pipeline

OCR

↓

Segmentation

↓

Structure Detection

↓

Knowledge Extraction

↓

Exercise Mapping

↓

Speaking Prompt Generation