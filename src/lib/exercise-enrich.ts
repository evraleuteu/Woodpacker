import type { Exercise, VocabularyItem, GrammarRule } from '@/lib/types'
import type { PremiumExercise, PracticeDimension } from '@/lib/types/exercise'
import { getExerciseConfig } from '@/lib/exercise-config'
import { classifyExercise } from '@/lib/heuristics'

export interface EnrichContext {
  locale?: string
  lessonTitle?: string
  moduleTitle?: string
  vocabulary?: VocabularyItem[]
  grammar?: GrammarRule[]
}

export function enrichExercise(exercise: Exercise, ctx?: EnrichContext): PremiumExercise {
  const config = getExerciseConfig(exercise.type)
  const classified = classifyExercise(exercise.prompt)

  let practice: PracticeDimension
  switch (classified.practice) {
    case 'vocabulary':
      practice = 'vocabulary'
      break
    case 'grammar':
      practice = 'grammar'
      break
    case 'listening':
      practice = 'listening'
      break
    case 'speaking':
      practice = 'speaking'
      break
    case 'reading':
      practice = 'reading'
      break
    default:
      practice = config.practice ?? 'other'
  }

  const locale = ctx?.locale ? normalizeLocale(ctx.locale) ?? inferLocale(exercise) : inferLocale(exercise)

  const explanation = buildExplanation(exercise, practice, ctx?.vocabulary, ctx?.grammar)

  return {
    ...exercise,
    challengeTitle: config.title,
    xp: config.xp,
    practice,
    difficulty: inferDifficulty(exercise),
    image: undefined,
    audioUrl: undefined,
    locale,
    lessonTitle: ctx?.lessonTitle,
    moduleTitle: ctx?.moduleTitle,
    explanation,
  }
}

const LANGUAGE_TO_LOCALE: Record<string, string> = {
  german: 'de-DE',
  deutsch: 'de-DE',
  english: 'en-US',
  french: 'fr-FR',
  français: 'fr-FR',
  spanish: 'es-ES',
  español: 'es-ES',
  italian: 'it-IT',
  italiano: 'it-IT',
  portuguese: 'pt-PT',
  português: 'pt-PT',
  russian: 'ru-RU',
  русский: 'ru-RU',
  japanese: 'ja-JP',
  chinese: 'zh-CN',
  dutch: 'nl-NL',
  polish: 'pl-PL',
  turkish: 'tr-TR',
  arabic: 'ar-SA',
  swedish: 'sv-SE',
  norwegian: 'nb-NO',
  danish: 'da-DK',
  finnish: 'fi-FI',
  greek: 'el-GR',
  czech: 'cs-CZ',
  hungarian: 'hu-HU',
  romanian: 'ro-RO',
  korean: 'ko-KR',
  hindi: 'hi-IN',
}

function normalizeLocale(locale: string): string | undefined {
  const value = locale.trim()
  if (!value) return undefined
  if (/^[a-z]{2,3}(-[A-Z]{2})?$/i.test(value)) return value
  const mapped = LANGUAGE_TO_LOCALE[value.toLowerCase()]
  return mapped ?? undefined
}

function inferLocale(exercise: Exercise): string {
  const samples = exercise.prompt + ' ' + (exercise.answer ?? '') + ' ' + (exercise.options ?? []).join(' ')
  if (/\b(der|die|das|ist|bist|hat|hatte|werden|sind|war)\b/.test(samples)) return 'de-DE'
  if (/\b(le|la|les|est|son|avais|avoir|être|aller)\b/.test(samples)) return 'fr-FR'
  if (/\b(el|la|los|las|es|son|est|una|un|por|con|que)\b/.test(samples)) return 'es-ES'
  if (/\b(il|la|è|èst|ha|aveva|essere|avere|andare)\b/.test(samples)) return 'it-IT'
  if (/\b(он|она|они|я|ты|мы|есть|был|была)\b/.test(samples)) return 'ru-RU'
  if (/\b(は|の|に|と|です|ます|いる|ある|から)\b/.test(samples)) return 'ja-JP'
  if (/\b(是|的|了|在|有|是|的|国|中)\b/.test(samples)) return 'zh-CN'
  return 'de-DE'
}

function inferDifficulty(exercise: Exercise): 'beginner' | 'intermediate' | 'advanced' {
  if (exercise.type === 'multiple-choice') return 'beginner'
  if (exercise.type === 'translation') return 'intermediate'
  if (exercise.type === 'comprehension') return 'advanced'
  if (exercise.type === 'fill-blank') return 'intermediate'
  if (exercise.type === 'recall') return 'beginner'
  if (exercise.type === 'pattern-drill') return 'intermediate'
  if (exercise.type === 'roleplay') return 'advanced'
  return 'intermediate'
}

function buildExplanation(exercise: Exercise, practice: PracticeDimension, vocab?: VocabularyItem[], grammar?: GrammarRule[]): string {
  const parts: string[] = []

  if (exercise.type === 'translation' && exercise.answer) {
    parts.push(`Translate: "${exercise.prompt}" → "${exercise.answer}".`)
    if (vocab && vocab.length) {
      const match = vocab.find((v) => exercise.answer?.split(/\s+/).includes(v.term))
      if (match?.definition) parts.push(`Vocabulary: "${match.term}" means "${match.definition}".`)
    }
    if (grammar && grammar.length) {
      parts.push(`Grammar focus: ${grammar[0].name}.`)
    }
  } else if (exercise.type === 'fill-blank' && exercise.answer) {
    parts.push(`Fill the gap with "${exercise.answer}".`)
    if (grammar && grammar.length) {
      parts.push(`Tip: ${grammar[0].name} — remember the word order rule.`)
    }
  } else if (exercise.type === 'multiple-choice' && exercise.options && exercise.answer) {
    parts.push(`The correct option is "${exercise.answer}".`)
    const wrong = exercise.options.filter((o) => o !== exercise.answer)
    if (wrong.length) parts.push(`Be careful: "${wrong[0]}" is a common distractor.`)
  } else if (exercise.type === 'recall' && exercise.answer) {
    parts.push(`"${exercise.answer}" is the correct choice.`)
  } else if (exercise.answer) {
    parts.push(`The expected answer is "${exercise.answer}".`)
  }

  if (!parts.length) parts.push('Review the lesson material and try again.')

  return parts.join(' ')
}

export function buildPremiumSentence(
  exercise: Exercise,
  ctx?: EnrichContext,
): PremiumExercise {
  return enrichExercise(exercise, ctx)
}
