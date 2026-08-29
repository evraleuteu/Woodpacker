import type { Exercise as BaseExercise, ExerciseType, Difficulty, VocabularyItem, GrammarRule } from '@/lib/types'
import type { ExerciseStructure, Option } from '@/lib/exercise-model'

/**
 * An exercise enriched for the premium game layer.
 * Extends the raw `Exercise` with display + interactive metadata.
 *
 * The enriched layer is where type-specific interaction metadata lives
 * (structured segments, option items, accepted alternatives, locale).
 */
export interface PremiumExercise extends BaseExercise {
  /** Large, readable challenge instruction, e.g. "Write this sentence in English" */
  challengeTitle: string
  /** Human-readable hint shown after a mistake or via the hint button */
  explanation?: string
  /** Practice dimension this exercise trains (for XP + badge attribution) */
  practice: PracticeDimension
  /** Difficulty band */
  difficulty: Difficulty
  /** Default XP reward for completing this exercise */
  xp?: number
  /** Avatar emotion on success */
  successEmotion?: AvatarEmotion
  /** Optional illustration / icon url (used by image-description exercises) */
  image?: string
  /** Optional audio url (TTS source of the prompt) */
  audioUrl?: string
  /** Source sentence shown as subtitle (e.g. the foreign-language prompt) */
  sourceText?: string
  /** Locale hint for speech synthesis / recognition, e.g. "de-DE" */
  locale?: string
  /** Context titles */
  lessonTitle?: string
  moduleTitle?: string
  /**
   * Fine-grained exercise type used by the renderer + validator registry.
   * When present, it overrides the coarse `type` for dispatch (e.g. an article
   * selection stored as `multiple_choice` resolves to `article_selection`).
   */
  subtype?: ExerciseType
  /** Structured representation (gap segments, conjugation table, matching pairs, word-order tokens). */
  structured?: ExerciseStructure
  /** Pre-normalised answer options with stable ids for structured-choice validators. */
  optionItems?: Option[]
  /** Alternative accepted answers (e.g. synonyms, valid translations). */
  acceptedAnswers?: string[]
}

export type PracticeDimension =
  | 'vocabulary'
  | 'grammar'
  | 'listening'
  | 'speaking'
  | 'reading'
  | 'other'

export type AvatarEmotion = 'idle' | 'happy' | 'thinking' | 'encourage' | 'correct' | 'wrong' | 'celebrate'

export interface ExerciseConfig {
  type: ExerciseType
  /** Title shown at the top of the card */
  title: string
  /** Default XP reward */
  xp: number
  /** Practice dimension used for badge attribution */
  practice: PracticeDimension
  /** Avatar emotion on success */
  successEmotion: AvatarEmotion
}

export interface GameStats {
  xp: number
  streak: number
  level: number
  dailyGoal: number
  goalProgress: number
  goalTarget: number
  solved: number
  mistakes: number
  consecutiveCorrect: number
}

export interface Badge {
  id: string
  label: string
  description: string
  icon: string
  earned: boolean
  threshold: number
  progress?: number
}

export interface PremiumCourseContext {
  courseId: string
  language?: string
  locale?: string
  stats: GameStats
  badges: Badge[]
}

/** Payload handed to each interactive exercise component. */
export interface ExerciseRuntime {
  exercise: PremiumExercise
  /** index in the current session (0-based) */
  index: number
  total: number
  /** words to place in the answer area (translation / sentence builder) */
  wordBank?: string[]
  /** correct answer as space-joined string (legacy, prefer structured fields) */
  correctAnswer?: string
}

export type FeedbackType = 'none' | 'correct' | 'incorrect'

export { type VocabularyItem, type GrammarRule }
