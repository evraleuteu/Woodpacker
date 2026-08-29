# Woodpecker SaaS — Technical Stack Context

## 1. Product Overview

Woodpecker SaaS is a language-learning platform that transforms existing learning materials into structured speaking practice using the Woodpecker repetition method.

Users can upload complete learning materials such as:

* Textbooks
* Workbooks
* PDFs
* Audio lessons
* Exercise books
* ZIP folders containing multiple files
* Other supported educational materials

The system analyzes the uploaded material, extracts its educational structure, creates knowledge units, and generates progressive speaking exercises.

The uploaded material is the primary source of learning content. The application should not randomly invent unrelated exercises when suitable material exists in the uploaded source.

---

## 2. Core Technology Stack

### Frontend

* Next.js 16
* TypeScript
* Tailwind CSS v4
* shadcn/ui
* lucide-react
* next-themes
* Sonner
* date-fns
* React Day Picker

### Frontend responsibilities

Next.js is responsible for:

* User interface
* Dashboard
* Upload interface
* File/folder selection
* Upload progress
* Exercise interface
* Speaking practice interface
* Language mastery interface
* Analytics
* Settings
* Authentication UI
* Client-side state
* Communicating with the backend API

The frontend must NOT upload large files through the NestJS API server.

Large files should be uploaded directly to object storage using signed/multipart upload mechanisms.

---

## 3. Backend

### NestJS

NestJS is the primary backend API and application orchestration layer.

Responsibilities include:

* Authentication integration
* User management
* Project management
* File metadata
* Upload sessions
* Permissions
* Database operations
* Processing orchestration
* Exercise generation
* Learning progress
* User statistics
* API endpoints
* Webhooks
* Subscription/billing integration
* Notifications

NestJS should coordinate processing but should NOT perform long-running heavy file processing inside HTTP requests.

Long-running operations must be delegated to background jobs.

---

## 4. Database

### PostgreSQL

PostgreSQL is the primary relational database.

It stores structured application data such as:

* Users
* Projects
* Learning materials
* Files
* Folders
* Chapters
* Lessons
* Exercises
* Knowledge units
* Speaking sessions
* Repetition sessions
* User progress
* Language mastery
* Processing jobs
* AI generation metadata
* Subscription information
* Application settings

PostgreSQL should NOT store large uploaded files directly.

Large binary files belong in object storage.

---

## 5. ORM

### Prisma

Prisma is the ORM between NestJS and PostgreSQL.

Architecture:

Next.js → NestJS → Prisma → PostgreSQL

Prisma is responsible for:

* Type-safe database queries
* Database schema
* Migrations
* Relations
* Transactions
* Query abstraction

Do not bypass Prisma with raw SQL unless there is a documented performance or PostgreSQL-specific requirement.

Prisma is not the database. PostgreSQL remains the source of truth.

---

## 6. Object Storage

### Development: MinIO

MinIO is the local development object-storage layer.

It provides S3-compatible storage without requiring cloud storage during development.

Example:

Next.js → signed upload → MinIO

MinIO should store:

* PDFs
* Audio
* Video
* Images
* ZIP files
* Uploaded folders
* Generated audio
* Generated documents
* Other large binary assets

---

## 7. Production Object Storage

### Cloudflare R2 or Amazon S3

Production storage should use an S3-compatible object-storage architecture.

Preferred initial production option:

Cloudflare R2

Alternative:

Amazon S3

The application should use an abstraction layer so storage can be changed without rewriting the entire application.

The application should never assume that MinIO is the production storage provider.

---

## 8. Large File Upload Architecture

The application must support files of 20GB or larger.

Do NOT send 20GB files through NestJS.

Preferred architecture:

User
→ Next.js
→ NestJS requests upload authorization
→ NestJS generates signed/multipart upload information
→ Browser uploads directly to MinIO/R2/S3
→ Storage confirms upload
→ Backend creates processing job

Uploads should support:

* Multipart uploads
* Resumable uploads
* Upload progress
* Retry of failed chunks
* Large file support
* Folder uploads where supported
* Upload cancellation
* Upload recovery
* File validation

The backend should primarily store upload metadata rather than proxying file bytes.

---

## 9. Redis

### Self-hosted Redis

Redis is used as a high-speed temporary data and coordination layer.

Redis may be used for:

* Job queues
* Caching
* Rate limiting
* Temporary processing state
* Distributed locks
* Session-related temporary data
* Worker coordination

Redis is NOT the primary database.

Persistent business data must remain in PostgreSQL.

---

## 10. BullMQ

BullMQ runs on Redis and manages asynchronous processing jobs.

Examples:

* FILE_PROCESSING
* PDF_EXTRACTION
* AUDIO_EXTRACTION
* OCR_PROCESSING
* DOCUMENT_STRUCTURE_ANALYSIS
* TEXT_CHUNKING
* EMBEDDING_GENERATION
* KNOWLEDGE_UNIT_GENERATION
* EXERCISE_GENERATION
* AUDIO_GENERATION
* INDEXING

Example flow:

File uploaded
→ Upload completed event
→ BullMQ job created
→ Worker processes file
→ Database updated
→ Frontend receives updated processing status

Never block an HTTP request while waiting for a long-running processing job.

---

## 11. Python Processing Workers

Python workers handle heavy content-processing operations.

Python is preferred for:

* PDF extraction
* OCR
* Audio processing
* Video processing
* Document parsing
* Machine learning
* AI pipelines
* Text processing

Architecture:

BullMQ job
→ Processing worker
→ Extract content
→ Normalize content
→ Store structured results in PostgreSQL/object storage

Python workers should be independently scalable from NestJS.

---

## 12. Content Processing Pipeline

Uploaded material should follow this pipeline:

Upload
→ Validation
→ File registration
→ Extraction
→ Normalization
→ Structure detection
→ Content segmentation
→ Knowledge-unit creation
→ Exercise extraction/generation
→ Embeddings/indexing
→ Ready for learning

The system should preserve the relationship between generated content and its original source.

Every generated exercise should be traceable back to the relevant source material whenever possible.

---

## 12. pgvector

PostgreSQL + pgvector may be used for semantic search.

Pipeline:

Source content
→ Chunking
→ Embedding generation
→ pgvector

Use cases:

* Finding relevant textbook content
* Semantic search
* Finding similar exercises
* Retrieving contextual material
* AI-assisted exercise generation
* Knowledge-unit retrieval

Do not introduce a separate vector database unless PostgreSQL/pgvector becomes insufficient for the application's scale.

---

## 13. AI Layer

AI models should be treated as processing services rather than the source of truth.

AI may be used for:

* Content classification
* Lesson identification
* Knowledge extraction
* Exercise generation
* Question generation
* Difficulty classification
* Speaking prompts
* Feedback
* Summarization
* Semantic analysis

AI-generated content must retain metadata identifying:

* Source material
* Source chapter/lesson
* Model
* Prompt/version
* Generation timestamp
* Processing job

The system should be designed so AI providers can be replaced.

Do not tightly couple the application to one AI provider.

---

## 14. Woodpecker Learning Engine

The Woodpecker engine converts source material into progressive speaking repetition.

Basic flow:

Learning Material
→ Knowledge Units
→ Target Sentences
→ Controlled Repetition
→ Progressive Recall
→ Independent Production
→ Mastery

Exercises should progressively reduce support.

Example:

Level 1:
Listen and repeat.

Level 2:
Repeat with partial prompts.

Level 3:
Complete missing information.

Level 4:
Answer using the target structure.

Level 5:
Produce the target structure independently.

The objective is automatic spoken production rather than passive recognition.

---

## 15. Frontend Application Areas

The application should have shared data across:

* Dashboard
* Upload
* Materials
* Exercises
* Speaking Practice
* Language Mastery
* Progress
* Analytics
* Settings

Uploaded materials must be persisted in the backend/database.

Do not maintain uploaded files only in local React state.

When the user leaves the Upload page and returns later, previously uploaded materials must still appear.

All pages should retrieve their state from the shared backend source of truth.

---

## 15. State Architecture

Use the backend/database as the source of truth.

Do not create separate isolated copies of material state for:

* Dashboard
* Upload
* Exercises
* Language Mastery

Example:

PostgreSQL
→ API
→ Dashboard

