/**
 * Smoke test for the BullMQ transform queue.
 * Enqueues a job that will fail fast (no assets) and verifies:
 * enqueue -> worker picks up -> retries with backoff -> failed state -> status mapping.
 * Run: npx tsx scripts/smoke-transform.ts
 */
import { enqueueTransform, getTransformJob, toTransformJobStatus } from '../src/lib/transform-queue'
import { ensureTransformWorker } from '../src/lib/transform-worker'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  ensureTransformWorker()
  const id = await enqueueTransform([])
  console.log('enqueued job', id)

  for (let i = 0; i < 60; i++) {
    await sleep(1500)
    const job = await getTransformJob(id)
    if (!job) {
      console.log('job not found')
      return
    }
    const status = await toTransformJobStatus(job)
    console.log(
      `[${i}] state=${await job.getState()} attempts=${job.attemptsMade} phase=${status.phase} progress=${status.progress} status=${status.status}`
    )
    if (status.status !== 'running') {
      console.log('final:', JSON.stringify(status, null, 2))
      return
    }
  }
  console.log('timed out')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })