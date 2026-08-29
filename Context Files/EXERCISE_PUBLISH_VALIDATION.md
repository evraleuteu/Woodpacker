# Exercise Publish Validation — Pre-Publish Cleaning Gate

Spec for the **publish gate**: the final validation/cleaning step every exercise must
pass before it is posted to a course and becomes visible in the UI.

Applies to every exercise from any source: LLM extraction (`llmDiscover` /
`assembleCourse`), heuristic fallback (`detectExercises`), and manual entry.

Companion to `Exercise_Extraction_Skill/validation_rules.md` (extraction-time gates).
This file defines the **publish-time** gates that run after extraction, when the
course is assembled.

---

## 1. Pipeline Position

```text
Extraction (LLM / heuristics)
        ↓
validation_rules.md gates   ← extraction-time: shape, junk, answerability
        ↓
PUBLISH GATE (this file)    ← publish-time: source traceability + displayability
        ↓
Exercise posted to course
        ↓
Visible in FlashcardDeck / Materials / Exercises pages
```

The publish gate runs once per exercise, at the moment the exercise is about to be
attached to a `Lesson`/`Module` in the course object (`assembleCourse`).

---

## 2. Core Principle

> **An exercise that cannot display its source is not published as-is.**

Every exercise carries a source location:

| Field | Meaning |
| --- | --- |
| `page` | Exact source page in the uploaded material, e.g. `"S. 34"`, `"p. 34"`, `"Seite 24"` |
| `name` | Printed exercise label, e.g. `"Aufgabe 5a"`, `"Übung 3b"` |
| `sourceAssets` | IDs of the uploaded files the exercise was extracted from (PDFs, audio, video, images) |

At publish time the system must be able to **display** the exercise's source to the user:

- A PDF page reference must resolve to a **real, renderable page** of a real asset.
- An audio/video reference must resolve to a **playable asset**.
- An image reference must resolve to a **viewable asset**.
- A `name`/`page` pair must match a **lesson that actually exists** in the course.

If the reference cannot be resolved, the exercise is either **cleaned** (broken
references removed) or **rejected** (exercise dropped entirely), never published broken.

---

## 3. Source Resolution

### 3.1 Asset resolution

For every `sourceAssets` ID, look it up in the course `sourceFiles`. The asset
"exists" when:

- ✓ The ID matches a `sourceFiles` entry
- ✓ The asset has content the UI can render:
  - PDF → `dataUrl` present (or object storage key resolvable) **and** page count known
  - Audio/Video → `dataUrl` or playable `objectKey` present
  - Image → `dataUrl` present
  - Text/DOCX → extracted `text` present

### 3.2 Page resolution

Parse `page` into one or more page numbers:

| Input pattern | Parsed |
| --- | --- |
| `"34"` | `[34]` |
| `"S. 34"` / `"p. 34"` / `"Seite 34"` | `[34]` |
| `"S. 24-26"` / `"24–26"` | `[24, 25, 26]` |
| `"S. 10, 12"` | `[10, 12]` |
| `"A6"` / `"S. A6"` | `[6]` (annex page — must still be in range) |

A page resolves when:

- ✓ Every parsed number is ≥ 1
- ✓ Every parsed number is ≤ the asset's known page count
- ✓ The asset is a page-bearing document (PDF/DOCX/EPUB), not audio/video

### 3.3 Name resolution

`name` resolves when it matches a lesson title in the same module (case-insensitive,
fuzzy: contains / starts-with), or is a plausible printed label (`Aufgabe 5a`,
`Übung 3b`, `Exercise 12`) that the user can search for in the material.

---

## 4. Publish Gates (in order)

Each gate either **cleans** the exercise or **rejects** it.

