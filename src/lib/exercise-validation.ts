import type { AssetKind, Exercise, ExerciseType } from './types'

export const VALID_EXERCISE_TYPES = [
  'fill-blank',
  'multiple-choice',
  'translation',
  'recall',
  'pattern-drill',
  'roleplay',
  'comprehension',
  'assessment',
] as const

const REQUIRED_ANSWER_TYPES: ReadonlySet<ExerciseType> = new Set([
  'fill-blank',
  'multiple-choice',
  'translation',
  'recall',
])

export interface RawExerciseInput {
  type?: string
  prompt?: string
  answer?: string
  options?: string[]
  page?: string
  name?: string
}

export type ValidatedExercise = Pick<Exercise, 'type' | 'prompt' | 'answer' | 'options' | 'page' | 'name'>

export interface ExerciseValidation {
  valid: boolean
  reasons: string[]
  exercise?: ValidatedExercise
}

export interface ValidationOptions {
  /** Require an answer key (used when exercises must be self-checkable). Default false. */
  requireAnswer?: boolean
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[a-z]\s*[).]\s*/, '')
}

export function isJunkExercisePrompt(prompt: string): boolean {
  const p = (prompt ?? '').trim()
  if (!p) return true
  if (p.includes('›')) return true
  if (/^\s*\d+(\.\d+)?(\s+\d+(\.\d+)?){2,}\b/.test(p)) return true
  if (/^\s*(cd\s*1?|track|spur)\b/i.test(p)) return true
  if (/^[\d\s.,:;()\-–—]+$/.test(p)) return true
  return false
}

function fail(reasons: string[], reason: string): ExerciseValidation {
  reasons.push(reason)
  return { valid: false, reasons }
}

/**
 * Validates an extracted exercise before it is posted to a course.
 * Cleans markdown, checks prompt quality, answerability and multiple-choice
 * integrity, and strips garbage references (track listings, titles, markers).
 */
export function validateExtractedExercise(raw: RawExerciseInput, opts: ValidationOptions = {}): ExerciseValidation {
  const reasons: string[] = []

  const type = raw.type as ExerciseType
  if (!VALID_EXERCISE_TYPES.includes(type)) return fail(reasons, `invalid-type:${raw.type ?? ''}`)

  const prompt = stripMarkdown((raw.prompt ?? '').trim())
  if (!prompt) return fail(reasons, 'empty-prompt')
  if (prompt.length < 8) return fail(reasons, 'prompt-too-short')
  if (prompt.length > 2000) return fail(reasons, 'prompt-too-long')
  if (/\[PAGE\s*\d+\]/i.test(prompt)) return fail(reasons, 'contains-page-marker')
  if (isJunkExercisePrompt(prompt)) return fail(reasons, 'junk-prompt')
  const letters = (prompt.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) ?? []).length
  if (letters < 2) return fail(reasons, 'no-letters')
  const lower = (prompt.match(/[a-zà-öø-ÿ]/g) ?? []).length
  if (lower === 0 && prompt.length < 40) return fail(reasons, 'all-caps-title')

  const name = cleanReference(raw.name, 60)
  const page = cleanReference(raw.page, 30)
  if (name && /^\d+(\.\d+)?$/.test(name)) return fail(reasons, `track-number-name:${name}`)
  if (page && !/\d/.test(page)) return fail(reasons, 'page-without-number')

  const answerRaw = (raw.answer ?? '').trim()
  if (opts.requireAnswer && REQUIRED_ANSWER_TYPES.has(type) && !answerRaw) {
    return fail(reasons, 'missing-answer')
  }
  let answer: string | undefined
  if (answerRaw) {
    answer = stripMarkdown(answerRaw)
    const maxLen = type === 'fill-blank' ? 150 : 800
    if (answer.length > maxLen) return fail(reasons, `answer-too-long:${type}`)
  }

  let options: string[] | undefined
  if (type === 'multiple-choice') {
    options = (raw.options ?? [])
      .map((o) => stripMarkdown(o).trim())
      .filter(Boolean)
      .slice(0, 6)
    if (options.length < 2) return fail(reasons, 'too-few-options')
    if (new Set(options.map(normalize)).size < 2) return fail(reasons, 'duplicate-options')
    if (opts.requireAnswer && answer) {
      const normalizedAnswer = normalize(answer)
      const exact = options.find((o) => normalize(o) === normalizedAnswer)
      const prefix =
        exact ??
        (normalizedAnswer.length >= 3
          ? options.find((o) => normalize(o).startsWith(normalizedAnswer) || (normalizedAnswer.length >= 4 && normalizedAnswer.startsWith(normalize(o))))
          : undefined)
      if (!prefix) return fail(reasons, 'answer-not-in-options')
      answer = prefix
    }
  }

  const exercise: ValidatedExercise = { type, prompt }
  if (answer) exercise.answer = answer
  if (options) exercise.options = options
  if (name) exercise.name = name
  if (page) exercise.page = page

  return { valid: true, reasons: [], exercise }
}

