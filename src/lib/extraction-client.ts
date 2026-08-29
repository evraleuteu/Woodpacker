import type { UploadedAsset } from './types'

/**
 * HTTP client for the Python Extraction Service (exercise-extraction stack,
 * now: python-extraction-service → http://python-extraction-service:8001
 * in compose, http://127.0.0.1:8001 locally). The transform worker delegates
 * exercise extraction here when the service is reachable and falls back to
 * the in-app pipeline otherwise.
 *
 * Config (env): PYTHON_EXTRACTION_SERVICE_URL > EXTRACTION_SERVICE_URL (legacy alias)
 * Docling Extraction Service is separate: DOCLING_EXTRACTION_SERVICE_URL (8002)
 * and lives in ./docling-extraction-service
 */

const EXTRACTION_SERVICE_URL =
  process.env.PYTHON_EXTRACTION_SERVICE_URL ??
  process.env.EXTRACTION_SERVICE_URL ??
  'http://127.0.0.1:8001'

export interface ExtractionFlashcard {
  id: string
  type: string
  prompt: string
  answer?: string
  options?: string[]
  page?: string
  name?: string
  /** Asset id the exercise was extracted from. */
  source: string
}

interface HealthResponse {
  status?: string
  engines?: Record<string, string>
}

let availabilityCache: { ok: boolean; at: number } | null = null
const CACHE_MS = 30_000

function jsonFetch<T>(path: string, init?: RequestInit, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(`${EXTRACTION_SERVICE_URL}${path}`, {
    ...init,
    signal: controller.signal,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`extraction service ${path}: HTTP ${res.status}`)
      return (await res.json()) as T
    })
    .finally(() => clearTimeout(timer))
}

/** Probes GET /health (cached 30s). False on any network/parse error. */
export async function extractionServiceAvailable(): Promise<boolean> {
  if (availabilityCache && Date.now() - availabilityCache.at < CACHE_MS) {
    return availabilityCache.ok
  }
  try {
    const health = await jsonFetch<HealthResponse>('/health', undefined, 2_500)
    const ok = health.status === 'ok' || health.status === 'healthy'
    availabilityCache = { ok, at: Date.now() }
    return ok
  } catch {
    availabilityCache = { ok: false, at: Date.now() }
    return false
  }
}

export interface ExtractionFileInput {
  id: string
  name: string
  text: string
}

export interface ExtractionExercisesResponse {
  mode: 'llm' | 'heuristic'
  files: { file_id: string; file_name: string; mode: string; flashcards: ExtractionFlashcard[] }[]
  flashcards: ExtractionFlashcard[]
}

/**
 * Runs the validated exercise extraction (LLM + heuristic fallback) on the
 * given text assets. Returns flashcards keyed by asset id. Throws when the
 * service is unreachable — callers fall back to the in-app pipeline.
 */
export async function extractFlashcardsFromService(
  assets: UploadedAsset[]
): Promise<Map<string, ExtractionFlashcard[]>> {
  const files: ExtractionFileInput[] = assets
    .filter((a) => a.text && a.text.trim().length > 0)
    .map((a) => ({ id: a.id, name: a.name, text: a.text as string }))
  if (!files.length) return new Map()

  const response = await jsonFetch<ExtractionExercisesResponse>('/extract/exercises', {
    method: 'POST',
    body: JSON.stringify({ files }),
  }, 10 * 60_000)

  const byAsset = new Map<string, ExtractionFlashcard[]>()
  for (const entry of response.files) {
    byAsset.set(entry.file_id, entry.flashcards)
  }
  return byAsset
}

/** Layout-first path: call ``POST /analyze/object`` per stored PDF (via MinIO objectKey). */
export async function analyzeObjectsViaLayout(
  assets: UploadedAsset[],
): Promise<Map<string, ExtractionFlashcard[]>> {
  const pdfs = assets.filter((a) => a.objectKey && a.kind === 'pdf')
  if (!pdfs.length) return new Map()
  const byAsset = new Map<string, ExtractionFlashcard[]>()
  for (const asset of pdfs) {
    try {
      const data = await jsonFetch<{
        bundle: { flashcards?: ExtractionFlashcard[]; exercises?: unknown[] }
        legacy: { flashcards: ExtractionFlashcard[] }
      }>(
        '/analyze/object',
        {
          method: 'POST',
          body: JSON.stringify({
            object_key: asset.objectKey,
            file_id: asset.id,
            course_id: '',
          }),
        },
        60_000,
      )
      const flashcards: ExtractionFlashcard[] =
        data.legacy?.flashcards ?? data.bundle?.flashcards ?? []
      if (flashcards.length) byAsset.set(asset.id, flashcards as ExtractionFlashcard[])
    } catch (e) {
      console.warn(`[layout] analyze/object failed for ${asset.name}:`, e)
    }
  }
  return byAsset
}