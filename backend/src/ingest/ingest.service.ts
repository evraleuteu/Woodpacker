import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { FlowProducer, Queue } from 'bullmq'
import { createHash } from 'crypto'
import type { CourseIngestRequest, IngestAssetInput } from './dto'

export const QUEUES = {
  extractPdf: 'ingest-extract-pdf',
  registerMedia: 'ingest-register-media',
  courseLink: 'ingest-course-link',
} as const

export const MEDIA_KINDS = new Set(['audio', 'video', 'image'])

/**
 * Deterministic, idempotent job IDs (Phase 14):
 *   {courseId}:{sha256|objectKeyHash}:{operation}
 * Re-enqueuing the same asset for the same course is a no-op while the
 * original job exists (removeOnComplete: false keeps the record).
 */
export function assetJobId(courseId: string, asset: IngestAssetInput, operation: string): string {
  const contentId = asset.sha256 ?? createHash('sha256').update(asset.objectKey).digest('hex')
  return `${courseId}:${contentId.slice(0, 24)}:${operation}`
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name)

  constructor(
    @InjectQueue(QUEUES.extractPdf) private readonly extractQueue: Queue,
    @InjectQueue(QUEUES.registerMedia) private readonly mediaQueue: Queue,
    @InjectQueue(QUEUES.courseLink) private readonly linkQueue: Queue,
    @InjectFlowProducer('ingest-flow') private readonly flowProducer: FlowProducer,
  ) {}

  /**
   * Phase 13 fan-out:
   *
   *   course-ingest (parent)
   *    ├── ingest-extract-pdf     × N documents
   *    ├── ingest-register-media  × M media files
   *    └── ingest-course-link     (runs when all children finish)
   *
   * Job bodies carry ONLY references (objectKey/sha256/kind) — never bytes.
   */
  async createCourseIngestFlow(req: CourseIngestRequest): Promise<{ parentJobId: string; assets: number }> {
    const userId = req.userId ?? process.env.EXTRACTION_USER_ID ?? 'local@woodpacker.local'
    const courseId = req.courseId
    const assets = req.assets ?? []
    if (!courseId) throw new Error('courseId is required')
    if (!assets.length) throw new Error('assets array required')

    const children = assets.map((asset) => {
      const isDocument = !MEDIA_KINDS.has(asset.kind)
      return {
        name: isDocument ? 'extract' : 'register',
        queueName: isDocument ? QUEUES.extractPdf : QUEUES.registerMedia,
        data: {
          userId,
          courseId,
          requireAnswer: req.requireAnswer ?? false,
          asset,
        },
        opts: {
          jobId: assetJobId(courseId, asset, isDocument ? 'extract' : 'register'),
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: false,
          removeOnFail: false,
        },
      } as const
    })

    await this.linkQueue.add(
      'link',
      { userId, courseId, assetCount: assets.length },
      {
        jobId: `${courseId}:course-link`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    )

    const flow = await this.flowProducer.add({
      name: 'course-ingest',
      queueName: QUEUES.courseLink,
      data: { userId, courseId, assetCount: assets.length },
      opts: {
        jobId: `${courseId}:course-ingest`,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
      children,
    })

    this.logger.log(
      `ingest flow ${flow.job.id}: courseId=${courseId} documents=${children.filter((c) => c.queueName === QUEUES.extractPdf).length} media=${children.filter((c) => c.queueName === QUEUES.registerMedia).length}`,
    )
    return { parentJobId: String(flow.job.id), assets: assets.length }
  }
}
