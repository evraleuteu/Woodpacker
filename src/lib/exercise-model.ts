/**
 * Canonical exercise model for the answer-entry system.
 *
 * Architecture (per the redesign spec):
 *
 *   Exercise (data)
 *      ↓ normalizeExerciseType()   →  resolved ExerciseType  (classification layer,
 *        §10 "Do not trust the extracted type blindly" — re-derives the type
 *        from structure when the extraction is ambiguous)
 *      ↓ ExerciseRendererRegistry (exercise-type → component)
 *      ↓ component reports  UserAnswer  (structured, type-specific §5)
 *      ↓ ExerciseValidatorRegistry.validate(type, exercise, answer)  → ValidationResult
 *      ↓ feedback / mastery / repetition
 *
 * The `ExerciseType` union below is the single source of truth for the
 * frontend. It is a superset of the 8 values stored in the Prisma
 * `ExerciseType` enum (see `prisma/schema.prisma`). Fine-grained types that
 * have no DB enum value (e.g. `matching`, `word_order`, `conjugation`,
 * `article_selection`, `case_selection`, `true_false`, `gap_text`) are
 * persisted in the `subtype` column (`Json?`) while `type` stores the coarse
 * DB enum value, so existing rows and queries keep working.
 */

/**
 * Coarse DB-backed exercise type. These are exactly the values the Prisma
 * `ExerciseType` enum stores. The renderer uses the *resolved* (fine-grained)
 * type for dispatch (see {@link ExerciseType}).
 */
export type CoarseExerciseType =
  | 'fill-blank'
  | 'multiple-choice'
  | 'translation'
  | 'recall'
  | 'pattern-drill'
  | 'roleplay'
  | 'comprehension'
  | 'assessment'

/**
 * Fine-grained exercise type used by the renderer + validators.
 *
 * - For the 8 coarse types above, the resolved type equals the coarse value.
 * - For structures extracted under a coarse bucket but rendered distinctly,
 *   we use a dedicated fine type (e.g. an article-selection gap stored as
 *   `multiple-choice` coarse type resolves to `article_selection`).
 */
export type ExerciseType =
  | 'fill-blank'
  | 'multiple-choice'
  | 'multiple-select'
  | 'translation'
  | 'recall'
  | 'pattern-drill'
  | 'roleplay'
  | 'comprehension'
  | 'assessment'
  | 'gap-text'
  | 'sentence-completion'
  | 'word-order'
  | 'matching'
  | 'drag-drop'
  | 'free-text'
  | 'grammar-transformation'
  | 'conjugation'
  | 'article-selection'
  | 'case-selection'
  | 'listening'
  | 'speaking'
  | 'image-description'
  | 'true-false'

/** Coarse DB type + optional fine subtype stored in `subtype` column. */
export interface ExerciseTypeDescriptor {
  coarse: CoarseExerciseType
  /** Fine-grained type used by the renderer when present; omit to use `coarse`. */
  subtype?: ExerciseType
}

export type ResolvedExerciseType = ExerciseType

/**
 * Structured user answers. Each exercise type emits only the shape that
 * matches it (§5), so validation logic is never fed an incompatible string.
 */
export type UserAnswer =
  | { type: 'multiple-choice'; selectedOptionId: string }
  | { type: 'single-choice'; selectedOptionId: string }
  | {
    type: 'multiple-select'
    selectedOptionIds: string[]
  }
  | {
    type: 'fill-blank'
    values: Record<string, string>
  }
  | {
    type: 'gap-text'
    values: Record<string, string>
  }
  | { type: 'sentence-completion'; text: string }
  | {
    type: 'word-order'
    orderedTokenIds: string[]
  }
  | { type: 'pattern-drill'; completed: boolean }
  | { type: 'matching'; pairs: Record<string, string> }
  | {
    type: 'drag-drop'
    placement: Record<string, string>
  }
  | { type: 'translation'; text: string }
  | { type: 'free-text'; text: string }
  | { type: 'grammar-transformation'; text: string }
  | {
    type: 'conjugation'
    fields: Record<string, string>
  }
  | {
    type: 'article-selection'
    selected: Record<string, string>
  }
  | {
    type: 'case-selection'
    selected: Record<string, string>
  }
  | { type: 'listening'; mode: 'choice' | 'reconstruct' | 'dictation'; answer: string }
  | { type: 'speaking'; mode: 'text' | 'audio'; text?: string; audioUrl?: string }
  | { type: 'image-description'; mode: 'text' | 'speaking'; text?: string; audioUrl?: string }
  | {
    type: 'true-false'
    selected: 'true' | 'false'
  }
  | { type: 'assessment'; answer: string }

export interface Option {
  id: string
  label: string
}

/** Per-blank correctness for partial-credit feedback (§8). */
export interface PartialFeedback {
  correct: boolean
  perItem?: Record<string, boolean>
  message?: string
  hints?: string[]
  feedback?: string
}

export interface ValidationResult {
  correct: boolean
  /** `true` when the answer is fully correct, `false` for any wrong, `null` when not yet graded. */
  partial: boolean
  perBlank?: Record<string, boolean>
  message?: string
  hints?: string[]
  feedback?: string
}

/**
 * Per-type validator contract. Implementations MUST be pure: they take the
 * exercise data + the structured user answer and return a ValidationResult.
 * Deterministic validation is preferred; only free-text / translation /
 * speaking / image-description defer to semantic/LLM evaluation.
 */
export interface ExerciseValidator {
  validate(exercise: ValidatedExerciseShape, answer: UserAnswer): ValidationResult
}

export interface ValidatedExerciseShape {
  id: string
  type: ExerciseType
  coarseType: CoarseExerciseType
  prompt: string
  answer?: string
  options?: Option[]
  /** Fine-grained structure for gap-text / conjugation / matching / article-selection. */
  structured?: ExerciseStructure
  /** Locale hint for speech / TTS (e.g. "de-DE"). */
  locale?: string
  acceptedAnswers?: string[]
}

export interface ExerciseStructure {
  /** Gap-text / article-selection / case-selection segments. */
  segments?: TextSegment[]
  /** Conjugation persons → expected form. */
  conjugation?: Record<string, string>
  /** Matching pairs (frontId → backId). */
  matching?: Array<{ frontId: string; backId: string; front: string; back: string }>
  /** Word-order token set (id → token). */
  tokens?: Array<{ id: string; token: string }>
}

export interface TextSegment {
  type: 'text' | 'blank' | 'image' | 'audio'
  /** for `text`: the literal text; for `blank`: the blank's id. */
  value: string
  /** for `blank`: the expected answer(s). */
  expected?: string[]
  /** for `image`/`audio`: asset url or id. */
  assetId?: string
}
