/**
 * Standalone BullMQ transform worker.
 * Run with: npm run worker
 * Keeps the process alive; jobs are durable in Redis and survive restarts.
 */
import { ensureTransformWorker, closeTransformWorker } from './lib/transform-worker'

ensureTransformWorker()

const shutdown = async () => {
  console.log('[worker] shutting down…')
  await closeTransformWorker()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

setInterval(() => {}, 1 << 30)