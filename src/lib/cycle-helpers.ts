import type { ExerciseType } from '@/lib/types'
import type { PracticeItem } from '@/lib/plan'
import type { PremiumExercise, PracticeDimension } from '@/lib/types/exercise'
import { enrichExercise } from './exercise-enrich'
import { getExerciseConfig } from './exercise-config'
import { shuffle } from './exercise-helpers'

export function practiceItemToPremium(item: PracticeItem, courseLocale?: string): PremiumExercise {
  // Real textbook exercise - enrich it fully
  if (item.exercise) {
    return enrichExercise(item.exercise, { locale: courseLocale, lessonTitle: item.lessonTitle, moduleTitle: '' })
  }

  const dimension: string = item.dimension
  const prompt = item.prompt
  let type: ExerciseType = 'assessment'

  switch (dimension) {
    case 'vocabulary':
      type = 'recall'
      break
    case 'grammar':
      type = 'fill-blank'
      break
    case 'listening':
    case 'hearing':
      type = 'comprehension'
      break
    case 'reading':
      type = 'comprehension'
      break
    case 'speaking':
      type = 'roleplay'
      break
    default:
      type = 'assessment'
  }

  const config = getExerciseConfig(type)

  let practice: PracticeDimension
  switch (dimension) {
    case 'vocabulary':
      practice = 'vocabulary'
      break
    case 'grammar':
      practice = 'grammar'
      break
    case 'listening':
    case 'hearing':
      practice = 'listening'
      break
    case 'reading':
      practice = 'reading'
      break
    case 'speaking':
      practice = 'speaking'
      break
    default:
      practice = 'other'
  }

  // Generate proper structured exercise for generated items
  let answer = prompt
  let options: string[] | undefined
  let structuredPrompt = prompt

  switch (type) {
    case 'recall': // vocabulary -> sentence completion with word bank
      // Extract key term from prompt
      const term = prompt.split(' ').pop()?.replace(/[.?!,]$/, '') ?? prompt
      answer = term
      structuredPrompt = `Complete: ${prompt.replace(term, '_____')}`
      break
    case 'fill-blank': // grammar -> gap fill
      // Use last word as gap
      const words = prompt.split(' ')
      const gapWord = words.pop() ?? prompt
      answer = gapWord
      structuredPrompt = `${words.join(' ')} _____`
      break
    case 'comprehension': // listening/reading -> multiple choice
      // For questions, try to extract answer from prompt if it's a Q&A pair
      const qaMatch = prompt.match(/^(.+?)\?\s*(.+)$/)
      if (qaMatch) {
        structuredPrompt = qaMatch[1] + '?'
        answer = qaMatch[2].trim()
      } else {
        // Create a multiple choice with the prompt as question
        structuredPrompt = prompt
        answer = prompt
      }
      // Generate plausible distractors
      options = shuffle([
        answer,
        'Option B',
        'Option C',
        'Option D',
      ]).slice(0, 4)
      break
    case 'roleplay': // speaking
      structuredPrompt = prompt
      answer = prompt
      break
    default:
      structuredPrompt = prompt
      answer = prompt
  }

  return {
    id: item.id,
    type,
    prompt: structuredPrompt,
    answer,
    options,
    sourceAssets: [],
    challengeTitle: config.title,
    xp: config.xp,
    practice,
    difficulty: dimension === 'reading' || dimension === 'speaking' ? 'advanced' : 'intermediate',
    locale: courseLocale,
    lessonTitle: item.lessonTitle,
    moduleTitle: '',
    explanation: `Practice: ${prompt}`,
  }
}