PostgreSQL
→ API
→ Upload

PostgreSQL
→ API
→ Exercises

PostgreSQL
→ API
→ Language Mastery

When processing status changes, the relevant frontend views should update accordingly.

---

## 16. Observability

### Sentry

Use Sentry for:

* Backend errors
* Frontend errors
* Worker failures
* Processing failures
* API errors
* Unexpected exceptions

### PostHog

Use PostHog for product analytics.

Track events such as:

* File uploaded
* Processing started
* Processing completed
* Exercise started
* Exercise completed
* Speaking session completed
* Learning unit mastered
* User abandoned session

Do not send sensitive document contents to analytics systems.

---

## 16. Authentication

Authentication should remain separate from the core application database logic.

Preferred:

Clerk

Architecture:

User
→ Clerk
→ Next.js
→ NestJS
→ Application authorization
→ PostgreSQL

The backend must always verify authorization before returning user-specific resources.

Users must never be able to access another user's:

* Files
* Materials
* Exercises
* Progress
* Projects
* Processing jobs

---

## 17. Storage/Data Separation

Follow this rule strictly:

### PostgreSQL

Stores metadata and structured information.

### Object Storage

Stores large files and binary assets.

### Redis

Stores temporary/cache/queue information.

### pgvector

Stores embeddings and semantic-search information.

Example:

File:

20GB PDF

Object storage:
20GB PDF

PostgreSQL:

filename
size
storage_key
status
owner
project_id

Redis:

processing job

pgvector:

embeddings generated from extracted content

---

## 18. Development Environment

Development should preferably run through Docker.

Recommended:

docker-compose

Services:

* PostgreSQL
* Redis
* MinIO

Application services:

* Next.js
* NestJS
* Python workers

This gives development an environment similar to production.

---

## 19. Recommended Architecture

```text
                         USER
                          │
                          ▼
                    ┌───────────┐
                    │  Next.js  │
                    │ Frontend  │
                    └─────┬─────┘
                          │
                          ▼
                    ┌───────────┐
                    │  NestJS   │
                    │    API    │
                    └─────┬─────┘
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
        PostgreSQL      Redis       Object Storage
        + Prisma       + BullMQ     MinIO / R2 / S3
             │            │            │
             │            ▼            │
             │      ┌────────────┐     │
             │      │   Python   │◄────┘
             │      │  Workers   │
             │      └─────┬──────┘
             │            │
             ▼            ▼
          pgvector    Extracted Data
             │
             ▼
       Woodpecker Engine
             │
             ▼
       Speaking Exercises
```

---

## 20. Core Architectural Rules

1. Never send 20GB+ files through NestJS.
2. Upload directly to object storage.
3. Use multipart/resumable uploads.
4. Never store large binary files in PostgreSQL.
5. PostgreSQL is the source of truth for application data.
6. Prisma is the database access layer.
7. Redis is not a persistent database.
8. BullMQ handles long-running asynchronous jobs.
9. Heavy file processing belongs in workers.
10. Never perform long-running processing inside HTTP requests.
11. Every processing operation should be recoverable.
12. Jobs should be idempotent where possible.
13. Processing failures should be retryable.
14. Users must only access their own resources.
15. Generated content should retain source references.
16. Frontend pages must use persistent backend data rather than isolated local state.
17. Storage providers should be abstracted so MinIO can be replaced by R2/S3.
18. AI providers should be abstracted so models can be replaced.
19. Do not introduce additional infrastructure unless there is a clear technical requirement.
20. Optimize for maintainability first, then scale individual components when necessary.

---

## 21. Initial MVP Stack

```text
Frontend:
Next.js 16 + TypeScript + Tailwind + shadcn/ui

Backend:
NestJS

Database:
PostgreSQL

ORM:
Prisma

Local Object Storage:
MinIO

Production Object Storage:
Cloudflare R2

Queue:
Redis + BullMQ

Processing:
Python workers

Vector Search:
PostgreSQL + pgvector

Authentication:
Clerk

Payments:
Stripe

Monitoring:
Sentry

Analytics:
PostHog

Deployment:
Vercel + backend/worker infrastructure
```

The architecture should remain modular so individual components can be scaled or replaced without rewriting the application.