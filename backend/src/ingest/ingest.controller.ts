import { Body, Controller, Get, HttpException, HttpStatus, Inject, Logger, Param, Post } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { IngestService, QUEUES } from './ingest.service'
import type { AssetJobStatus, CourseIngestRequest, CourseIngestStatus, PipelineJobState } from './dto'

@Controller('api/ingest')
export class IngestController {
  private readonly logger = new Logger(IngestController.name)

  constructor(
    @Inject(IngestService) private readonly ingest: IngestService,
    @InjectQueue(QUEUES.extractPdf) private readonly extractQueue: Queue,
    @InjectQueue(QUEUES.registerMedia) private readonly mediaQueue: Queue,
    @InjectQueue(QUEUES.courseLink) private readonly linkQueue: Queue,
  ) {}

  /**
   * Phase 13/15 entry point. Called by the upload finalize step (or
   * manually) once all course assets are in object storage. Never accepts
   * file bodies — only object references.
   */
  @Post('course')
  async ingestCourse(@Body() body: CourseIngestRequest) {
    if (!body?.courseId || !Array.isArray(body?.assets) || !body.assets.length) {
      throw new HttpException('courseId and assets array required', HttpStatus.BAD_REQUEST)
    }
    for (const asset of body.assets) {
      if (!asset.objectKey || !asset.filename || !asset.kind) {
        throw new HttpException('each asset needs objectKey, filename and kind', HttpStatus.BAD_REQUEST)
      }
    }
    const flow = await this.ingest.createCourseIngestFlow(body)
    return { ok: true, ...flow }
  }

  /** Phase 16: QUEUED / PROCESSING / COMPLETED / FAILED / RETRYING / NEEDS_REVIEW */
  @Get('course/:courseId/status')
  async status(@Param('courseId') courseId: string): Promise<CourseIngestStatus> {
    const jobs = await Promise.all([
      this.extractQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused']),
      this.mediaQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused']),
      this.linkQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused']),
    ])
    const prefix = `${courseId}:`
    const assets: AssetJobStatus[] = []

    for (const [idx, queueJobs] of jobs.entries()) {
      const operation: AssetJobStatus['operation'] = idx === 0 ? 'extract' : idx === 1 ? 'register' : 'link'
      for (const job of queueJobs) {
        if (!job.id?.startsWith(prefix)) continue
        const state = await job.getState()
        const returnValue = job.returnvalue as { status?: string; exercises?: number } | undefined
        assets.push({
          jobId: String(job.id),
          operation,
          objectKey: (job.data as { asset?: { objectKey?: string } })?.asset?.objectKey,
          state: mapState(state, returnValue?.status),
          attemptsMade: job.attemptsMade,
          exercisesExtracted: returnValue?.exercises,
          status: returnValue?.status,
          error: state === 'failed' ? (job.failedReason ?? 'failed') : undefined,
        })
      }
    }

    const completed = assets.filter((a) => a.state === 'COMPLETED').length
    const failed = assets.filter((a) => a.state === 'FAILED').length
    const needsReview = assets.filter((a) => a.state === 'NEEDS_REVIEW').length
    const state: PipelineJobState =
      failed > 0 ? 'FAILED' : needsReview > 0 ? 'NEEDS_REVIEW' : completed === assets.length && assets.length > 0 ? 'COMPLETED' : 'PROCESSING'

    return {
      courseId,
      state,
      parentJobId: `${courseId}:course-ingest`,
      totals: { assets: assets.length, completed, failed, needsReview },
      assets,
    }
  }
}

function mapState(bullState: string, resultStatus?: string): PipelineJobState {
  switch (bullState) {
    case 'completed':
      return resultStatus === 'needs_review' ? 'NEEDS_REVIEW' : 'COMPLETED'
    case 'active':
      return 'PROCESSING'
    case 'failed':
      return 'FAILED'
    case 'waiting':
    case 'paused':
    case 'delayed':
    default:
      return 'QUEUED'
  }
}
