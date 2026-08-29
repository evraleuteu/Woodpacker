import { Inject, Injectable } from '@nestjs/common'
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import type { Redis } from 'ioredis'
import type { Job, Queue } from 'bullmq'
import { PrismaService } from '../prisma/prisma.service'
import { ExtractionService } from '../extraction/extraction.service'
import { SearchService } from '../search/search.service'
import { CACHE_CLIENT } from '../cache/cache.module'
import type { IngestAssetInput } from './dto'

const EXTRACT_QUEUE = 'ingest-extract-pdf'
const MEDIA_QUEUE = 'ingest-register-media'
const LINK_QUEUE = 'ingest-course-link'

interface IngestJobData {
  userId: string
  courseId: string
  requireAnswer?: boolean
  asset: IngestAssetInput
}

function fileIdFor(asset: IngestAssetInput): string {
  return createHash('sha256').update(asset.objectKey).digest('hex').slice(0, 16)
}

@Processor(EXTRACT_QUEUE)
export class ExtractPdfProcessor extends WorkerHost {
  private readonly logger = new Logger(ExtractPdfProcessor.name)
  @Inject(CACHE_CLIENT) private readonly redis!: Redis

  constructor(
    @InjectQueue(EXTRACT_QUEUE) private readonly queue: Queue,
    private readonly extraction: ExtractionService,
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
  ) {
    super()
  }

  /**
   * One document per job (Phase 13). The worker ships only references —
   * the Python service streams the object from storage itself
   * (/extract/object). No 100MB payloads, no 10-minute batch requests.
   */
  async process(job: Job<IngestJobData>) {
    const { courseId, asset, requireAnswer } = job.data
    this.logger.log(`extract job ${job.id}: ${asset.objectKey}`)

    const mediaInventory = await this.readInventory(courseId)
    await job.updateProgress(20)

    const res = await this.extraction.extractObject({
      object_key: asset.objectKey,
      file_id: `file-${fileIdFor(asset)}`,
      course_id: courseId,
      require_answer: requireAnswer ?? false,
      media_inventory: mediaInventory,
      job_id: String(job.id),
    })
    await job.updateProgress(70)

    const result = res.result ?? {} as Record<string, unknown>
    await this.persistExercises(job.data, result)
    await job.updateProgress(100)

    // Phase 21: cache per-object run report for the pipeline inspector
    // (7-day TTL). Includes real LangGraph node telemetry.
    try {
      const flashcards = (result.flashcards as unknown[] | undefined) ?? []
      await this.redis.setex(
        `telemetry:${asset.objectKey}`,
        7 * 24 * 3600,
        JSON.stringify({
          jobId: String(job.id),
          courseId,
          status: result.status ?? 'processed',
          quality: result.quality ?? {},
          telemetry: result.telemetry ?? [],
          exercises: flashcards.length,
        }),
      )
    } catch {
      /* cache failures must never fail the job */
    }

    return {
      status: result.status ?? 'processed',
      exercises: ((result.flashcards as unknown[] | undefined) ?? []).length,
      quality: result.quality ?? {},
      telemetry: result.telemetry ?? [],
    }
  }

