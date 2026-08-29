-- CreateTable
CREATE TABLE "LessonMaterial" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'de',
    "status" TEXT NOT NULL DEFAULT 'processed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonMaterialFile" (
    "id" TEXT NOT NULL,
    "lesson_material_id" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "object_key" TEXT,
    "minio_bucket" TEXT,
    "file_size" BIGINT,
    "mime_type" TEXT,
    "page_count" INTEGER,
    "word_count" INTEGER,
    "classification" JSONB,
    "exercises" JSONB,
    "items" JSONB,
    "images" JSONB,
    "audio_refs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonMaterialFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonMaterialLink" (
    "id" TEXT NOT NULL,
    "lesson_material_id" TEXT NOT NULL,
    "from_exercise_id" TEXT NOT NULL,
    "to_exercise_id" TEXT NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonMaterialLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonMaterial_user_id_idx" ON "LessonMaterial"("user_id");

-- CreateIndex
CREATE INDEX "LessonMaterial_lesson_id_idx" ON "LessonMaterial"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "LessonMaterial_user_id_lesson_id_key" ON "LessonMaterial"("user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "LessonMaterialFile_lesson_material_id_idx" ON "LessonMaterialFile"("lesson_material_id");

-- CreateIndex
CREATE INDEX "LessonMaterialFile_file_type_idx" ON "LessonMaterialFile"("file_type");

-- CreateIndex
CREATE UNIQUE INDEX "LessonMaterialFile_lesson_material_id_file_type_key" ON "LessonMaterialFile"("lesson_material_id", "file_type");

-- CreateIndex
CREATE INDEX "LessonMaterialLink_lesson_material_id_idx" ON "LessonMaterialLink"("lesson_material_id");

-- CreateIndex
CREATE INDEX "LessonMaterialLink_from_exercise_id_idx" ON "LessonMaterialLink"("from_exercise_id");

-- CreateIndex
CREATE INDEX "LessonMaterialLink_to_exercise_id_idx" ON "LessonMaterialLink"("to_exercise_id");

-- AddForeignKey
ALTER TABLE "LessonMaterialFile" ADD CONSTRAINT "LessonMaterialFile_lesson_material_id_fkey" FOREIGN KEY ("lesson_material_id") REFERENCES "LessonMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
