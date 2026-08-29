'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Avatar } from './Avatar'
import { answersMatch } from '@/lib/exercise-helpers'
import type { PremiumExercise } from '@/lib/types/exercise'
import type { Option, UserAnswer } from '@/lib/exercise-model'

interface ChoiceCardProps {
  exercise: PremiumExercise
  allowMultiple?: boolean
  /** true once the deck has submitted (locks further changes). */
  disabled?: boolean
  onAnswer: (answer: UserAnswer) => void
}

/**
 * Multiple-choice / multiple-select challenge.
 *
 * Interaction contract with the deck:
 *  - On each selection it fires `onAnswer` immediately (the deck decides
 *    whether to validate now or wait for a Check click).
 *  - Once `disabled` is true (answer submitted), selections are locked and
 *    the correctness of every option is shown.
 *
 * The deck passes `selected`/`selectedSet` via the component's own internal
 * state which resets on retry (controlled by `key` change in the deck) —
 * the deck re-mounts the child to reset state.
 */
export function ChoiceCard({ exercise, allowMultiple = false, disabled = false, onAnswer }: ChoiceCardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set())

  const options = buildOptions(exercise)
  const correct = exercise.answer ?? ''
  const answered = disabled

  const optionCorrect = (option: Option) => answersMatch(option.label, correct)
  const handleSelect = (optionId: string) => {
    if (answered) return
    if (allowMultiple) {
      setSelectedSet((prev) => {
        const next = new Set(prev)
        if (next.has(optionId)) next.delete(optionId)
        else next.add(optionId)
        const answer: UserAnswer = { type: 'multiple-select', selectedOptionIds: [...next] }
        onAnswer(answer)
        return next
      })
    } else {
      setSelected(optionId)
      onAnswer({ type: 'multiple-choice', selectedOptionId: optionId })
    }
  }

  const isCorrect = (option: Option) => optionCorrect(option)
  const isWrong = (option: Option) => answered && (allowMultiple ? selectedSet.has(option.id) : selected === option.id) && !optionCorrect(option)

  return (
    <motion.div className="flex flex-col items-center">
      <div className="flex justify-center mb-2">
        {answered ? (allCorrect(options, correct) ? <Avatar emotion="correct" size={64} /> : <Avatar emotion="wrong" size={64} />) : <Avatar emotion="thinking" size={64} />}
      </div>

      <p className="text-center text-[#A8A29E] mb-6 max-w-md">{exercise.prompt}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
        <AnimatePresence>
          {options.map((option, i) => (
            <ChoiceOption
              key={option.id}
              option={option}
              index={i}
              selected={allowMultiple ? selectedSet.has(option.id) : selected === option.id}
              answered={answered}
              correct={isCorrect(option)}
              wrong={isWrong(option)}
              disabled={disabled}
              onSelect={() => handleSelect(option.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function allCorrect(options: Option[], correct: string): boolean {
  return options.every((o) => answersMatch(o.label, correct))
}

function buildOptions(exercise: PremiumExercise): Option[] {
  if (exercise.optionItems?.length) return exercise.optionItems
  return (exercise.options ?? []).map((label, i) => ({ id: `opt-${i}`, label }))
}

interface ChoiceOptionProps {
  option: Option
  index: number
  selected: boolean
  answered: boolean
  correct: boolean
  wrong: boolean
  disabled: boolean
  onSelect: () => void
}

function ChoiceOption({ option, index, selected, answered, correct, wrong, disabled, onSelect }: ChoiceOptionProps) {
  const label = String.fromCharCode(65 + index)
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled || answered}
      className={`choice-card focus-ring ${
        answered
          ? correct
            ? 'selected-correct'
            : wrong
              ? 'selected-incorrect'
              : selected
                ? 'selected-incorrect'
                : 'dimmed'
              : 'hover:border-[var(--color-accent-purple)] hover:bg-[rgba(250,248,245,0.04)]'
      } ${answered ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      whileHover={!answered && !disabled ? { y: -4 } : {}}
      aria-label={`${label}: ${option.label}`}
    >
      <span className="text-xs font-medium text-[#6B7280] mb-1">{label}</span>
      <div className="text-lg font-semibold text-[#FAF8F5] flex-1 whitespace-pre-wrap break-words">{option.label}</div>
      {answered && correct && <CheckCircle2 size={18} className="text-[var(--color-accent-lime)] shrink-0" />}
      {answered && wrong && <XCircle size={18} className="text-[#EF4444] shrink-0" />}
    </motion.button>
  )
}
