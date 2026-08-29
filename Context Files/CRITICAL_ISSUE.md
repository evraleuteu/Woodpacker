# Critical Issue

The uploaded learning materials currently exist only on the Upload page.

This is incorrect behavior.

Learning materials must be treated as a global course resource available throughout the entire application.

Once a user uploads materials, every page must immediately have access to those materials.

The upload page is not the source of truth.

The Course Library is the source of truth.

---

> **Status: RESOLVED** — implemented via the global Course Repository
> (`src/lib/storage.ts` + `src/lib/useCourse.ts`): courses persist under
> `woodpacker:courses`, the active course under `woodpacker:active-course`,
> updates propagate through CustomEvent/storage events (`course:created`,
> `course:updated`, `materials:processed`, `knowledgegraph:updated`,
> `exercises:generated`, `course:deleted`, `course:active`, `repo:sync`),
> and every page (Dashboard, Exercises, Language, Speaking, Accent,
> Materials, Cycles) reads from the same global source via `useCourse()`.
> See `OBJECTIVE.md` → "Completed Work — Real-Time Course Repository".

---

# Current Broken Behavior

Current flow:

```text id="o0ww58"
Upload Page
    ↓
Files Visible
```

User navigates:

```text id="cl4m1e"
Dashboard
```

Result:

```text id="pk30qb"
No files
```

User navigates:

```text id="s52g57"
Exercises
```

Result:

```text id="p1vw74"
No exercises
```

User navigates:

```text id="0l06g2"
Language Mastery
```

Result:

```text id="7i7r0u"
No content
```

User returns:

```text id="nxkmzq"
Upload Page
```

Result:

```text id="1v2z3o"
Uploaded files disappeared
```

This must be fixed.

---

# Desired Architecture

Uploaded materials must become a persistent course package.

Example:

```text id="22g9rj"
User Uploads

Kontext B2
├── PDFs
├── Audio
├── Videos
└── Exercises
```

The platform stores this package centrally.

All pages read from the same source.

---

# Single Source Of Truth

Create a global Course Repository.

Example:

```text id="9jvqxb"
Course Repository
│
├── Course Metadata
├── File Inventory
├── Directory Tree
├── Knowledge Graph
├── Exercises
├── Vocabulary
├── Grammar
├── Audio
├── Videos
└── Progress Data
```

Every page reads from this repository.

Never store uploaded materials only in page state.

---

# Persistence Requirements

Uploaded content must survive:

```text id="kr92h6"
✓ Page refresh

✓ Route changes

✓ Browser reload

✓ User logout/login

✓ New sessions

✓ Server restart
```

Store permanently.

Never rely solely on:

```text id="4qlr1m"
useState

temporary memory

page cache
```

---

# Dashboard Integration

After upload:

Dashboard must immediately update.

Display:

```text id="x49l2f"
Uploaded Courses

Kontext B2

Files: 352

Lessons: 24

Exercises: 421

Audio: 183

Videos: 12

Status: Processed
```

No manual refresh required.

---

# Exercises Page Integration

Exercises page must automatically read the uploaded materials.

Example:

```text id="z2a8ux"
Exercises

Kapitel 1
Kapitel 2
Kapitel 3
```

generated from uploaded resources.

The page should never appear empty if exercises were successfully extracted.

---

# Language Mastery Integration

Language Mastery must use uploaded materials as its source.

Example:

```text id="6zcjjw"
Vocabulary Progress

Grammar Progress

Listening Progress

Speaking Progress

Reading Progress
```

All metrics come from uploaded course content.

---

# Knowledge Graph Integration

Knowledge Graph should automatically rebuild after upload.

Example:

```text id="qv0r6v"
Upload Complete
        ↓
Content Extraction
        ↓
Knowledge Graph Update
        ↓
All Pages Updated
```

---

# Real-Time Synchronization

When upload processing finishes:

Automatically notify:

```text id="j91pxp"
Dashboard

Exercises

Language Mastery

Vocabulary

Grammar

Knowledge Graph

Learning Path

Course Explorer
```

All pages should refresh automatically.

No browser refresh required.

---

# Upload Recovery

If user uploads:

```text id="d0wzpj"
Kontext B2
```

Then closes browser.

Tomorrow:

```text id="qyx99q"
User logs in
```

The system should restore:

```text id="lhnzh2"
Kontext B2

Files

Exercises

Audio

Videos

Progress

Knowledge Graph
```

Exactly as before.

---

# Course Explorer

Create a global course explorer.

Example:

```text id="p7x7a9"
My Materials

Kontext B2

├── Files
├── Lessons
├── Exercises
├── Audio
├── Videos
├── Vocabulary
├── Grammar
└── Progress
```

Accessible from every page.

---

# Event-Driven Updates

When upload completes:

Publish events:

```text id="cmlpr6"
course:created

course:updated

materials:processed

knowledgegraph:updated

exercises:generated
```

Subscribed pages should update automatically.

---

# Database Requirements

Store:

```text id="6ppvn5"
Course

Folder Structure

Files

Metadata

Lessons

Exercises

Audio Links

Video Links

Knowledge Graph

User Progress
```

in the database.

Never store only in frontend state.

---

# Success Criteria

After a user uploads learning materials:

✓ Materials appear on Dashboard.

✓ Materials appear on Exercises page.

✓ Materials appear on Language Mastery page.

✓ Materials appear on Vocabulary page.

✓ Materials appear on Grammar page.

✓ Materials appear on Learning Path page.

✓ Materials remain after page refresh.

✓ Materials remain after navigation.

✓ Materials remain after logout/login.

✓ Materials remain after browser restart.

✓ Materials synchronize automatically across the entire platform.

The uploaded course must become a permanent, global, synchronized learning resource for the entire application, not a temporary file visible only on the Upload page.