function cleanReference(value: string | undefined, maxLen: number): string | undefined {
  const v = (value ?? '').trim()
  if (!v || v.length > maxLen || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v)) return undefined
  return v
}

// --- Publish gate ----------------------------------------------------------

export interface PublishSourceFile {
  id: string
  kind: AssetKind
  /** Total pages of the document. Required for a PDF page reference to be displayable. */
  pageCount?: number
  text?: string
}

export interface PublishExerciseContext {
  /** Every file attached to the course (`sourceFiles`). */
  sourceFiles: PublishSourceFile[]
  /** Titles of every lesson in the course, used to resolve exercise names. */
  lessonTitles: string[]
}

export interface PublishExerciseResult {
  action: 'publish' | 'clean' | 'reject'
  exercise?: Exercise
  reasons: string[]
}

const PAGE_BEARING_KINDS: ReadonlySet<AssetKind> = new Set(['pdf', 'docx', 'epub', 'pptx'])

const PAGE_NEEDING_TYPES: ReadonlySet<ExerciseType> = new Set(['comprehension', 'assessment', 'fill-blank', 'multiple-choice'])

const SOURCE_DEPENDENT_PATTERN =
  /(?:listen to|listen again|look at (?:the )?(?:picture|image|photo|map|chart|graph|diagram|figure)|see (?:the )?(?:picture|image|photo)|read (?:the )?(?:text|passage|article|story|dialogue|conversation|email|letter)|based on (?:the )?(?:text|passage|reading|listening|audio|video|picture)|according to (?:the )?(?:text|passage|reading|listening)|refer(?:ring)? to (?:the )?(?:text|passage|page|picture|audio|video)|(?:track|cd|spur)\s*\d+|page\s*\d+|seite\s*\d+|auf\s+(?:der\s+)?seite\s*\d+|sieh(?:e)? dir (?:das|die|den) (?:bild|foto|grafik|karte|abbildung)|hör(?:e)? (?:dir )?(?:das|die|den) (?:audio|lied|text|dialog|gespräch|track)|lese? (?:den|die|das) (?:text|dialog|artikel|geschichte)|basierend auf|schau(?:e)? (?:auf|dir) (?:das|die|den) (?:bild|foto|grafik)|play (?:the )?(?:audio|recording|track))/i

const LISTENING_PATTERN = /(?:listen(?:ing)?\b|track\s*\d|cd\s*\d|spur\s*\d|hör(?:e|en)?\b|audio|recording|play the)/i

const LAST_PAGE_PATTERN = /(?:last page|final page|letzte seite|letzten seiten)/i

const EXERCISE_LABEL_WORD = /^(?:aufgabe|übung|exercise|exercice|activity|actividad|task|ex)\s*[\d.]+[a-z]?$/i

const EXERCISE_LABEL_BARE = /^\d{1,3}[a-z]?(?:\s*[./-]\s*[1-9]\d{0,2}[a-z]?)?$/i

/** Parses a page reference into concrete page numbers: "S. 24-26" → [24,25,26], "S. 10, 12" → [10,12], "A6" → [6]. */
export function parsePageRefs(page: string): number[] {
  const nums: number[] = []
  const re = /(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(page)) !== null) {
    const start = parseInt(m[1], 10)
    const end = m[2] ? parseInt(m[2], 10) : undefined
    if (end !== undefined) {
      if (end >= start) {
        for (let n = start; n <= end && nums.length < 64; n++) nums.push(n)
      } else {
        nums.push(start, end)
      }
    } else {
      nums.push(start)
    }
  }
  return nums
}

function findPageAsset(ids: string[], files: PublishSourceFile[]): PublishSourceFile | undefined {
  const found = ids.map((id) => files.find((f) => f.id === id)).filter((f): f is PublishSourceFile => !!f)
  return found.find((f) => f.kind === 'pdf') ?? found.find((f) => PAGE_BEARING_KINDS.has(f.kind))
}

