import type {
  ExerciseType,
  ExerciseValidator,
  ValidationResult,
  ValidatedExerciseShape,
  UserAnswer,
} from './exercise-model'
import { answersMatch, normalizeAnswer, buildGapSlots } from '@/lib/exercise-helpers'

function ok(message?: string): ValidationResult {
  return { correct: true, partial: false, message }
}

function wrong(message?: string): ValidationResult {
  return { correct: false, partial: false, message }
}

/* ----------------------------------------------------------------------- */
/*  Helpers                                                                 */
/* ----------------------------------------------------------------------- */

interface BlankSlot {
  gap: boolean
  expected: string[]
  id: string
}

function toSlotsFromSegments(segments: NonNullable<NonNullable<ValidatedExerciseShape['structured']>['segments']>): BlankSlot[] {
  if (!segments) return []
  return segments.map((s, i) =>
    s.type === 'blank' ? { gap: true, expected: s.expected ?? [], id: s.value } : { gap: false, expected: [], id: String(i) },
  )
}

/* ----------------------------------------------------------------------- */
/*  Concrete validators                                                    */
/* ----------------------------------------------------------------------- */

const singleChoice: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as UserAnswer & { type?: string }
    if (ans.type !== 'multiple-choice' && ans.type !== 'single-choice') return wrong('No option selected')
    const selected = ex.options?.find((o) => o.id === ans.selectedOptionId)
    if (!selected) return wrong('No option selected')
    return answersMatch(selected.label, ex.answer ?? '') ? ok() : wrong()
  },
}

const multipleSelect: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as { type?: string; selectedOptionIds?: string[] }
    const chosen = new Set(ans.selectedOptionIds ?? [])
    if (!chosen.size) return wrong('No options selected')
    const correct = (ex.options ?? []).filter((o) => answersMatch(o.label, ex.answer ?? '')).map((o) => o.id)
    const isCorrect = chosen.size === correct.length && [...chosen].every((id) => correct.includes(id))
    return isCorrect ? ok() : wrong()
  },
}

const fillBlank: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as { type?: string; values?: Record<string, string> }
    const answer = ex.answer ?? ''
    if (!answer) return wrong()
    const raw = ans.values ? Object.values(ans.values)[0] : ''
    const got = normalizeAnswer(raw ?? '')
    if (!got) return wrong()
    return got === normalizeAnswer(answer) ? ok() : wrong()
  },
}

const gapText: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as { type?: string; values?: Record<string, string> }
    const segments = ex.structured?.segments
    const blanks: BlankSlot[] = segments && segments.length
      ? toSlotsFromSegments(segments).filter((s) => s.gap)
      : buildGapSlots(ex.prompt, ex.answer)
          .map((s, i) => ({ gap: s.gap, expected: s.gap && s.answer ? [s.answer] : [], id: String(i) }))
          .filter((s) => s.gap)
    if (!blanks.length) return wrong()
    const perBlank: Record<string, boolean> = {}
    let allCorrect = true
    let anyCorrect = false
    blanks.forEach((blank) => {
      const key = blank.id
      const got = normalizeAnswer(ans.values?.[key] ?? '')
      const expected = blank.expected.map(normalizeAnswer)
      const correct = expected.length > 0 && got ? expected.includes(got) : false
      perBlank[key] = correct
      if (correct) anyCorrect = true
      else allCorrect = false
    })
    if (allCorrect) return ok()
    if (anyCorrect) return { correct: false, partial: true, perBlank, message: 'Some gaps are incorrect.' }
    return wrong()
  },
}

const sentenceCompletion: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as { type?: string; text?: string }
    const text = ans.text ?? ''
    if (!text) return wrong('Type your answer')
    if (ex.answer && normalizeAnswer(text) === normalizeAnswer(ex.answer)) return ok()
    if (ex.acceptedAnswers?.some((alt) => answersMatch(text, alt))) return ok()
    return wrong()
  },
}

const wordOrder: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as { type?: string; orderedTokenIds?: string[] }
    const tokens = ex.structured?.tokens ?? []
    const placed = (ans.orderedTokenIds ?? []).map((id) => tokens.find((t) => t.id === id)?.token ?? '')
    const expected = tokens.map((t) => t.token)
    const correct =
      placed.length === expected.length &&
      placed.every((w, i) => normalizeAnswer(w) === normalizeAnswer(expected[i]))
    return correct ? ok() : wrong()
  },
}

const matching: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as { type?: string; pairs?: Record<string, string> }
    const pairs = ex.structured?.matching ?? []
    const chosen = ans.pairs ?? {}
    const correct = pairs.every((p) => chosen[p.frontId] === p.backId)
    return correct ? ok() : wrong()
  },
}

const translation: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as { type?: string; text?: string }
    const text = ans.text ?? ''
    if (!text) return wrong('Type your translation')
    const normalized = normalizeAnswer(text)
    if (ex.answer && normalized === normalizeAnswer(ex.answer)) return ok()
    if (ex.acceptedAnswers?.some((alt) => normalized === normalizeAnswer(alt))) return ok()
    if (ex.answer && answersMatch(text, ex.answer)) return ok()
    return wrong()
  },
}

const freeText: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as { type?: string; text?: string }
    const text = ans.text ?? ''
    if (!text) return wrong('Type your answer')
    if (ex.acceptedAnswers?.some((alt) => answersMatch(text, alt))) return ok()
    if (ex.answer && answersMatch(text, ex.answer)) return ok()
    if (ex.answer && wordOverlap(text, ex.answer) >= 0.6) {
      return { correct: false, partial: true, message: 'Close — check wording or grammar.' }
    }
    return { correct: false, partial: false, message: 'Answer does not match the expected response.' }
  },
}

