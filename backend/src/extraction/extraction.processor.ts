import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job, Queue } from 'bullmq'
import { PrismaService } from '../prisma/prisma.service'
import { ExtractionService } from './extraction.service'
import { SearchService } from '../search/search.service'
import type { ExtractJobData, ExtractionExercisesResponse, ExtractionFlashcard } from './dto'

export const EXTRACTION_QUEUE = 'woodpacker-extraction'

/** kebab flashcard type -> Prisma ExerciseType enum value. */
const TYPE_TO_ENUM: Record<string, string> = {
  'fill-blank': 'fill_blank',
  'multiple-choice': 'multiple_choice',
  'pattern-drill': 'pattern_drill',
}

function enumTypeOf(type: string): string {
  return TYPE_TO_ENUM[type] ?? type
}

@Processor(EXTRACTION_QUEUE)
export class ExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(ExtractionProcessor.name)

  constructor(
    @InjectQueue(EXTRACTION_QUEUE) private readonly queue: Queue,
    private readonly extraction: ExtractionService,
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
  ) {
    super()
  }

  async process(job: Job<ExtractJobData>): Promise<ExtractionExercisesResponse> {
    const { assets, requireAnswer } = job.data
    const total = assets.length
    this.logger.log(`job ${job.id}: extracting exercises from ${total} assets`)

    await job.updateProgress(10)
    if (!(await this.extraction.isAvailable())) {
      throw new Error('Python extraction service is not reachable (EXTRACTION_SERVICE_URL)')
    }
    await job.updateProgress(30)

    const textAssets = assets.filter((a) => a.text && a.text.trim().length > 0)
    const objectAssets = assets.filter((a) => (!a.text || !a.text.trim()) && a.objectKey)

    let combined: ExtractionExercisesResponse = { mode: 'heuristic', files: [], flashcards: [] }

    if (textAssets.length) {
      const result = await this.extraction.extractFlashcards(textAssets, requireAnswer ?? false)
      await this.persist({ ...job.data, assets: textAssets }, result)
      combined.files.push(...result.files)
      combined.flashcards.push(...result.flashcards)
      if (result.mode === 'llm') combined.mode = 'llm'
    }

    if (objectAssets.length) {
      await job.updateProgress(50)
      for (const asset of objectAssets) {
        try {
          const objectRes = await this.extraction.extractObject({
            object_key: asset.objectKey!,
            file_id: asset.id,
            course_id: job.data.userId,
            require_answer: requireAnswer ?? false,
            media_inventory: [],
            job_id: `${job.id}-${asset.id}`,
          })
          const result = objectRes.result as Record<string, unknown>
          const flashcards = (result.flashcards as Array<Record<string, unknown>> | undefined) ?? []
          const mapped: ExtractionFlashcard[] = flashcards.map((fc) => ({
            id: String(fc.id ?? ''),
            type: String(fc.type ?? 'assessment'),
            prompt: String(fc.prompt ?? ''),
            answer: fc.answer as string | undefined,
            options: fc.options as string[] | undefined,
            page: fc.page as string | undefined,
            name: fc.name as string | undefined,
            source: String(fc.source ?? asset.id),
          }))
          const fileResult: import('./dto').ExtractionFileResult = {
            file_id: asset.id,
            file_name: asset.name,
            mode: (result.extraction_mode as string) === 'llm' ? 'llm' : 'heuristic',
            flashcards: mapped,
            classification: { file_id: asset.id, file_name: asset.name, file_type: asset.kind, confidence: 0 },
            exercises: [],
            questions: [],
            images: [],
            audio_refs: [],
            relationships: [],
            knowledgeGraph: { nodes: [], links: [] },
          }
          const single: ExtractionExercisesResponse = { mode: fileResult.mode as 'llm' | 'heuristic', files: [fileResult], flashcards: mapped }
          await this.persist({ ...job.data, assets: [asset] }, single)
          combined.files.push(fileResult)
          combined.flashcards.push(...mapped)
          if (single.mode === 'llm') combined.mode = 'llm'
        } catch (err) {
          this.logger.warn(`object extraction failed for ${asset.objectKey}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      await job.updateProgress(70)
    }

    if (!textAssets.length && !objectAssets.length) {
      // No extractable content — still succeed with empty result (avoids Failed status)
      await job.updateProgress(100)
      return combined
    }

    await job.updateProgress(100)

    this.logger.log(
      `job ${job.id}: ${combined.flashcards.length} validated flashcards (${combined.mode}) persisted`
    )
    return combined
  }

  /**
   * Persist the extracted graph into PostgreSQL: one LearningMaterial +
   * Chapter + KnowledgeUnit chain per source file, exercises attached below.
   * result.files is index-aligned with the text-bearing assets (the service
   * skips assets without text before calling the Python batch endpoint).
   */
  private async persist(jobData: ExtractJobData, result: ExtractionExercisesResponse): Promise<void> {
    const { userId, assets } = jobData

    // LearningMaterial.user_id references User.id, so make sure the user exists.
    const user = await this.prisma.user.upsert({
      where: { email: userId },
      create: { email: userId },
      update: {},
    })

    for (const asset of assets) {
      // Find flashcards for this asset by file_id (exercises endpoint) or fallback to index
      const file = result.files.find((f) => f.file_id === asset.id)
      const flashcards: ExtractionFlashcard[] = file?.flashcards ?? result.files[assets.indexOf(asset)]?.flashcards ?? []
      if (flashcards.length === 0) continue

      const materialId = `lm-${userId}-${asset.id}`.replace(/[^a-zA-Z0-9_-]/g, '-')
      const material = await this.prisma.learningMaterial.upsert({
        where: { id: materialId },
        create: {
          id: materialId,
          user_id: user.id,
          title: asset.name,
          type: 'exercise',
          language: 'de',
          status: 'processed',
        },
        update: {
          title: asset.name,
          status: 'processed',
          updated_at: new Date(),
        },
      })

      // Create chapter
      let chapter = await this.prisma.chapter.findFirst({
        where: { material_id: material.id },
      })
      if (!chapter) {
        chapter = await this.prisma.chapter.create({
          data: {
            material_id: material.id,
            title: asset.name,
            position: 0,
            content: (asset.text ?? '').slice(0, 200_000) || null,
          },
        })
      }

      // Create knowledge unit (idempotent per material + chapter)
      let unit = await this.prisma.knowledgeUnit.findFirst({
        where: { material_id: material.id, chapter_id: chapter.id },
      })
      if (!unit) {
        unit = await this.prisma.knowledgeUnit.create({
          data: {
            material_id: material.id,
            chapter_id: chapter.id,
            title: `${asset.name} — extracted exercises`,
            type: 'exercises',
            content: `Extracted by the Woodpacker extraction service`,
          },
        })
      }

      // Create exercises (skip re-runs on deterministic ids)
      for (const fc of flashcards) {
        const exerciseId = fc.id
          ? `ex-${materialId}-${fc.id}`
          : `ex-${materialId}-${Math.random().toString(36).slice(2)}`
        const existing = await this.prisma.exercise.findUnique({
          where: { id: exerciseId },
        })
        if (existing) continue
        const exercise = await this.prisma.exercise.create({
          data: {
            id: exerciseId,
            knowledge_unit_id: unit.id,
            type: enumTypeOf(fc.type) as never,
            difficulty: 'beginner' as never,
            prompt: fc.prompt,
            answer: fc.answer ?? null,
            options: fc.options?.length ? fc.options : undefined,
            source_assets: [fc.source, asset.objectKey ?? ''].filter(Boolean),
          },
        })
        await this.search.indexExercise(exercise.id, fc.prompt)
      }
    }
  }
}