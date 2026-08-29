import { Worker } from 'bullmq'
import { createRedisConnection } from './redis'
import { TRANSFORM_QUEUE_NAME, type TransformJobData } from './transform-queue'
import { runPipeline } from './pipeline'

/**
 * LLM calls can run for minutes without Redis activity. Keep the job lock
 * well above the longest single LLM call so the job is never marked stalled
 * while genuinely processing. If the process dies, BullMQ reclaims the job
 * after `stalledInterval` and retries it (bounded by maxStalledCount).
 */
const WORKER_OPTIONS = {
  concurrency: 1,
  lockDuration: 15 * 60 * 1000,
  lockRenewTime: 5 * 60 * 1000,
  stalledInterval: 60_000,
  maxStalledCount: 2,
}

declare global {
  var __woodpackerTransformWorker: Worker<TransformJobData> | undefined
}

/**
 * Start a transform worker if none is running in this process.
 * The API route calls this lazily so transforms work in `next dev` without a
 * separate process; a dedicated `npm run worker` process is the recommended
 * production deployment (both can coexist — BullMQ scales workers on a queue).
 */
export function ensureTransformWorker(): Worker<TransformJobData> {
  if (globalThis.__woodpackerTransformWorker) {
    return globalThis.__woodpackerTransformWorker
  }
  const worker = new Worker<TransformJobData>(
    TRANSFORM_QUEUE_NAME,
    async (job) => {
      return runPipeline(job)
    },
    {
      connection: createRedisConnection(),
      ...WORKER_OPTIONS,
    }
  )
  worker.on('failed', (job, err) => {
    console.error(`[transform-worker] job ${job?.id} failed after ${job?.attemptsMade} attempt(s): ${err.message}`)
  })
  worker.on('error', (err) => {
    console.error(`[transform-worker] error: ${err.message}`)
  })
  globalThis.__woodpackerTransformWorker = worker
  console.log('[transform-worker] started on queue', TRANSFORM_QUEUE_NAME)
  return worker
}

export async function closeTransformWorker(): Promise<void> {
  const worker = globalThis.__woodpackerTransformWorker
  if (!worker) return
  await worker.close()
  globalThis.__woodpackerTransformWorker = undefined
}