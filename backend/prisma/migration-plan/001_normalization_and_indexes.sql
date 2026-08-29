-- =============================================================================
-- Woodpacker Phase 18: PostgreSQL normalization + performance indexes
-- =============================================================================
-- STATUS: PLAN — apply per phase below. Migrations are owned by the app
-- schema; backend/prisma/schema.prisma mirrors it. Do NOT blind-apply.
--
-- Rules (per audit):
--   1. Never delete duplicated JSON columns until normalized rows exist,
--      reads are migrated, tests pass.
--   2. Every step is idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1 [safe, apply now]: performance indexes for current access patterns
-- -----------------------------------------------------------------------------

-- Fuzzy duplicate detection + inspector text search on exercise prompts.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS exercise_prompt_trgm_idx
  ON "Exercise" USING gin ("prompt" gin_trgm_ops);

-- Full-text search over prompts (replaces LIKE '%…%' scans).
CREATE INDEX IF NOT EXISTS exercise_prompt_fts_idx
  ON "Exercise" USING gin (to_tsvector('german', "prompt"));

-- Inspector queries filter exercises by source asset.
CREATE INDEX IF NOT EXISTS exercise_source_assets_idx
  ON "Exercise" USING gin ("source_assets");

-- LessonMaterial.object_key lookups (telemetry cache resolution).
CREATE INDEX IF NOT EXISTS learning_material_object_key_idx
  ON "LearningMaterial" ("object_key");

-- -----------------------------------------------------------------------------
-- STEP 2 [needs app-side Prisma migration]: processing/observability tables
-- -----------------------------------------------------------------------------
-- Mirrors graph telemetry so the pipeline inspector reads real history even
-- after the Redis TTL expires. Add to schema.prisma on BOTH sides first:
--
-- model ProcessingRun {
--   id           String   @id @default(uuid())
--   job_id       String
--   course_id    String?
--   file_id      String?
--   object_key   String?
--   status       String            // processed | needs_review | failed
--   quality      Json?
--   telemetry    Json?
--   llm_usage    Json?
--   created_at   DateTime @default(now())
--   @@unique([job_id])
--   @@index([course_id])
--   @@index([object_key])
-- }

-- CREATE TABLE "ProcessingRun" (
--   id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
--   "job_id"    TEXT NOT NULL,
--   "course_id" TEXT,
--   "file_id"   TEXT,
--   "object_key" TEXT,
--   "status"    TEXT NOT NULL,
--   "quality"   JSONB,
--   "telemetry" JSONB,
--   "llm_usage" JSONB,
--   "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE UNIQUE INDEX "ProcessingRun_job_id_key" ON "ProcessingRun"("job_id");
-- CREATE INDEX "ProcessingRun_course_id_idx" ON "ProcessingRun"("course_id");
-- CREATE INDEX "ProcessingRun_object_key_idx" ON "ProcessingRun"("object_key");

-- -----------------------------------------------------------------------------
-- STEP 3 [after ProcessingRun ships]: stop double-storing extractions
-- -----------------------------------------------------------------------------
-- LessonMaterialFile.exercises / .items / .images JSON columns duplicate rows
-- that now exist as Exercise / ExerciseItem records and MinIO image objects.
--
--   3a. Backfill check:
--       SELECT count(*) FROM "LessonMaterialFile"
--       WHERE "exercises" IS NOT NULL AND "items" IS NOT NULL;
--   3b. Verify every JSON exercise has a normalized Exercise row (script:
--       backend/scripts/backfill-embeddings.ts pattern).
--   3c. Switch readers (pipeline-inspector buildExerciseView) to normalized
--       tables only.
--   3d. ALTER TABLE "LessonMaterialFile"
--         DROP COLUMN IF EXISTS "items",
--         DROP COLUMN IF EXISTS "images";
--       -- keep "exercises" one release longer as cold backup, then drop.
--
-- DO NOT execute 3d until 3a–3c are verified in staging.
