import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type {
  ExtractionAssetInput,
  ExtractionExercisesResponse,
  ExtractionFileResult,
  ExtractionFlashcard,
} from './dto'

/**
 * HTTP client for the Python Extraction Service (exercise-extraction stack).
 * The NestJS worker delegates every extraction job here; the service runs the
 * 10-stage pipeline (LLM discovery + validated heuristic fallback).
 *
 * Renamed: python-extraction-service (compose) lives in ./docling-extraction-service
 * (same Docker image, different command: python -m woodpacker_extraction.server).
 * Env: PYTHON_EXTRACTION_SERVICE_URL > EXTRACTION_SERVICE_URL (legacy alias)
 * Docling service is separate: DOCLING_EXTRACTION_SERVICE_URL (8002)
 */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name)
  private readonly baseUrl: string

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const url =
      this.config.get<string>('PYTHON_EXTRACTION_SERVICE_URL') ??
      this.config.get<string>('EXTRACTION_SERVICE_URL')
    this.baseUrl = (url ?? 'http://127.0.0.1:8001').replace(/\/+$/, '')
  }

  async health(): Promise<{ status: string; engines: Record<string, string> }> {
    const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3_000) })
    if (!res.ok) throw new Error(`extraction health: HTTP ${res.status}`)
    return (await res.json()) as { status: string; engines: Record<string, string> }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return (await this.health()).status === 'ok'
    } catch {
      return false
    }
  }

  /**
   * Phase 13/15: per-object extraction for queue workers. Only references
   * cross the wire — the Python service streams the object from storage.
   */
  async extractObject(payload: {
    object_key: string
    file_id: string
    course_id: string
    require_answer: boolean
    media_inventory: Array<Record<string, unknown>>
    job_id?: string
  }): Promise<{ engine: string; files: number; result: Record<string, unknown> }> {
    const res = await fetch(`${this.baseUrl}/extract/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Per-asset timeout, not a whole-batch timeout. Retries live in BullMQ.
      // Large PDFs (300 pages) need >5 min with LLM per page, so allow 15 min.
      signal: AbortSignal.timeout(15 * 60_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`extraction /extract/object: HTTP ${res.status} ${body.slice(0, 200)}`)
    }
    return (await res.json()) as { engine: string; files: number; result: Record<string, unknown> }
  }

  async extractFlashcards(assets: ExtractionAssetInput[], requireAnswer: boolean): Promise<ExtractionExercisesResponse> {
    const MAX_TEXT = 80_000
    const filesWithText = assets
      .filter((a) => a.text !== undefined && a.text.trim().length > 0)
      .map((a) => ({ ...a, text: a.text!.length > MAX_TEXT ? a.text!.slice(0, MAX_TEXT) : a.text! }))
    if (filesWithText.length === 0) {
      return { mode: 'heuristic', files: [], flashcards: [] }
    }

    // Use the JSON exercises endpoint (validated LLM+heuristic) for text assets.
    // Batch endpoint expects binary PDFs and fails when we send plain text with a .pdf name (500).
    const res = await fetch(`${this.baseUrl}/extract/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: filesWithText.map((a) => ({ id: a.id, name: a.name, text: a.text })),
        require_answer: requireAnswer,
      }),
      signal: AbortSignal.timeout(15 * 60_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`extraction /extract/exercises: HTTP ${res.status} ${body.slice(0, 200)}`)
    }
    const payload = (await res.json()) as ExtractionExercisesResponse
    // exercises endpoint returns {mode, files:[{file_id, flashcards}], flashcards}
    // Normalize to the same shape the caller expects; no need to re-parse batch's merged graph.
    if (payload.files && Array.isArray(payload.flashcards)) {
      return payload
    }
    const merged = (payload as unknown as { result?: Record<string, unknown> }).result ?? (payload as unknown as Record<string, unknown>)

    const getArray = (key: string): Array<Record<string, unknown>> => {
      const val = merged[key]
      if (!Array.isArray(val)) return []
      return val as Array<Record<string, unknown>>
    }

    const flashcards: ExtractionFlashcard[] = getArray('flashcards').map(
      (fc) => ({
        id: fc.id as string,
        type: fc.type as string,
        prompt: fc.prompt as string,
        answer: fc.answer as string | undefined,
        options: fc.options as string[] | undefined,
        page: fc.page as string | undefined,
        name: fc.name as string | undefined,
        source: fc.source as string,
      }),
    )

    const classifications = getArray('classifications')
    const exercises = getArray('exercises')
    const questions = getArray('questions')
    const images = getArray('images')
    const audio = getArray('audio')

    const files: ExtractionFileResult[] = classifications.map((c, i) => {
      const fileId = String(c.file_id ?? `file-${i}`)
      const exPrefix = `ex-${fileId}-`
      const imgPrefix = `img-${fileId}-`
      return {
        file_id: fileId,
        file_name: String(c.file_name ?? ''),
        mode: merged.extraction_mode === 'llm' ? 'llm' : 'heuristic',
        flashcards: flashcards.filter((fc) => fc.source === fileId),
        classification: {
          file_id: fileId,
          file_name: String(c.file_name ?? ''),
          file_type: String(c.file_type ?? ''),
          confidence: Number(c.confidence ?? 0),
        },
        exercises: exercises
          .filter((e) => String(e.exercise_id ?? '').startsWith(exPrefix))
          .map((e) => ({
            exercise_id: e.exercise_id as string,
            chapter: e.chapter as string,
            section: e.section as string,
            exercise_title: e.exercise_title as string,
            exercise_type: e.exercise_type as string,
            page: Number(e.page ?? 0),
          })),
        questions: questions
          .filter((q) => String(q.exercise_id ?? '').startsWith(exPrefix))
          .map((q) => ({
            exercise_item_id: q.exercise_item_id as string,
            exercise_id: q.exercise_id as string,
            question: q.question as string,
            answer: q.answer as string | undefined,
            position: Number(q.position ?? 0),
            page: q.page as string | undefined,
            linked_images: q.linked_images as string[] | undefined,
            linked_audio: q.linked_audio as string[] | undefined,
          })),
        images: images
          .filter((img) => String(img.image_id ?? '').startsWith(imgPrefix))
          .map((img) => ({
            image_id: img.image_id as string,
            page: Number(img.page ?? 0),
            bbox: img.bbox as number[],
            ext: img.ext as string,
            description: img.description as string | undefined,
            data_size: Number(img.data_size ?? 0),
          })),
        audio_refs: audio
          .filter((a) => String(a.exercise_id ?? '').startsWith(exPrefix))
          .map((a) => ({
            exercise_id: a.exercise_id as string,
            media_type: a.media_type as string,
            numbers: a.numbers as number[],
          })),
        relationships: getArray('relationships')
          .filter((r) => String(r.from_exercise_id ?? '').startsWith(exPrefix))
          .map((r) => ({
            from_exercise_id: r.from_exercise_id as string,
            to_exercise_id: r.to_exercise_id as string,
            relationship_type: r.relationship_type as string,
            confidence: Number(r.confidence ?? 0),
            rationale: r.rationale as string,
          })),
        knowledgeGraph: {
          nodes: (merged.knowledgeGraph as { nodes: Array<{ id: string; type: string; label: string }> })?.nodes ?? [],
          links: (merged.knowledgeGraph as { links: Array<{ relationship: string; from: string; to: string; confidence: number; rationale: string }> })?.links ?? [],
        },
      }
    })

    const mode: 'llm' | 'heuristic' = merged.extraction_mode === 'llm' ? 'llm' : 'heuristic'
    return { mode, files, flashcards }
  }

  get url(): string {
    return this.baseUrl
  }
}