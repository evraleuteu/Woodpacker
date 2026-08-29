-- CreateTable
CREATE TABLE "ExerciseEmbedding" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "embedding" double precision[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseEmbedding_exercise_id_key" ON "ExerciseEmbedding"("exercise_id");

-- CreateIndex
CREATE INDEX "ExerciseEmbedding_model_idx" ON "ExerciseEmbedding"("model");
