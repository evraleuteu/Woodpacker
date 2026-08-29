import { Queue, type Job } from 'bullmq'
import { randomUUID } from 'crypto'
import { createRedisConnection } from './redis'
import type { FileRole } from './heuristics'
import type { Course, TransformJob } from './types'

export const TRANSFORM_QUEUE_NAME = 'woodpacker-transform'

export const TRANSFORM_ATTEMPTS = 3
export const TRANSFORM_BACKOFF_MS = 10_000

export interface TransformJobData {
  assets: unknown[]
  /** User-confirmed file roles (assetId → role). Missing ids fall back to AI detection. */
  roles?: Record<string, FileRole>
}

declare global {
  var __woodpackerTransformQueue: Queue<TransformJobData> | undefined
}

function getQueue(): Queue<TransformJobData> {
  if (!globalThis.__woodpackerTransformQueue) {
    globalThis.__woodpackerTransformQueue = new Queue<TransformJobData>(TRANSFORM_QUEUE_NAME, {
      connection: createRedisConnection(),
    })
  }
  return globalThis.__woodpackerTransformQueue
}

/**
 * Enqueue a transformation. Durable in Redis: a server restart does not lose
 * waiting jobs, and BullMQ retries failures with exponential backoff.
 * Returns the stable job id used by the status endpoint.
 */
export async function enqueueTransform(assets: unknown[], roles?: Record<string, FileRole>): Promise<string> {
  const jobId = randomUUID()
  await getQueue().add(
    'transform',
    { assets, roles: roles && Object.keys(roles).length ? roles : undefined },
    {
      jobId,
      attempts: TRANSFORM_ATTEMPTS,
      backoff: { type: 'exponential', delay: TRANSFORM_BACKOFF_MS },
      removeOnComplete: false,
      removeOnFail: false,
    }
  )
  return jobId
}

export async function getTransformJob(id: string): Promise<Job<TransformJobData> | null> {
  const job = await getQueue().getJob(id)
  return job ?? null
}

export type TransformJobStatus = Pick<
  TransformJob,
  'id' | 'status' | 'phase' | 'progress' | 'message' | 'detail' | 'mode' | 'error' | 'result'
> & { result?: Course }

/** Map a BullMQ job to the legacy TransformJob status shape consumed by the client poller. */
export async function toTransformJobStatus(job: Job<TransformJobData>): Promise<TransformJobStatus> {
  const progress = (job.progress ?? {}) as Partial<Pick<TransformJob, 'phase' | 'progress' | 'message' | 'detail' | 'mode'>>
  const state = await job.getState()

  let status: TransformJob['status'] = 'running'
  if (state === 'completed') status = 'done'
  else if (state === 'failed') status = 'error'
  const failed = state === 'failed'

  return {
    id: job.id!,
    status,
    phase: progress.phase ?? 'queued',
    progress: progress.progress ?? 0,
    message: progress.message ?? 'Queued',
    detail: progress.detail ?? '',
    mode: progress.mode ?? 'ai',
    error: failed ? (job.failedReason ?? 'Transformation failed') : undefined,
    result: status === 'done' ? (job.returnvalue as Course | undefined) : undefined,
  }
}