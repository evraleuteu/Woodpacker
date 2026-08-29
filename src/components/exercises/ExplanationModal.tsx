'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { modalVariants } from '@/lib/animations'
import type { PremiumExercise } from '@/lib/types/exercise'

export interface ExplanationStep {
  title: string
  body: string
  highlight?: string
}

interface ExplanationModalProps {
  visible: boolean
  onClose: () => void
  exercise: PremiumExercise
  correctAnswer?: string
  userAnswer?: string
  steps?: ExplanationStep[]
}

export function ExplanationModal({ visible, onClose, exercise, correctAnswer, userAnswer, steps }: ExplanationModalProps) {
  const [page, setPage] = useState(0)

  const fallbackSteps: ExplanationStep[] = [
    {
      title: 'Correct answer',
      body: correctAnswer ?? exercise.answer ?? 'No answer available.',
      highlight: correctAnswer ?? exercise.answer,
    },
    {
      title: 'Your attempt',
      body: userAnswer ? `You entered: "${userAnswer}"` : 'No answer was provided.',
      highlight: userAnswer,
    },
    {
      title: 'Why it is correct',
      body: exercise.explanation ?? 'Review the lesson and grammar rules for this pattern.',
      highlight: exercise.explanation ? undefined : undefined,
    },
    {
      title: 'Common mistakes',
      body: commonMistakeTip(exercise),
      highlight: commonMistakeTip(exercise).split('.')[0] + '.',
    },
    {
      title: 'Example sentences',
      body: exampleSentence(exercise),
      highlight: exercise.answer,
    },
    {
      title: 'Related concepts',
      body: relatedConcepts(exercise),
    },
  ]

  const pages = steps?.length ? steps : fallbackSteps

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setPage((p) => Math.min(p + 1, pages.length - 1))
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(p - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, onClose, pages, page])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="explanation-modal w-full max-w-2xl max-h-[85vh] bg-white border border-[#E5E7EB] rounded-[22px] overflow-hidden flex flex-col shadow-soft-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 pb-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6B7280]">
                  {page + 1} / {pages.length}
                </span>
                <h3 className="font-semibold text-[#111827] text-sm">{pages[page].title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] focus:ring-2 focus:ring-[#BBF7D0]"
                aria-label="Close explanation"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {pages[page].highlight ? (
                <p className="text-lg text-[#111827] leading-relaxed">
                  <mark className="bg-[#ECFDF5] text-[#1F7A4C] px-1 rounded">
                    {pages[page].highlight}
                  </mark>{' '}
                  {pages[page].body}
                </p>
              ) : (
                <p className="text-lg text-[#374151] leading-relaxed whitespace-pre-wrap">{pages[page].body}</p>
              )}
            </div>

            <div className="p-4 border-t border-[#E5E7EB] flex items-center justify-between">
              <motion.button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#BBF7D0]"
              >
                <ChevronLeft size={13} />
                Previous
              </motion.button>
              <div className="flex gap-1.5">
                {pages.map((_, i) => (
                  <motion.div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === page ? 'bg-[#1F7A4C] w-5' : 'bg-[#E5E7EB]'}`}
                  />
                ))}
              </div>
              <motion.button
                type="button"
                onClick={() => setPage((p) => Math.min(p + 1, pages.length - 1))}
                disabled={page === pages.length - 1}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#BBF7D0]"
              >
                Next
                <ChevronRight size={13} />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function commonMistakeTip(e: PremiumExercise): string {
  switch (e.type) {
    case 'fill-blank':
      return 'Check spelling, case endings and word order around the gap. Articles and verb endings change the meaning.'
    case 'multiple-choice':
      return 'Distractors often look similar to the correct answer — compare endings, tense and prepositions carefully.'
    case 'translation':
      return 'Word order often differs from English (verb position, separable prefixes). Read the sentence aloud to hear the rhythm.'
    case 'recall':
      return 'Reproduce the exact form — number, gender and tense must match the context.'
    case 'pattern-drill':
      return 'Keep the pattern structure identical and swap only the elements the drill asks for.'
    case 'roleplay':
      return 'Match the register of the situation: formal vs informal, question vs statement.'
    case 'comprehension':
      return 'Locate the evidence in the passage before answering — do not rely on memory alone.'
    case 'assessment':
      return 'Read the task fully and address every part of the prompt in your answer.'
    default:
      return 'Review the lesson and grammar rules for this pattern.'
  }
}

function exampleSentence(e: PremiumExercise): string {
  if (e.prompt && e.answer) return `Source: "${e.prompt}" → "${e.answer}".`
  if (e.answer) return `Correct form: "${e.answer}".`
  return 'No example available for this exercise.'
}

function relatedConcepts(e: PremiumExercise): string {
  const dims: Record<string, string> = {
    vocabulary: 'Vocabulary — word meanings and usage.',
    grammar: 'Grammar — sentence structure and rules.',
    listening: 'Listening — comprehension and sound patterns.',
    speaking: 'Speaking — pronunciation and fluency.',
    reading: 'Reading — comprehension and inference.',
    other: 'Mixed skills.',
  }
  const locale = e.locale ? ` Language: ${e.locale}.` : ''
  return `${dims[e.practice] ?? dims.other} Exercise type: ${e.challengeTitle}.${locale}`
}
