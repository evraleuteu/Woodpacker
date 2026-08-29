-- AlterTable
ALTER TABLE "LearningMaterial" ADD COLUMN     "object_key" TEXT,
ADD COLUMN     "size" BIGINT;

-- CreateIndex
CREATE INDEX "LearningMaterial_user_id_title_size_idx" ON "LearningMaterial"("user_id", "title", "size");
