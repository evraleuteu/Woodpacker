import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

/**
 * Backfill embeddings for exercises that predate the embedding index.
 * Usage: npm run backfill:embeddings
 */
async function main() {
  const prisma = new PrismaClient()
  const apiKey = process.env.EMBEDDING_API_KEY ?? ''
  const baseUrl = (process.env.EMBEDDING_API_URL ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
  const model = process.env.EMBEDDING_MODEL ?? 'openai/text-embedding-3-small'

  if (!apiKey) {
    throw new Error('EMBEDDING_API_KEY is not set')
  }

  const exercises = await prisma.exercise.findMany()
  let indexed = 0
  let skipped = 0

  for (const ex of exercises) {
    const existing = await prisma.exerciseEmbedding.findUnique({ where: { exercise_id: ex.id } })
    if (existing) {
      skipped++
      continue
    }
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: ex.prompt }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      throw new Error(`embedding failed for ${ex.id}: HTTP ${res.status}`)
    }
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> }
    const vector = json.data?.[0]?.embedding
    if (!vector) throw new Error(`embedding missing for ${ex.id}`)

    await prisma.$executeRaw`
      INSERT INTO "ExerciseEmbedding" ("id", "exercise_id", "model", "embedding", "created_at")
      VALUES (${crypto.randomUUID()}, ${ex.id}, ${model}, ${vector}::double precision[], now())
      ON CONFLICT ("exercise_id")
      DO UPDATE SET "embedding" = EXCLUDED."embedding", "model" = EXCLUDED."model", "created_at" = now()
    `
    indexed++
    console.log(`indexed ${ex.id}`)
  }

  console.log(`done: ${indexed} indexed, ${skipped} already present, ${exercises.length} total`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})