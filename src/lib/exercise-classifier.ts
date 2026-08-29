import type { ExerciseType, CoarseExerciseType } from './exercise-model'

/**
 * Classification layer (§10: "Do not trust the extracted type blindly").
 *
 * Given an exercise's coarse DB type + prompt + optional structure, resolve
 * the fine-grained {@link ExerciseType} that the renderer + validator should
 * actually use. When the extraction is unambiguous we trust it; when it's not
 * we infer from structure (presence of options → multiple_choice / single_choice,
 * presence of gaps → gap_text, etc.).
 */
export function resolveExerciseType(exercise: {
  type: CoarseExerciseType
  prompt: string
  options?: { id: string; label: string }[]
  structured?: { segments?: { type: string; value: string; expected?: string[] }[]; conjugation?: Record<string, string>; matching?: Array<{ frontId: string; backId: string; front: string; back: string }>; tokens?: Array<{ id: string; token: string }> }
  subtype?: ExerciseType
}): ExerciseType {
  // Explicit subtype wins (writer/author asserted it).
  if (exercise.subtype) return exercise.subtype

  const { type, options, structured } = exercise
  const prompt = (exercise.prompt ?? '').trim()

  // --- Structure-driven overrides (most reliable) ---
  if (structured?.segments?.some((s) => s.type === 'blank' && Array.isArray(s.expected) && s.expected.length > 1)) {
    return 'gap-text'
  }
  if (structured?.conjugation && Object.keys(structured.conjugation).length >= 3) return 'conjugation'
  if (structured?.matching && structured.matching.length >= 2) return 'matching'
  if (structured?.tokens && structured.tokens.length >= 2) return 'word-order'

  // --- Prompt-driven overrides ---
  if (/true\s*\/\s*false|richtig oder falsch|wahr oder falsch/i.test(prompt)) return 'true-false'

  if (type === 'multiple-choice' && /(artikel|der|die|das|case|fall|dativ|akkusativ|genitiv|nominativ)/i.test(prompt)) {
    return /(case|fall|dativ|akkusativ|genitiv|nominativ)/i.test(prompt) ? 'case-selection' : 'article-selection'
  }

  if (type === 'fill-blank') {
    return structured?.segments?.some((s) => s.type === 'blank' && s.expected && s.expected.length === 1) || /___|\[\s*\]|\.\.\./.test(prompt)
      ? 'gap-text'
      : 'fill-blank'
  }

  // Options presence determines single vs multiple selection.
  if (type === 'multiple-choice') {
    return options && options.length > 0 && options.length !== 1 ? 'multiple-select' : 'multiple-choice'
  }

  switch (type) {
    case 'recall':
      return 'sentence-completion'
    case 'translation':
      return 'translation'
    case 'roleplay':
      return 'speaking'
    case 'comprehension':
      return 'free-text'
    case 'pattern-drill':
      return 'word-order'
    case 'assessment':
      return 'assessment'
    default:
      return type as ExerciseType
  }
}

export function toCoarseType(type: ExerciseType): CoarseExerciseType {
  switch (type) {
    case 'multiple-select':
    case 'multiple-choice':
    case 'article-selection':
    case 'case-selection':
    case 'true-false':
    case 'matching':
    case 'drag-drop':
      return 'multiple-choice'
    case 'gap-text':
    case 'fill-blank':
    case 'sentence-completion':
    case 'word-order':
    case 'conjugation':
      return 'fill-blank'
    case 'translation':
      return 'translation'
    case 'recall':
      return 'recall'
    case 'pattern-drill':
      return 'pattern-drill'
    case 'roleplay':
    case 'speaking':
      return 'roleplay'
    case 'comprehension':
    case 'listening':
    case 'image-description':
    case 'free-text':
    case 'grammar-transformation':
      return 'comprehension'
    case 'assessment':
      return 'assessment'
    default:
      return type as CoarseExerciseType
  }
}

export const SEMANTIC_TYPES: ReadonlySet<ExerciseType> = new Set<ExerciseType>([
  'free-text',
  'translation',
  'grammar-transformation',
  'speaking',
  'image-description',
])

export function needsSemanticValidation(type: ExerciseType): boolean {
  return SEMANTIC_TYPES.has(type)
}