| # | Gate | Condition | Action | Reason |
| --- | --- | --- | --- | --- |
| 1 | Asset exists | `sourceAssets` empty | **Reject** (no traceability at all) | `no-source-assets` |
| 2 | Asset exists | referenced asset ID not in `sourceFiles` | **Clean**: drop missing IDs | `source-asset-missing:<id>` |
| 3 | Page required | type needs a page (`comprehension`, `assessment`, `fill-blank`, `multiple-choice` from a PDF) and `page` empty | **Clean** if prompt is self-contained, else **reject** | `missing-page` |
| 4 | Page resolvable | `page` cannot be parsed (no digit) | **Clean**: strip `page` | `unresolvable-page:<value>` |
| 5 | Page in range | parsed number > asset page count | **Clean**: strip `page` (clamp to last page only if the prompt explicitly says "last page") | `page-out-of-range:<n>/<max>` |
| 6 | Page displayable | PDF asset has **no page count** / no renderable content (scanned-only, no dataUrl) | **Clean**: strip `page` — the reference cannot be shown | `page-not-displayable` |
| 7 | Source-dependent prompt | prompt requires the source (e.g. `"Look at the picture on page 5"`, `"Listen to track 2"`, reading-passage question) and its page/asset was stripped or missing | **Reject** (the exercise is not playable without the source) | `source-dependent-without-source` |
| 8 | Name exists | `name` set but no lesson/label match anywhere in the course | **Clean**: strip `name` | `name-unresolvable:<value>` |
| 9 | Audio dependency | listening exercise (`comprehension` with audio) has no playable audio asset | **Reject** (no audio = dead card) | `audio-missing` |
| 10 | Final shape | after cleaning, exercise is empty or below `validation_rules.md` minimums | **Reject** | `cleaned-to-empty` |

---

## 5. Clean vs. Reject Policy

| Situation | Action |
| --- | --- |
| Broken `page` reference, prompt self-contained | **Clean** — strip `page`, keep exercise |
| Broken `page` reference, prompt depends on it (image/passage/listen instruction) | **Reject** — the card cannot be played |
| Broken audio asset on a listening exercise | **Reject** — dead card |
| Broken `name` only | **Clean** — strip `name` |
| Any `sourceAssets` missing from the course | **Clean** — drop the dead ID; reject only if nothing remains |

Cleaning is always logged so the publish report shows what was dropped and why.

---

## 6. Publish Report

After the gate runs over a course, produce a report per course:

```text
Exercises extracted:      421
Exercises published:      398
Cleaned (page stripped):   18
Cleaned (name stripped):    4
Rejected (no source):       1
Rejected (audio missing):   0
```

Format: `{ reason: count }` map, attached to the course metadata so the UI can show
"X exercises cleaned during publish" on the Upload summary.

---

## 7. Required Data — Page Count

The displayability gates (5–6) require the page count of every page-bearing asset.

**The asset must carry `pageCount`** (new field on `sourceFiles` entries, set during
parsing via `pdfjs-dist`). Until `pageCount` is known:

- Publish gate **blocks** the exercise with `page-not-displayable` (page stripped), it
  never guesses or publishes an unverifiable page link.
- The `materials/[id]` viewer uses `pageCount` to render "Page n / N" and to jump to an
  exercise's page (`#page=n`).

---

## 8. Integration Points (code)

| File | Change |
| --- | --- |
| `src/lib/exercise-validation.ts` | Add `publishExercise(exercise, ctx)` — takes the validated exercise + course context (`sourceFiles`, page counts, lesson titles); returns `{ action: 'publish' \| 'clean' \| 'reject', exercise?, reasons[] }` |
| `src/lib/pipeline.ts` | Call `publishExercise` in `assembleCourse` for every generated/fallback exercise before attaching to a lesson; aggregate the publish report into the course |
| `src/lib/parse.ts` | Compute and store `pageCount` on PDF assets during parsing |
| `src/app/materials/[id]/page.tsx` | Fix the viewer: use real `pageCount`, resolve `#page=` from exercise `page` refs (currently hardcoded `pdfPages = 0`) |
| `src/components/exercises/FlashcardDeck.tsx` | Render "Source: page n" link only when the exercise still carries a resolvable `page` |

---

## 9. Success Criteria

- ✓ No exercise is published with a page reference the UI cannot display
- ✓ No listening exercise is published without a playable audio asset
- ✓ Every published exercise keeps a traceable source (at least one `sourceAssets` ID)
- ✓ Broken references are cleaned, not silently kept; dependent exercises are rejected
- ✓ Publish report attached to the course (cleaned/rejected counts by reason)
- ✓ `tsc --noEmit` passes; ESLint clean