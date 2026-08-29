'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Volume2, Lightbulb, Check, Share2 } from 'lucide-react'
import { WordBank } from './WordBank'
import { Avatar } from './Avatar'
import { shuffle, wordBankFromAnswer } from '@/lib/exercise-helpers'
import type { PremiumExercise } from '@/lib/types/exercise'
import type { ExerciseType, UserAnswer } from '@/lib/exercise-model'

type AnswerType = Extract<
  ExerciseType,
  'translation' | 'sentence-completion' | 'word-order' | 'free-text' | 'grammar-transformation'
>

interface SentenceBuilderProps {
  exercise: PremiumExercise
  answerType?: AnswerType
  onAnswer: (answer: UserAnswer) => void
  disabled?: boolean
}

/**
 * Translation / sentence-builder challenge: reconstruct the target sentence by
 * placing word chips into ordered slots. Supports drag-and-drop and tap-to-select.
 *
 * - For `word_order`, emits `{ type: 'word_order', orderedTokenIds }` (order
 *   is significant, so the validator checks position-by-position).
 * - For `translation` / `sentence_completion`, emits a `{ type, text }` answer.
 */
export function SentenceBuilder({
  exercise,
  answerType = 'sentence-completion',
  onAnswer,
  disabled = false,
}: SentenceBuilderProps) {
  const target = exercise.answer ?? ''
  const words = useMemo(() => shuffle(wordBankFromAnswer(target)), [target])
  const [placed, setPlaced] = useState<string[]>([])
  const [hintUsed, setHintUsed] = useState(false)
  const correctWords = target.split(/\s+/).filter(Boolean)

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    const word = e.dataTransfer.getData('text/plain')
    if (!word) return
    const used = placed
    const idx = slotIndex
    const usedCount = used.filter((w) => w === word).length
    const totalCount = words.filter((w) => w === word).length
    if (usedCount >= totalCount) return
    const next = [...placed]
    next[idx] = word
    setPlaced(next)
  }

  const handleTapWord = (word: string) => {
    if (disabled) return
    // Place into the first empty slot; if all filled, replace last empty-ish slot.
    const emptyIdx = placed.findIndex((w, i) => !w && i < correctWords.length)
    if (emptyIdx === -1) return
    const next = [...placed]
    next[emptyIdx] = word
    setPlaced(next)
  }

  const handleSlotTap = (slotIndex: number) => {
    if (disabled) return
    const word = placed[slotIndex]
    if (!word) return
    setPlaced((prev) => {
      const next = [...prev]
      next[slotIndex] = ''
      return next
    })
  }

  const handleHint = () => {
    if (hintUsed) return
    setHintUsed(true)
    // Reveal one correct word into the first incorrect/empty slot.
    for (let i = 0; i < correctWords.length; i++) {
      if (placed[i] !== correctWords[i]) {
        const next = [...placed]
        next[i] = correctWords[i]
        setPlaced(next)
        return
      }
    }
  }

  const handleSubmit = () => {
    const filled = placed.slice(0, correctWords.length)
    if (filled.some((w) => !w)) return
  if (answerType === 'word-order') {
    const answer: UserAnswer = {
      type: 'word-order',
        orderedTokenIds: filled.map((w, i) => `${i}-${w}`),
      }
      onAnswer(answer)
    } else {
      onAnswer({ type: answerType, text: filled.join(' ') })
    }
  }

  const allFilled = placed.length >= correctWords.length && placed.slice(0, correctWords.length).every(Boolean)

  return (
    <motion.div className="flex flex-col items-center">
      {/* Top row: avatar + source + audio */}
      <div className="flex items-center justify-center gap-4 mb-6 w-full">
        <Avatar emotion={disabled ? 'correct' : 'idle'} size={72} />
        <div className="text-center flex-1">
          <div className="text-sm text-[#6B7280] mb-1">Translate this sentence</div>
          <div className="text-xl font-medium text-[#A8A29E] leading-relaxed">
            {exercise.prompt}
            {exercise.prompt.endsWith('.') ? '' : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={() => speak(exercise.locale || exercise.prompt, exercise.locale)}
          className="w-11 h-11 rounded-full bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] flex items-center justify-center hover:bg-[rgba(16,185,129,0.2)] transition-all focus:ring-2 focus:ring-[var(--color-accent-lime)] focus:ring-offset-2 focus:ring-offset-[#0C0C0C]"
          aria-label="Play audio"
        >
          <Volume2 size={18} className="text-[#10B981]" />
        </button>
      </div>

      {/* Answer area */}
      <div
        className="flex flex-wrap justify-center items-center gap-1 mb-8 min-h-[7rem] px-4"
        aria-label="Your answer"
      >
        {correctWords.map((_, i) => {
          const word = placed[i]
          const correct = word === correctWords[i]
          return (
            <motion.div
              key={i}
              className={`answer-slot ${!word ? 'empty' : correct ? 'filled' : ''}`}
              onDrop={(e) => handleDrop(e, i)}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => handleSlotTap(i)}
              role="button"
              tabIndex={0}
              aria-label={word ? word : `empty slot ${i + 1}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSlotTap(i)
              }}
            >
              {word ? (
                <motion.span
                  className="px-1 text-[#FAF8F5] font-medium"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  {word}
                </motion.span>
              ) : null}
            </motion.div>
          )
        })}
      </div>

      {/* Word bank */}
      <WordBank words={words} placed={placed} onWordTap={handleTapWord} disabled={disabled} />

      {/* Controls */}
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
          className={`btn-primary text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-[var(--color-accent-lime)] focus:ring-offset-2 focus:ring-offset-[#0C0C0C]`}
          aria-label="Check answer"
        >
          <Check size={15} />
          Check
        </button>
      </div>

      {disabled && target && (
        <div className="mt-4 text-center">
          <Share2 size={13} className="text-[#6B7280] inline mr-1" />
          <span className="text-xs text-[#6B7280]">Correct answer: </span>
          <span className="text-xs font-medium text-[#10B981]">{target}</span>
        </div>
      )}
    </motion.div>
  )
}

function speak(text?: string, locale?: string) {
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = locale ?? 'de-DE'
  u.rate = 0.95
  window.speechSynthesis.speak(u)
}