const grammarTransformation: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as { type?: string; text?: string }
    const text = ans.text ?? ''
    if (!text) return wrong('Type your answer')
    if (ex.answer && answersMatch(text, ex.answer)) return ok()
    if (ex.acceptedAnswers?.some((alt) => answersMatch(text, alt))) return ok()
    return wrong()
  },
}

const conjugation: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as { type?: string; fields?: Record<string, string> }
    const expected = ex.structured?.conjugation ?? {}
    const perBlank: Record<string, boolean> = {}
    let allCorrect = true
    let anyCorrect = false
    for (const person of Object.keys(expected)) {
      const correct = normalizeAnswer(ans.fields?.[person] ?? '') === normalizeAnswer(expected[person])
      perBlank[person] = correct
      if (correct) anyCorrect = true
      else allCorrect = false
    }
    if (allCorrect) return ok()
    if (anyCorrect) return { correct: false, partial: true, perBlank }
    return wrong()
  },
}

const articleSelection: ExerciseValidator = {
  validate(ex, a) {
    const ans = a as { type?: string; selected?: Record<string, string> }
    const expected = ex.structured?.segments?.filter((s) => s.type === 'blank') ?? []
    const perBlank: Record<string, boolean> = {}
    let allCorrect = true
    for (const blank of expected) {
      const chosen = normalizeAnswer(ans.selected?.[blank.value] ?? '')
      const valid = (blank.expected ?? []).map(normalizeAnswer)
      const correct = valid.includes(chosen)
      perBlank[blank.value] = correct
      if (!correct) allCorrect = false
    }
    return allCorrect ? ok() : { correct: false, partial: true, perBlank }
  },
}

function wordOverlap(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().match(/[\p{L}']+/gu) ?? [])
  const wb = b.toLowerCase().match(/[\p{L}']+/gu) ?? []
  if (!wa.size) return 0
  let hits = 0
  for (const w of wb) if (wa.has(w)) hits++
  return hits / wa.size
}

/* ----------------------------------------------------------------------- */
/*  Registry                                                                */
/* ----------------------------------------------------------------------- */

export const VALIDATORS: Record<ExerciseType, ExerciseValidator> = {
  'multiple-choice': singleChoice,
  'multiple-select': multipleSelect,
  'fill-blank': fillBlank,
  'gap-text': gapText,
  'sentence-completion': sentenceCompletion,
  'word-order': wordOrder,
  matching,
  translation,
   'free-text': freeText,
  'drag-drop': {
    validate(ex, a) {
      const ans = a as { type?: string; placement?: Record<string, string> }
      const expected = ex.answer ?? ''
      if (!expected) return wrong()
      return answersMatch(Object.values(ans.placement ?? {}).join(' '), expected) ? ok() : wrong()
    },
  },
  'grammar-transformation': grammarTransformation,
  conjugation,
  'article-selection': articleSelection,
  'case-selection': articleSelection,
  'true-false': {
    validate(ex, a) {
      const ans = a as { type?: string; selected?: 'true' | 'false' }
      const norm = normalizeAnswer(ex.answer ?? '')
      const expected = norm.includes('true') ? 'true' : norm.includes('false') ? 'false' : ''
      const chosen = ans.selected ?? ''
      return chosen === expected ? ok() : wrong()
    },
  },
  listening: {
    validate(ex, a) {
      const ans = a as { type?: string; answer?: string }
      const text = ans.answer ?? ''
      if (!text) return wrong('Provide an answer')
      if (ex.answer && answersMatch(text, ex.answer)) return ok()
      if (ex.acceptedAnswers?.some((alt) => answersMatch(text, alt))) return ok()
      return wrong()
    },
  },
  speaking: {
    validate() {
      return { correct: false, partial: true, message: 'Speaking exercises are evaluated by the recording feedback.' }
    },
  },
  'image-description': {
    validate(_ex, a) {
      const ans = a as { type?: string; text?: string }
      return ans.text && ans.text.trim().length > 0
        ? { correct: false, partial: true, message: 'Image descriptions are evaluated semantically.' }
        : wrong('Describe the image')
    },
  },
  'pattern-drill': {
    validate(_ex, a) {
      const ans = a as { type?: string; completed?: boolean }
      return ans.completed ? ok('All pairs matched') : wrong()
    },
  },
  roleplay: {
    validate(_ex, a) {
      const ans = a as { type?: string; text?: string; mode?: string }
      return ans.mode === 'text' && ans.text && ans.text.trim().length > 0
        ? { correct: false, partial: true, message: 'Speaking exercises are evaluated by the recording feedback.' }
        : wrong('Provide a spoken or typed response')
    },
  },
  comprehension: freeText,
  recall: freeText,
  assessment: {
    validate(ex, a) {
      const ans = a as { type?: string; answer?: string }
      const text = ans.answer ?? ''
      if (!text) return wrong('Provide an answer')
      if (ex.answer && answersMatch(text, ex.answer)) return ok()
      return wrong()
    },
  },
}

export function validateAnswer(exercise: ValidatedExerciseShape, answer: UserAnswer | null): ValidationResult {
  if (!answer) return wrong('No answer provided')
  const validator = VALIDATORS[exercise.type]
  return validator.validate(exercise, answer)
}
