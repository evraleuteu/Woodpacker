import { Body, Controller, Get, HttpException, HttpStatus, Logger, Param, Post } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { randomUUID } from 'crypto'
import { EXTRACTION_QUEUE } from './extraction.processor'
import { ExtractionService } from './extraction.service'
import type { ExtractJobData, ExtractionAssetInput, ExtractionJobStatus } from './dto'

@Controller('api/extract')
export class ExtractionController {
  private readonly logger = new Logger(ExtractionController.name)

  constructor(
    @InjectQueue(EXTRACTION_QUEUE) private readonly queue: Queue<ExtractJobData>,
    private readonly extraction: ExtractionService
  ) {}

  @Get('health')
  async health() {
    const ok = await this.extraction.isAvailable()
    return {
      status: ok ? 'ok' : 'degraded',
      extractionService: this.extraction.url,
      extractionServiceReachable: ok,
    }
  }

  @Post()
  async enqueue(
    @Body() body: { assets?: ExtractionAssetInput[]; requireAnswer?: boolean; userId?: string }
  ) {
    if (!Array.isArray(body?.assets) || !body.assets.length) {
      throw new HttpException('assets array required', HttpStatus.BAD_REQUEST)
    }
    const jobId = randomUUID()
    await this.queue.add(
      'extract',
      {
        userId: body.userId ?? process.env.EXTRACTION_USER_ID ?? 'local@woodpacker.local',
        assets: body.assets,
        requireAnswer: body.requireAnswer ?? false,
      },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: false,
        removeOnFail: false,
      }
    )
    this.logger.log(`enqueued extraction job ${jobId} (${body.assets.length} assets)`)
    return { id: jobId }
  }

  @Get(':id')
  async status(@Param('id') id: string): Promise<ExtractionJobStatus> {
    const job = await this.queue.getJob(id)
    if (!job) {
      throw new HttpException('job not found', HttpStatus.NOT_FOUND)
    }
    const state = await job.getState()
    let status: ExtractionJobStatus['status'] = 'queued'
    if (state === 'active') status = 'running'
    else if (state === 'completed') status = 'done'
    else if (state === 'failed') status = 'error'

    // Phase 16: expose retrying + needs_review explicitly.
    const returnValue = job.returnvalue as { status?: string } | undefined
    const needsReview = returnValue?.status === 'needs_review'
    const retrying = state === 'failed' && job.attemptsMade < (job.opts?.attempts ?? 1)

    return {
      id,
      status,
      progress: typeof job.progress === 'number' ? job.progress : 0,
      mode: (job.progress as { mode?: string })?.mode,
      result: status === 'done' ? (job.returnvalue as ExtractionJobStatus['result']) : null,
      error: status === 'error' ? (job.failedReason ?? 'Extraction failed') : undefined,
      needsReview,
      retrying,
    }
  }
}