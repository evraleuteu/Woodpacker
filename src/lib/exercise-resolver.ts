import { resolveExerciseType } from '@/lib/exercise-classifier'
import type { ExerciseType, Option, ValidatedExerciseShape } from '@/lib/exercise-model'
import type { PremiumExercise } from '@/lib/types/exercise'

export { resolveExerciseType, toCoarseType } from '@/lib/exercise-classifier'
export { VALIDATORS, validateAnswer } from '@/lib/exercise-validators'
export type { ExerciseValidator, ValidationResult, UserAnswer } from '@/lib/exercise-model'

/**
 * Normalize a `PremiumExercise` into the validated shape consumed by the
 * validator registry: resolve the fine-grained type, coerce options to
 * `{id,label}` form, and forward structured metadata.
 *
 * `options` on legacy exercises is a `string[]`; we synthesize stable ids.
 */
export function toValidatedExercise(exercise: PremiumExercise): ValidatedExerciseShape {
  const optionItems: Option[] | undefined = (exercise.optionItems?.length
    ? exercise.optionItems
    : exercise.options?.length
      ? exercise.options.map((label, i) => ({ id: `opt-${i}`, label }))
      : undefined)

  const type: ExerciseType = resolveExerciseType({
    type: exercise.type,
    prompt: exercise.prompt,
    options: optionItems,
    structured: exercise.structured,
    subtype: exercise.subtype,
  })

  // Synthesize structured data for exercises where the source material didn't
  // provide it but the renderer produces it (word-ordering from a target
  // sentence; gap blanks from the prompt). This keeps the validators aligned
  // with the structured answers the components emit.
  const structured = exercise.structured ?? synthesizeStructure(exercise, type)

  return {
    id: exercise.id,
    type,
    coarseType: exercise.type,
    prompt: exercise.prompt,
    answer: exercise.answer,
    options: optionItems,
    structured,
    locale: exercise.locale,
    acceptedAnswers: exercise.acceptedAnswers,
  }
}

function synthesizeStructure(
  exercise: PremiumExercise,
  type: ExerciseType,
): NonNullable<ValidatedExerciseShape['structured']> | undefined {
  if (type === 'word-order' && exercise.answer) {
    const tokens = exercise.answer
      .split(/\s+/)
      .filter(Boolean)
      .map((t, i) => ({ id: `${i}-${t}`, token: t }))
    return { tokens }
  }
  if ((type === 'fill-blank' || type === 'gap-text') && !exercise.structured?.segments) {
    // Fallback: GapFiller keys blanks by slot index (String(i)), matching
    // buildGapSlots output order. The gap_text validator derives these.
    return undefined
  }
  return undefined
}

export function exerciseIdOf(exercise: PremiumExercise | ValidatedExerciseShape): string {
  return exercise.id
}
