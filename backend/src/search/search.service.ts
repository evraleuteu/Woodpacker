import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { EmbeddingService } from './embedding.service'

export interface ExerciseSearchHit {
  exerciseId: string
  type: string
  prompt: string
  score: number
  model: string
}

/**
 * Semantic knowledge search over extracted exercises using cosine similarity.
 * Embeddings are stored in a plain `double precision[]` column so the code
 * runs on any Postgres; swap the column type to `vector(1536)` and add an
 * HNSW index when pgvector is available.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  async indexExercise(exerciseId: string, text: string): Promise<void> {
    if (!this.embeddings.enabled) return
    try {
      const vector = await this.embeddings.embed(text)
      await this.prisma.$executeRaw`
        INSERT INTO "ExerciseEmbedding" ("id", "exercise_id", "model", "embedding", "created_at")
        VALUES (${crypto.randomUUID()}, ${exerciseId}, ${this.embeddings.modelName}, ${vector}::double precision[], now())
        ON CONFLICT ("exercise_id")
        DO UPDATE SET "embedding" = EXCLUDED."embedding", "model" = EXCLUDED."model", "created_at" = now()
      `
    } catch (err) {
      this.logger.warn(`embedding index failed for ${exerciseId}: ${(err as Error).message}`)
    }
  }

  async searchExercises(query: string, limit = 10): Promise<ExerciseSearchHit[]> {
    if (!this.embeddings.enabled) {
      throw new Error('Embedding service is not configured (EMBEDDING_API_KEY)')
    }
    const queryEmbedding = await this.embeddings.embed(query)
    const rows = await this.prisma.$queryRaw<
      Array<{ exerciseId: string; type: string; prompt: string; score: number | null; model: string }>
    >`
      WITH scored AS (
        SELECT
          e."exercise_id" AS "exerciseId",
          e."model" AS "model",
          ex."type" AS "type",
          ex."prompt" AS "prompt",
          (
            SELECT sum(a * b) / NULLIF(sqrt(sum(a * a)) * sqrt(sum(b * b)), 0)
            FROM unnest(e."embedding", ${queryEmbedding}::double precision[]) AS v(a, b)
          ) AS "score"
        FROM "ExerciseEmbedding" e
        JOIN "Exercise" ex ON ex."id" = e."exercise_id"
      )
      SELECT * FROM scored
      WHERE "score" IS NOT NULL
      ORDER BY "score" DESC
      LIMIT ${limit}
    `
    return rows.map((r) => ({ ...r, score: r.score ?? 0 }))
  }
}