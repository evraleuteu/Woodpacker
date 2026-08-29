-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('free', 'plus', 'premium');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('fill_blank', 'multiple_choice', 'translation', 'recall', 'pattern_drill', 'roleplay', 'comprehension', 'assessment');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('pronunciation', 'fluency', 'comprehension', 'roleplay');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "subscription_plan" "SubscriptionPlan" NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningMaterial" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeUnit" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'beginner',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "knowledge_unit_id" TEXT NOT NULL,
    "type" "ExerciseType" NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'beginner',
    "prompt" TEXT NOT NULL,
    "answer" TEXT,
    "options" JSONB,
    "source_assets" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pattern" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WoodpeckerCycle" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WoodpeckerCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "last_reviewed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingSession" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "score" DOUBLE PRECISION,
    "duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingAttempt" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "transcript" TEXT,
    "feedback" JSONB,
    "score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingPattern" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "mastery_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "automaticity_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_practiced" TIMESTAMP(3),
    "next_review" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingMastery" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "mastery_level" INTEGER NOT NULL DEFAULT 0,
    "cycles_completed" INTEGER NOT NULL DEFAULT 0,
    "last_mastered" TIMESTAMP(3),
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeakingMastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternMastery" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "mastery_level" INTEGER NOT NULL DEFAULT 0,
    "total_attempts" INTEGER NOT NULL DEFAULT 0,
    "automaticity_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "next_review" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "PatternMastery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LearningMaterial_user_id_idx" ON "LearningMaterial"("user_id");

-- CreateIndex
CREATE INDEX "LearningMaterial_status_idx" ON "LearningMaterial"("status");

-- CreateIndex
CREATE INDEX "Chapter_material_id_idx" ON "Chapter"("material_id");

-- CreateIndex
CREATE INDEX "KnowledgeUnit_material_id_idx" ON "KnowledgeUnit"("material_id");

-- CreateIndex
CREATE INDEX "KnowledgeUnit_type_idx" ON "KnowledgeUnit"("type");

-- CreateIndex
CREATE INDEX "Exercise_knowledge_unit_id_idx" ON "Exercise"("knowledge_unit_id");

-- CreateIndex
CREATE INDEX "Exercise_type_idx" ON "Exercise"("type");

-- CreateIndex
CREATE INDEX "Pattern_material_id_idx" ON "Pattern"("material_id");

-- CreateIndex
CREATE INDEX "Pattern_pattern_idx" ON "Pattern"("pattern");

-- CreateIndex
CREATE INDEX "WoodpeckerCycle_material_id_idx" ON "WoodpeckerCycle"("material_id");

-- CreateIndex
CREATE INDEX "WoodpeckerCycle_cycle_number_idx" ON "WoodpeckerCycle"("cycle_number");

-- CreateIndex
CREATE INDEX "Progress_user_id_idx" ON "Progress"("user_id");

-- CreateIndex
CREATE INDEX "Progress_exercise_id_idx" ON "Progress"("exercise_id");

-- CreateIndex
CREATE INDEX "SpeakingSession_user_id_idx" ON "SpeakingSession"("user_id");

-- CreateIndex
CREATE INDEX "SpeakingSession_session_type_idx" ON "SpeakingSession"("session_type");

-- CreateIndex
CREATE INDEX "SpeakingSession_material_id_idx" ON "SpeakingSession"("material_id");

-- CreateIndex
CREATE INDEX "SpeakingAttempt_session_id_idx" ON "SpeakingAttempt"("session_id");

-- CreateIndex
CREATE INDEX "SpeakingPattern_pattern_idx" ON "SpeakingPattern"("pattern");

-- CreateIndex
CREATE INDEX "SpeakingPattern_next_review_idx" ON "SpeakingPattern"("next_review");

-- CreateIndex
CREATE INDEX "SpeakingMastery_user_id_idx" ON "SpeakingMastery"("user_id");

-- CreateIndex
CREATE INDEX "SpeakingMastery_needs_review_idx" ON "SpeakingMastery"("needs_review");

-- CreateIndex
CREATE INDEX "PatternMastery_pattern_idx" ON "PatternMastery"("pattern");

-- CreateIndex
CREATE INDEX "PatternMastery_next_review_idx" ON "PatternMastery"("next_review");

-- AddForeignKey
ALTER TABLE "LearningMaterial" ADD CONSTRAINT "LearningMaterial_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "LearningMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeUnit" ADD CONSTRAINT "KnowledgeUnit_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "LearningMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeUnit" ADD CONSTRAINT "KnowledgeUnit_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_knowledge_unit_id_fkey" FOREIGN KEY ("knowledge_unit_id") REFERENCES "KnowledgeUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pattern" ADD CONSTRAINT "Pattern_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "LearningMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WoodpeckerCycle" ADD CONSTRAINT "WoodpeckerCycle_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "LearningMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingSession" ADD CONSTRAINT "SpeakingSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingAttempt" ADD CONSTRAINT "SpeakingAttempt_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "SpeakingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingAttempt" ADD CONSTRAINT "SpeakingAttempt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingMastery" ADD CONSTRAINT "SpeakingMastery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternMastery" ADD CONSTRAINT "PatternMastery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
