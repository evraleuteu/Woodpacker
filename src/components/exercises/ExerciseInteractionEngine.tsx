'use client'

import { Check } from 'lucide-react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { AudioPlayer } from './AudioPlayer'
import { ChoiceCard } from './ChoiceCard'
import { GapFiller } from './GapFiller'
import { GameBoard } from './GameBoard'
import { SentenceBlocks } from './SentenceBlocks'
import { SentenceBuilder } from './SentenceBuilder'
import { SpeakingRecorder } from './SpeakingRecorder'
import type { ExerciseType, UserAnswer } from '@/lib/exercise-model'
import type { PremiumExercise } from '@/lib/types/exercise'

interface ExerciseInteractionEngineProps {
  exercise: PremiumExercise
  resolvedType: ExerciseType
  feedback: { type: 'correct' | 'incorrect'; answer: string } | null
  mediaLocked: boolean
  hintUsed: boolean
  typed: string
  setTyped: Dispatch<SetStateAction<string>>
  onAnswer: (answer: UserAnswer) => void
}

type FreeTextExerciseType = 'free-text' | 'translation' | 'sentence-completion' | 'grammar-transformation' | 'assessment'

function getFreeTextPlaceholder(type: ExerciseType): string {
  switch (type) {
    case 'translation':
      return 'Translate the sentence…'
    case 'sentence-completion':
      return 'Complete the sentence…'
    case 'grammar-transformation':
      return 'Rewrite the sentence…'
    case 'assessment':
      return 'Answer the question…'
    default:
      return 'Type your answer…'
  }
}

function FreeTextInput({
  answerType,
  typed,
  setTyped,
  onAnswer,
  placeholder,
  disabled,
}: {
  answerType: FreeTextExerciseType
  typed: string
  setTyped: Dispatch<SetStateAction<string>>
  onAnswer: (answer: UserAnswer) => void
  placeholder: string
  disabled: boolean
}) {
  const ready = typed.trim().length > 0 && !disabled

  const submit = () => {
    if (!ready) return
    if (answerType === 'assessment') {
      onAnswer({ type: 'assessment', answer: typed })
      return
    }
    onAnswer({ type: answerType, text: typed } as UserAnswer)
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-4">
        <textarea
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 min-h-[62px] resize-none overflow-hidden rounded-[28px] border border-[#DEE5EA] bg-[#F8FAFB] px-4 py-3.5 text-[clamp(1.1rem,1.8vw,1.7rem)] font-medium leading-[1.08] tracking-[-0.04em] text-[#111827] placeholder:text-[#9CA3AF] shadow-inner shadow-white/80 focus:outline-none focus:border-[#86EFAC] focus:ring-4 focus:ring-[#DDF7E7] transition-all disabled:opacity-60 sm:min-h-[68px] sm:px-5 sm:py-4"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          aria-label="Check answer"
          className="shrink-0 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#DDEEE3] text-[#1F7A4C] shadow-[0_8px_20px_rgba(31,122,76,0.12)] transition-all hover:scale-[1.02] hover:shadow-[0_12px_24px_rgba(31,122,76,0.18)] active:scale-95 disabled:cursor-default disabled:opacity-30 disabled:shadow-none sm:h-[68px] sm:w-[68px]"
        >
          <Check size={26} strokeWidth={2.8} className="sm:h-[30px] sm:w-[30px]" />
        </button>
      </div>
    </div>
  )
}

export function ExerciseInteractionEngine({
  exercise,
  resolvedType,
  feedback,
  mediaLocked,
  hintUsed,
  typed,
  setTyped,
  onAnswer,
}: ExerciseInteractionEngineProps): ReactNode {
  if (feedback) return null
  if (mediaLocked) {
    return <div className="text-center text-sm text-[var(--color-muted)] py-8">Play the audio/video to unlock the answer.</div>
  }

  if (exercise.practice === 'listening' && !!exercise.sourceText) {
    return <AudioPlayer exercise={exercise} onAnswer={onAnswer} disabled={false} />
  }

  switch (resolvedType) {
    case 'multiple-choice':
    case 'multiple-select':
    case 'article-selection':
    case 'case-selection':
    case 'true-false':
      return (
        <ChoiceCard
          exercise={exercise}
          allowMultiple={resolvedType === 'multiple-select'}
          onAnswer={onAnswer}
          disabled={false}
        />
      )
    case 'fill-blank':
    case 'gap-text':
      return exercise.answer ? (
        <GapFiller exercise={exercise} answerType={resolvedType} onAnswer={onAnswer} disabled={false} />
      ) : (
        <div className="rounded-[20px] border border-dashed border-[#DDE5EA] bg-[#F8FAFB] px-5 py-6 text-sm text-[#6B7280]">
          This exercise needs its structured answer interaction.
        </div>
      )
    case 'translation':
    case 'sentence-completion':
    case 'grammar-transformation':
    case 'free-text':
      return exercise.answer ? (
        <SentenceBuilder exercise={exercise} answerType={resolvedType} onAnswer={onAnswer} disabled={false} />
      ) : (
        <FreeTextInput
          answerType={resolvedType}
          typed={typed}
          setTyped={setTyped}
          onAnswer={onAnswer}
          placeholder={getFreeTextPlaceholder(resolvedType)}
          disabled={!!feedback || hintUsed}
        />
      )
    case 'word-order':
      return exercise.answer ? (
        <SentenceBlocks exercise={exercise} answerType="word-order" onAnswer={onAnswer} disabled={false} />
      ) : (
        <div className="rounded-[20px] border border-dashed border-[#DDE5EA] bg-[#F8FAFB] px-5 py-6 text-sm text-[#6B7280]">
          Reorder the sentence using the exercise builder.
        </div>
      )
    case 'matching':
    case 'pattern-drill': {
      const pairs = (exercise.structured?.matching ?? []).map((m, i) => ({
        pairId: m.frontId ?? `pair-${i}`,
        front: m.front,
        back: m.back,
      }))
      return pairs.length ? (
        <GameBoard exercise={exercise} pairs={pairs} onAnswer={onAnswer} disabled={false} />
      ) : exercise.answer ? (
        <SentenceBlocks exercise={exercise} answerType="word-order" onAnswer={onAnswer} disabled={false} />
      ) : (
        <div className="rounded-[20px] border border-dashed border-[#DDE5EA] bg-[#F8FAFB] px-5 py-6 text-sm text-[#6B7280]">
          Match the pairs using the exercise board.
        </div>
      )
    }
    case 'roleplay':
    case 'speaking':
    case 'image-description':
      return <SpeakingRecorder exercise={exercise} onAnswer={onAnswer} disabled={false} />
    case 'listening':
      return <AudioPlayer exercise={exercise} onAnswer={onAnswer} disabled={false} />
    case 'drag-drop':
    default:
      return (
        <div className="rounded-[20px] border border-dashed border-[#DDE5EA] bg-[#F8FAFB] px-5 py-6 text-sm text-[#6B7280]">
          This exercise uses its dedicated interaction pattern.
        </div>
      )
  }
}
