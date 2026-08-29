import { randomUUID } from 'crypto'
import { PROVIDER_CONFIG } from '@/lib/benchmark/config'
import { calculateMetrics } from '@/lib/benchmark/metrics'
import { normalizeExtraction } from '@/lib/benchmark/normalize'
import { saveBenchmark } from '@/lib/benchmark/store'
import { EXTRACTION_ENGINES, type BenchmarkResult, type BenchmarkRun, type ExtractionEngine } from '@/lib/benchmark/types'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MAX_PDF_BYTES = 100 * 1024 * 1024
const PROVIDER_CONNECT_TIMEOUT_MS = 10_000
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] // '%PDF-'

function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= PDF_SIGNATURE.length &&
    PDF_SIGNATURE.every((byte, index) => bytes[index] === byte)
  )
}

function serializeError(error: unknown, config: { label: string; timeoutMs: number }): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return `${config.label}: timed out after ${config.timeoutMs}ms`
  }
  return error instanceof Error ? error.message : 'Provider failed'
}

async function runEngine(engine: ExtractionEngine, file: File): Promise<BenchmarkResult> {
  const config = PROVIDER_CONFIG[engine]
  const startedAt = new Date()
  const controller = new AbortController()
  let timeoutMs = config.timeoutMs
  const extractionTimer = setTimeout(() => controller.abort(), config.timeoutMs)
  const connectTimer = setTimeout(() => {
    timeoutMs = PROVIDER_CONNECT_TIMEOUT_MS
    controller.abort()
  }, PROVIDER_CONNECT_TIMEOUT_MS)
  try {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch(`${config.url.replace(/\/$/, '')}/extract`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(connectTimer)
    if (!response.ok) {
      const detail = (await response.text()).trim().slice(0, 200)
      throw new Error(`${config.label}: HTTP ${response.status}${detail ? ` — ${detail}` : ''}`)
    }
    const rawOutput: unknown = await response.json()
    const normalizedOutput = normalizeExtraction(rawOutput, engine)
    const durationMs = Date.now() - startedAt.getTime()
    return {
      engine,
      status: 'completed',
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      rawOutput,
      normalizedOutput,
      metrics: calculateMetrics(engine, normalizedOutput, durationMs),
    }
  } catch (error) {
    return {
      engine,
      status: 'failed',
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      error: serializeError(error, { ...config, timeoutMs }),
    }
  } finally {
    clearTimeout(connectTimer)
    clearTimeout(extractionTimer)
  }
}

function encodeEvent(encoder: TextEncoder, event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get('content-type') ?? ''
  const form = contentType.includes('multipart/form-data')
    ? await request.formData()
    : null
  const entry = form?.get('file')

  if (!entry || typeof entry === 'string') {
    return Response.json({ error: 'Upload a PDF in the file field.' }, { status: 400 })
  }

  const pdf = new Uint8Array(await entry.arrayBuffer())
  if (pdf.byteLength === 0) {
    return Response.json({ error: 'Uploaded file is empty.' }, { status: 400 })
  }
  if (pdf.byteLength > MAX_PDF_BYTES) {
    return Response.json({ error: 'PDF exceeds the 100MB size limit.' }, { status: 413 })
  }
  if (!isPdf(pdf)) {
    return Response.json({ error: 'Uploaded file is not a valid PDF.' }, { status: 400 })
  }

  const results: (BenchmarkResult | null)[] = EXTRACTION_ENGINES.map(() => null)
  const runId = randomUUID()
  const createdAt = new Date().toISOString()
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encodeEvent(encoder, 'meta', {
          runId,
          originalFileName: entry.name,
          fileSize: entry.size,
          createdAt,
        }),
      )

      void Promise.all(
        EXTRACTION_ENGINES.map(async (engine, index) => {
          const result = await runEngine(engine, entry)
          results[index] = result
          controller.enqueue(encodeEvent(encoder, 'result', result))
        }),
      )
        .then(() => {
          const pageCount =
            results.find((result) => result?.normalizedOutput)?.normalizedOutput
              ?.metadata.pageCount ?? 1
          const run: BenchmarkRun = {
            id: runId,
            originalFileName: entry.name,
            fileSize: entry.size,
            pageCount,
            createdAt,
            status:
              results.every((result) => result?.status === 'failed')
                ? 'failed'
                : 'completed',
            results: results.filter(
              (result): result is BenchmarkResult => result !== null,
            ),
          }
          saveBenchmark(run)
          controller.enqueue(encodeEvent(encoder, 'done', run))
          controller.close()
        })
        .catch((error: unknown) => {
          controller.enqueue(
            encodeEvent(encoder, 'error', {
              error: error instanceof Error ? error.message : 'Benchmark failed',
            }),
          )
          controller.close()
        })
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
    },
  })
}