function isPlausibleLabel(name: string): boolean {
  return EXERCISE_LABEL_WORD.test(name) || EXERCISE_LABEL_BARE.test(name)
}

function matchesLessonTitle(name: string, lessonTitles: string[]): boolean {
  const a = name.toLowerCase()
  if (a.length < 3) return false
  return lessonTitles.some((t) => {
    const b = t.toLowerCase()
    return b.includes(a) || a.includes(b)
  })
}

function rejectExercise(reasons: string[], reason: string): PublishExerciseResult {
  reasons.push(reason)
  return { action: 'reject', reasons }
}

/**
 * Pre-publish cleaning gate. Runs once per exercise right before it is attached
 * to a lesson. Every source reference (page, name, audio) must resolve to a
 * displayable asset of the course; otherwise the reference is cleaned (stripped)
 * or the exercise is rejected entirely.
 */
export function publishExercise(exercise: Exercise, ctx: PublishExerciseContext): PublishExerciseResult {
  const reasons: string[] = []
  const cleaned: Exercise = {
    id: exercise.id,
    type: exercise.type,
    prompt: exercise.prompt,
    answer: exercise.answer,
    options: exercise.options,
    page: exercise.page,
    name: exercise.name,
    sourceAssets: [...exercise.sourceAssets],
    requiredAudio: exercise.requiredAudio ? [...exercise.requiredAudio] : undefined,
    requiredVideo: exercise.requiredVideo ? [...exercise.requiredVideo] : undefined,
    requiredReadings: exercise.requiredReadings ? [...exercise.requiredReadings] : undefined,
    solutions: exercise.solutions ? [...exercise.solutions] : undefined,
  }

  if (!cleaned.sourceAssets.length) return rejectExercise(reasons, 'no-source-assets')

  const knownIds = new Set(ctx.sourceFiles.map((f) => f.id))
  const missing = cleaned.sourceAssets.filter((id) => !knownIds.has(id))
  if (missing.length) {
    for (const id of missing) reasons.push(`source-asset-missing:${id}`)
    cleaned.sourceAssets = cleaned.sourceAssets.filter((id) => knownIds.has(id))
    if (!cleaned.sourceAssets.length) return rejectExercise(reasons, 'no-source-assets')
  }

  const pageAsset = findPageAsset(cleaned.sourceAssets, ctx.sourceFiles)
  const sourceDependent = SOURCE_DEPENDENT_PATTERN.test(cleaned.prompt)
  const hasAudio = cleaned.sourceAssets.some((id) => ctx.sourceFiles.some((f) => f.id === id && f.kind === 'audio'))
  const pageDisplayable = !!pageAsset && PAGE_BEARING_KINDS.has(pageAsset.kind) && !!pageAsset.pageCount

  if (LISTENING_PATTERN.test(cleaned.prompt) && !hasAudio) {
    return rejectExercise(reasons, 'audio-missing')
  }

  if (PAGE_NEEDING_TYPES.has(cleaned.type) && !cleaned.page && sourceDependent && !hasAudio) {
    return rejectExercise(reasons, 'missing-page')
  }

  if (cleaned.page) {
    const nums = parsePageRefs(cleaned.page)
    if (!nums.length) {
      reasons.push(`unresolvable-page:${cleaned.page}`)
      cleaned.page = undefined
    } else if (!pageDisplayable) {
      reasons.push('page-not-displayable')
      cleaned.page = undefined
    } else {
      const max = pageAsset!.pageCount!
      const outOfRange = nums.filter((n) => n < 1 || n > max)
      if (outOfRange.length) {
        if (LAST_PAGE_PATTERN.test(cleaned.prompt)) {
          cleaned.page = `S. ${max}`
        } else {
          reasons.push(`page-out-of-range:${Math.max(...outOfRange)}/${max}`)
          cleaned.page = undefined
        }
      }
    }
  }

  if (sourceDependent && !cleaned.page && !pageDisplayable && !hasAudio) {
    return rejectExercise(reasons, 'source-dependent-without-source')
  }

  if (cleaned.name && !isPlausibleLabel(cleaned.name) && !matchesLessonTitle(cleaned.name, ctx.lessonTitles)) {
    reasons.push(`name-unresolvable:${cleaned.name}`)
    cleaned.name = undefined
  }

  if (!cleaned.prompt || cleaned.prompt.trim().length < 8) {
    return rejectExercise(reasons, 'cleaned-to-empty')
  }

  if (!reasons.length) return { action: 'publish', exercise: cleaned, reasons }
  return { action: 'clean', exercise: cleaned, reasons }
}