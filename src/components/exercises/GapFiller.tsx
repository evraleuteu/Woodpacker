'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Lightbulb, Check, Share2 } from 'lucide-react'
import { WordBank } from './WordBank'
import { Avatar } from './Avatar'
import { buildGapSlots, shuffle, countOccurrences } from '@/lib/exercise-helpers'
import type { GapSlot } from '@/lib/exercise-helpers'
import type { PremiumExercise } from '@/lib/types/exercise'
import type { UserAnswer } from '@/lib/exercise-model'

interface GapFillerProps {
  exercise: PremiumExercise
  /** Resolved exercise type the deck computed (`fill_blank` or `gap_text`). */
  answerType: 'fill-blank' | 'gap-text'
  onAnswer: (answer: UserAnswer) => void
  disabled?: boolean
}

/**
 * Fill-in-the-blank challenge. Renders a sentence with clearly visible
 * dashed gap placeholders and a draggable/tappable word bank below.
 *
 * Reports a structured answer of the form
 * `{ type: 'fill_blank' | 'gap_text', values: { <blankId>: <word> } }` so each
 * blank is graded independently (partial correctness, §8).
 */
export function GapFiller({ exercise, answerType, onAnswer, disabled = false }: GapFillerProps) {
  const slots = useMemo(() => buildGapSlots(exercise.prompt, exercise.answer), [exercise.prompt, exercise.answer])
  const gapIndices = useMemo(() => slots.map((s, i) => (s.gap ? i : -1)).filter((i) => i >= 0), [slots])
  const [filled, setFilled] = useState<Record<number, string>>({})
  const [hintUsed, setHintUsed] = useState(false)

  const placedWords = useMemo(() => Object.values(filled), [filled])
  const expectedWords = useMemo(() => slots.filter((s) => s.gap).map((s) => s.answer), [slots])

  const wordBank = useMemo(() => shuffle([...expectedWords, ...expectedWords].filter(Boolean)), [expectedWords])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>, slotIndex: number) => {
      e.preventDefault()
      const word = e.dataTransfer.getData('text/plain')
      if (!word) return
      if (countOccurrences(placedWords, word) >= countOccurrences(expectedWords, word)) return
      setFilled((prev) => ({ ...prev, [slotIndex]: word }))
    },
    [placedWords, expectedWords],
  )

  const handleWordTap = useCallback(
    (word: string) => {
      if (disabled) return
      if (countOccurrences(placedWords, word) >= countOccurrences(expectedWords, word)) return
      const emptyGap = gapIndices.find((i) => !filled[i])
      if (emptyGap !== undefined) {
        setFilled((prev) => ({ ...prev, [emptyGap]: word }))
      }
    },
    [disabled, placedWords, expectedWords, gapIndices, filled],
  )

  const handleHint = () => {
    if (hintUsed) return
    setHintUsed(true)
    const emptyGap = gapIndices.find((i) => !filled[i])
    if (emptyGap !== undefined) {
      setFilled((prev) => ({ ...prev, [emptyGap]: slots[emptyGap].answer }))
    }
  }

  const handleSubmit = () => {
    const missing = gapIndices.filter((i) => !filled[i])
    if (missing.length) return
    const values: Record<string, string> = {}
    for (const i of gapIndices) values[String(i)] = filled[i] ?? ''
    onAnswer({ type: answerType, values })
  }

  const allFilled = gapIndices.every((i) => filled[i])

  return (
    <motion.div className="flex flex-col items-center" layout>
      <div className="flex justify-center mb-2">
        <Avatar emotion={disabled ? 'correct' : 'idle'} size={68} />
      </div>

      <div className="w-full max-w-2xl mb-6">
        <SentenceWithSlots slots={slots} filled={filled} onDrop={handleDrop} />
      </div>

      <WordBank words={wordBank} placed={placedWords} onWordTap={handleWordTap} disabled={disabled} />

      <div className="flex items-center justify-center gap-3 mt-4">
        <button
          type="button"
          onClick={handleHint}
          disabled={hintUsed || disabled}
          className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5 focus:ring-2 focus:ring-[var(--color-accent-lime)] focus:ring-offset-2 focus:ring-offset-[#0C0C0C]"
        >
          <Lightbulb size={13} />
          {hintUsed ? 'Hint used' : 'Hint'}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allFilled || disabled}
          className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-[var(--color-accent-lime)]"
        >
          <Check size={15} />
          Check
        </button>
      </div>

      {disabled && exercise.answer && (
        <div className="mt-4 text-center">
          <Share2 size={13} className="text-[#6B7280] inline mr-1" />
          <span className="text-xs text-[#6B7280]">Correct answer: </span>
          <span className="text-xs font-medium text-[#10B981]">{exercise.answer}</span>
        </div>
      )}
    </motion.div>
  )
}

function SentenceWithSlots({
  slots,
  filled,
  onDrop,
}: {
  slots: GapSlot[]
  filled: Record<number, string>
  onDrop: (e: React.DragEvent<HTMLElement>, slotIndex: number) => void
}) {
  return (
    <p className="text-center text-lg font-medium text-[#FAF8F5] leading-relaxed">
      {slots.map((slot, i) => {
        if (slot.gap) {
          const val = filled[i]
          return (
            <motion.span
              key={i}
              className="inline-block align-middle"
              onDrop={(e) => onDrop(e, i)}
              onDragOver={(e) => e.preventDefault()}
            >
              <span
                className={`inline-block min-w-[4rem] h-9 px-2 rounded-lg border-2 border-dashed transition-all ${
                  val ? 'border-[var(--color-accent-lime)] bg-[rgba(132,204,22,0.08)]' : 'border-[rgba(250,248,245,0.25)] bg-[rgba(250,248,245,0.02)] animate-pulse'
                }`}
                aria-label={val ? val : 'empty gap'}
              >
                <span className="text-[#FAF8F5] font-medium">{val ?? ''}</span>
              </span>
            </motion.span>
          )
        }
        return (
          <span key={i} className="mx-0.5">
            {slot.text}
          </span>
        )
      })}
    </p>
  )
}
