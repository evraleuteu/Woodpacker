'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical, Check, Share2, RotateCw } from 'lucide-react'
import { Avatar } from './Avatar'
import { answersMatch } from '@/lib/exercise-helpers'
import type { PremiumExercise } from '@/lib/types/exercise'
import type { ExerciseType, UserAnswer } from '@/lib/exercise-model'

type AnswerType = Extract<ExerciseType, 'word-order' | 'sentence-completion' | 'translation' | 'free-text' | 'grammar-transformation'>

interface SentenceBlocksProps {
  exercise: PremiumExercise
  answerType?: AnswerType
  onAnswer: (answer: UserAnswer) => void
  disabled?: boolean
}

const VERB_HINTS = new Set([
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might',
  'must', 'shall', 'need', 'dare', 'go', 'let', 'make', 'get', 'say', 'told',
  'sein', 'haben', 'werden', 'können', 'müssen', 'soll', 'wird', 'war', 'sind',
  'être', 'avoir', 'aller', 'pouvoir', 'devoir', 'vouloir', 'faire',
  'ser', 'estar', 'tener', 'ir', 'poder', 'deber', 'querer', 'hacer',
  'essere', 'avere', 'andare', 'potere', 'dovere', 'volere', 'fare',
])

function shuffle<T>(arr: T[]): T[] {
  const pool = [...arr]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

function blockType(word: string): 'subject' | 'verb' | 'object' {
  const lw = word.toLowerCase()
  if (VERB_HINTS.has(lw)) return 'verb'
  if (/^[A-Z]/.test(word) && lw !== word.toLowerCase()) return 'subject'
  return 'object'
}

/**
 * Grammar / sentence-arrangement challenge. Words are draggable blocks
 * colour-coded by grammatical role; the learner puts them in the correct order.
 *
 * - `word_order`: emits `{ type: 'word_order', orderedTokenIds }` (order matters).
 * - `sentence_completion`: emits `{ type: 'sentence_completion', text }`.
 */
export function SentenceBlocks({ exercise,   answerType = 'word-order', onAnswer, disabled = false }: SentenceBlocksProps) {
  const prompt = exercise.prompt || ''
  const answer = exercise.answer ?? ''
  const correctWords = answer.split(/\s+/).filter(Boolean)
  const [ordered, setOrdered] = useState<string[]>([])
  const [shuffled, setShuffled] = useState<string[]>(() => shuffle(correctWords))

  const addWord = (word: string) => {
    if (disabled || ordered.length >= correctWords.length) return
    setOrdered((o) => [...o, word])
    setShuffled((prev) => {
      const idx = prev.indexOf(word)
      if (idx < 0) return prev
      const copy = [...prev]
      copy.splice(idx, 1)
      return copy
    })
  }

  const removeWord = (slotIndex: number) => {
    if (disabled) return
    const word = ordered[slotIndex]
    setOrdered((o) => o.filter((_, i) => i !== slotIndex))
    setShuffled((prev) => [...prev, word])
  }

  const handleSubmit = () => {
    if (ordered.length !== correctWords.length) return
    if (answerType === 'word-order') {
      onAnswer({ type: 'word-order', orderedTokenIds: ordered.map((w, i) => `${i}-${w}`) })
    } else {
      onAnswer({ type: answerType, text: ordered.join(' ') })
    }
  }

  const handleReset = () => {
    setOrdered([])
    setShuffled(shuffle(correctWords))
  }

  const correct = ordered.length === correctWords.length && answersMatch(ordered.join(' '), answer)

  return (
    <motion.div className="flex flex-col items-center">
      <div className="flex justify-center mb-2">{<Avatar emotion={disabled ? 'correct' : 'thinking'} size={70} />}</div>

      <p className="text-center text-[#A8A29E] mb-6 max-w-md">{prompt}</p>

      <div className="w-full max-w-2xl mb-8">
        <div
          className="flex flex-wrap justify-center items-center gap-1.5 min-h-[4.5rem] p-3 rounded-xl bg-[rgba(250,248,245,0.02)] border-2 border-dashed border-[rgba(250,248,245,0.12]"
          aria-label="Built sentence"
        >
          {ordered.map((word, i) => (
            <WordBlock key={`o-${i}`} word={word} type={blockType(word)} onClick={() => removeWord(i)} interactive={false} />
          ))}
          {ordered.length === 0 && (
            <span className="text-[11px] text-[#6B7280]">Arrange the words by tapping blocks below</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <AnimatePresence>
          {shuffled.map((word, i) => (
            <WordBlock key={`s-${i}-${word}`} word={word} type={blockType(word)} onClick={() => addWord(word)} interactive={!disabled} />
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5 focus:ring-2 focus:ring-[var(--color-accent-lime)]"
        >
          <RotateCw size={13} />
          Reset
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={ordered.length !== correctWords.length || disabled}
          className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-[var(--color-accent-lime)]"
        >
          <Check size={15} />
          Check
        </button>
      </div>

      {disabled && answer && (
        <div className="mt-4 text-center">
          <Share2 size={13} className="text-[#6B7280] inline mr-1" />
          <span className="text-xs text-[#6B7280]">Correct answer: </span>
          <span className="text-xs font-medium text-[#10B981]">{answer}</span>
        </div>
      )}

      <AnimatePresence>{correct && !disabled && <CorrectCue />}</AnimatePresence>
    </motion.div>
  )
}

function CorrectCue() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="px-5 py-2 rounded-full bg-gradient-to-r from-[var(--color-accent-lime)] to-[#10B981] text-white font-bold shadow-[0_0_24px_rgba(132,204,22,0.4)]"
        animate={{ scale: [1, 1.1, 1] }}
      >
        Correct order!
      </motion.div>
    </motion.div>
  )
}

interface WordBlockProps {
  word: string
  type: 'subject' | 'verb' | 'object'
  onClick: () => void
  interactive: boolean
}

const TYPE_STYLE: Record<'subject' | 'verb' | 'object', string> = {
  subject: 'border-[var(--color-accent-purple)]/50 bg-[rgba(168,85,247,0.08)] text-[#C4B5FF]',
  verb: 'border-[var(--color-accent-lime)]/50 bg-[rgba(132,204,22,0.08)] text-[#A3E67B]',
  object: 'border-[var(--color-accent-sky)]/50 bg-[rgba(56,189,248,0.08)] text-[#7DD3FC]',
}

function WordBlock({ word, type, onClick, interactive }: WordBlockProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`sentence-block ${TYPE_STYLE[type]} ${interactive ? 'cursor-pointer' : ''} focus-ring`}
      layout
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      whileHover={interactive ? { y: -3, scale: 1.06 } : {}}
      whileTap={interactive ? { scale: 0.96 } : {}}
      aria-label={word}
    >
      <GripVertical size={12} className="opacity-40" />
      {word}
    </motion.button>
  )
}
