import type { ExerciseType } from '@/lib/types'
import type { ExerciseConfig, PracticeDimension, AvatarEmotion } from '@/lib/types/exercise'

/**
 * Static configuration for every exercise type.
 * Maps a raw exercise type -> a premium challenge title, XP reward,
 * practice dimension and avatar emotion used for gamification.
 */
export const EXERCISE_CONFIG: Record<ExerciseType, ExerciseConfig> = {
  translation: {
    type: 'translation',
    title: 'Write this sentence',
    xp: 15,
    practice: 'vocabulary',
    successEmotion: 'correct',
  },
  'multiple-choice': {
    type: 'multiple-choice',
    title: 'Choose the correct answer',
    xp: 10,
    practice: 'grammar',
    successEmotion: 'happy',
  },
  'fill-blank': {
    type: 'fill-blank',
    title: 'Complete the sentence',
    xp: 12,
    practice: 'grammar',
    successEmotion: 'happy',
  },
  recall: {
    type: 'recall',
    title: 'Which word means this?',
    xp: 10,
    practice: 'vocabulary',
    successEmotion: 'correct',
  },
  'pattern-drill': {
    type: 'pattern-drill',
    title: 'Match the sentence pattern',
    xp: 12,
    practice: 'grammar',
    successEmotion: 'thinking',
  },
  roleplay: {
    type: 'roleplay',
    title: 'Say it aloud',
    xp: 15,
    practice: 'speaking',
    successEmotion: 'celebrate',
  },
  comprehension: {
    type: 'comprehension',
    title: 'Read and answer',
    xp: 8,
    practice: 'reading',
    successEmotion: 'correct',
  },
  assessment: {
    type: 'assessment',
    title: 'Apply what you learned',
    xp: 20,
    practice: 'other',
    successEmotion: 'celebrate',
  },
}

export const PRACTICE_DIMENSIONS: PracticeDimension[] = ['vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'other']

export const AVATAR_EMOTIONS: AvatarEmotion[] = ['idle', 'happy', 'thinking', 'encourage', 'correct', 'wrong', 'celebrate']

export function getExerciseConfig(type: ExerciseType): ExerciseConfig {
  return EXERCISE_CONFIG[type] ?? {
    type,
    title: 'Solve the challenge',
    xp: 10,
    practice: 'other',
    successEmotion: 'correct',
  }
}

/** Returns the XP reward for a single correct answer (used by the engine). */
export function xpForExercise(type: ExerciseType, perfect = false): number {
  const base = EXERCISE_CONFIG[type]?.xp ?? 10
  return base + (perfect ? 5 : 0)
}

/**
 * Badges tied to practice dimensions. A badge is granted when the learner
 * completes `threshold` exercises of that dimension.
 */
export interface BadgeSpec {
  id: string
  label: string
  description: string
  icon: string
  threshold: number
  practice: PracticeDimension | 'any'
}

export const BADGE_SPECS: BadgeSpec[] = [
  { id: 'first-lesson', label: 'First Lesson', description: 'Complete your first exercise', icon: 'sparkles', threshold: 1, practice: 'any' },
  { id: 'week-wonder', label: 'Week Wonder', description: 'Maintain a 7-day streak', icon: 'flame', threshold: 7, practice: 'any' },
  { id: 'perfect-score', label: 'Perfect Score', description: 'Get 10 exercises right on the first try', icon: 'trophy', threshold: 10, practice: 'any' },
  { id: 'grammar-master', label: 'Grammar Master', description: 'Complete 50 grammar tasks', icon: 'book-open', threshold: 50, practice: 'grammar' },
  { id: 'vocab-collector', label: 'Vocab Collector', description: 'Complete 50 vocabulary tasks', icon: 'book-marked', threshold: 50, practice: 'vocabulary' },
  { id: 'listening-pro', label: 'Listening Pro', description: 'Complete 30 listening tasks', icon: 'headphones', threshold: 30, practice: 'listening' },
  { id: 'speaker', label: 'Speaker', description: 'Complete 10 speaking tasks', icon: 'mic', threshold: 10, practice: 'speaking' },
]