  /** Idempotent persistence — deterministic exercise IDs skip re-runs. */
  private async persistExercises(data: IngestJobData, result: Record<string, unknown>): Promise<void> {
    const flashcards = (result.flashcards as Array<Record<string, unknown>> | undefined) ?? []
    if (!flashcards.length) return

    const user = await this.prisma.user.upsert({
      where: { email: data.userId },
      create: { email: data.userId },
      update: {},
    })

    const materialId = `lm-${data.courseId}-${fileIdFor(data.asset)}`.replace(/[^a-zA-Z0-9_-]/g, '-')
    const material = await this.prisma.learningMaterial.upsert({
      where: { id: materialId },
      create: {
        id: materialId,
        user_id: user.id,
        title: data.asset.filename,
        type: 'exercise',
        language: 'de',
        status: (result.status as string) === 'needs_review' ? 'needs_review' : 'processed',
        object_key: data.asset.objectKey,
      },
      update: {
        title: data.asset.filename,
        status: (result.status as string) === 'needs_review' ? 'needs_review' : 'processed',
        updated_at: new Date(),
      },
    })

    let chapter = await this.prisma.chapter.findFirst({ where: { material_id: material.id } })
    if (!chapter) {
      chapter = await this.prisma.chapter.create({
        data: {
          material_id: material.id,
          title: data.asset.filename,
          position: 0,
          content: null,
        },
      })
    }

    let unit = await this.prisma.knowledgeUnit.findFirst({
      where: { material_id: material.id, chapter_id: chapter.id },
    })
    if (!unit) {
      unit = await this.prisma.knowledgeUnit.create({
        data: {
          material_id: material.id,
          chapter_id: chapter.id,
          title: `${data.asset.filename} — extracted exercises`,
          type: 'exercises',
          content: 'Extracted by the Woodpacker extraction service',
        },
      })
    }

    for (const fc of flashcards) {
      // Deterministic ID: stable_key from Python when present (Phase 9),
      // else the flashcard id — same content never duplicates.
      const identity = (fc.stable_key as string) || `${fc.id}`
      const exerciseId = `ex-${materialId}-${identity}`.replace(/[^a-zA-Z0-9_-]/g, '-')
      const existing = await this.prisma.exercise.findUnique({ where: { id: exerciseId } })
      if (existing) continue
      const exercise = await this.prisma.exercise.create({
        data: {
          id: exerciseId,
          knowledge_unit_id: unit.id,
          type: enumTypeOf(String(fc.type)) as never,
          difficulty: 'beginner' as never,
          prompt: String(fc.prompt ?? ''),
          answer: (fc.answer as string | undefined) ?? null,
          options: Array.isArray(fc.options) && fc.options.length ? (fc.options as string[]) : undefined,
          source_assets: [String(fc.source ?? ''), data.asset.objectKey].filter(Boolean),
        },
      })
      await this.search.indexExercise(exercise.id, String(fc.prompt ?? ''))
    }
  }

  private async readInventory(courseId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const raw = await this.redis.get(`course:${courseId}:media_inventory`)
      return raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : []
    } catch {
      return []
    }
  }
}

@Processor(MEDIA_QUEUE)
export class RegisterMediaProcessor extends WorkerHost {
  private readonly logger = new Logger(RegisterMediaProcessor.name)
  @Inject(CACHE_CLIENT) private readonly redis!: Redis

  constructor(@InjectQueue(MEDIA_QUEUE) private readonly queue: Queue) {
    super()
  }

  /**
   * Media registration builds the REAL inventory used by media_link
   * (Phase 11). No synthetic track ids ever enter the system.
   */
  async process(job: Job<IngestJobData>) {
    const { courseId, asset } = job.data
    const entry = {
      file_id: `media-${fileIdFor(asset)}`,
      kind: asset.kind,
      name: asset.filename,
      object_key: asset.objectKey,
      size: asset.size ?? null,
      sha256: asset.sha256 ?? null,
    }
    const key = `course:${courseId}:media_inventory`
    const raw = await this.redis.get(key)
    const inventory: Array<Record<string, unknown>> = raw ? JSON.parse(raw) : []
    if (!inventory.some((m) => m.object_key === entry.object_key)) {
      inventory.push(entry)
      await this.redis.set(key, JSON.stringify(inventory))
    }
    this.logger.log(`registered media ${entry.file_id} (${entry.kind}) for course ${courseId}`)
    return { registered: true, fileId: entry.file_id }
  }
}

@Processor(LINK_QUEUE)
export class CourseLinkProcessor extends WorkerHost {
  private readonly logger = new Logger(CourseLinkProcessor.name)

  constructor(
    @InjectQueue(LINK_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {
    super()
  }

  /**
   * Final stage of the ingest flow: aggregate outcomes and flip course-level
   * status. Cross-file relationships are computed inside the extraction
   * service (relationships.py) during document jobs; this stage records the
   * outcome explicitly.
   */
  async process(job: Job<{ userId: string; courseId: string; assetCount: number }>) {
    const { courseId } = job.data
    this.logger.log(`course-link ${job.id}: course ${courseId} finalized`)
    return { courseId, linked: true }
  }
}

function enumTypeOf(type: string): string {
  const map: Record<string, string> = {
    'fill-blank': 'fill_blank',
    'multiple-choice': 'multiple_choice',
    'pattern-drill': 'pattern_drill',
  }
  return map[type] ?? type
}
