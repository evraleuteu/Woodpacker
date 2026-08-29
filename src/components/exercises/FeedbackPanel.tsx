'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, HelpCircle, RefreshCw, SkipForward } from 'lucide-react'
import { Avatar } from './Avatar'
import { Confetti } from './Confetti'
import { XPReward } from './XPReward'
import { randomPositive } from '@/lib/animations'
import type { AvatarEmotion, FeedbackType } from '@/lib/types/exercise'

interface FeedbackPanelProps {
  visible: boolean
  type: FeedbackType
  /** the learner's answer (shown for incorrect) */
  answer?: string
  correctAnswer?: string
  explanation?: string
  xp?: number
  nextLabel?: string
  onNext: () => void
  onRetry?: () => void
  onExplain?: () => void
  anchorEl?: HTMLElement | null
}

/**
 * Full-card feedback overlay. Replaces the challenge UI once an answer is
 * submitted. Celebrates correct answers; guides incorrect ones.
 */
export function FeedbackPanel({
  visible,
  type,
  answer,
  correctAnswer,
  explanation,
  xp,
  nextLabel = 'Next',
  onNext,
  onRetry,
  onExplain,
  anchorEl,
}: FeedbackPanelProps) {
  const isCorrect = type === 'correct'
  const emotion: AvatarEmotion = isCorrect ? 'celebrate' : 'wrong'
  const message = isCorrect ? randomPositive() : 'Almost!'

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="overlay"
            className="absolute inset-0 z-10 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* dimmed backdrop */}
            <div className="absolute inset-0 bg-[rgba(0,0,0,0.35)] backdrop-blur-[2px]" aria-hidden="true" />
            <motion.div
              className="relative z-10 w-full max-w-xl"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22, duration: 0.35 }}
            >
              <div
                className={`rounded-[22px] border p-8 pb-6 text-center relative overflow-hidden ${
                  isCorrect
                    ? 'border-[#BBF7D0] bg-[#F0FDF4]'
                    : 'border-[#FECACA] bg-[#FEF2F2]'
                }`}
              >
                <div className="flex justify-center mb-4">{<Avatar emotion={emotion} size={80} />}</div>

                <motion.div
                  key="icon"
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                    isCorrect ? 'bg-[var(--color-accent-lime)]' : 'bg-[#EF4444]'
                  } text-white`}
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ type: 'spring', stiffness: 400, delay: 0.15 }}
                >
                  {isCorrect ? <Check size={32} /> : <X size={32} />}
                </motion.div>

                <motion.h2
                  className={`text-2xl font-bold mb-1 ${isCorrect ? 'text-[#1F7A4C]' : 'text-[#B91C1C]'}`}
                  key={message}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {message}
                </motion.h2>

                {isCorrect && xp ? (
                  <motion.div
                    className="text-sm text-[#A8A29E] mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                  >
                    +{xp} XP — keep the streak alive!
                  </motion.div>
                ) : null}

                {!isCorrect && (
                  <div className="text-left text-sm text-[#A8A29E] mb-4 space-y-2">
                    <div>
                      <span className="text-[#6B7280]">Your answer: </span>
                      <span className="text-[#FAF8F5]">{answer}</span>
                    </div>
                    {correctAnswer && (
                      <div>
                        <span className="text-[#6B7280]">Correct: </span>
                        <span className="font-medium text-[#10B981]">{correctAnswer}</span>
                      </div>
                    )}
                  </div>
                )}

                {explanation && !isCorrect && (
                  <div className="text-left text-xs text-[#6B7280] bg-[rgba(250,248,245,0.03)] rounded-lg p-3 mb-4 border border-[rgba(250,248,245,0.06)]">
                    {explanation}
                  </div>
                )}

                <motion.div
                  className="flex flex-col sm:flex-row gap-2 justify-center mt-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {isCorrect ? (
                    <motion.button
                      onClick={onNext}
                      className="btn-primary text-sm px-6 py-2.5 inline-flex items-center gap-2 focus:ring-2 focus:ring-[var(--color-accent-lime)]"
                      whileTap={{ scale: 0.96 }}
                    >
                      {nextLabel}
                      <SkipForward size={15} />
                    </motion.button>
                  ) : (
                    <>
                      {onRetry ? (
                        <motion.button
                          onClick={onRetry}
                          className="btn-secondary text-sm px-4 py-2 inline-flex items-center gap-1.5 focus:ring-2 focus:ring-[var(--color-accent-lime)]"
                          whileTap={{ scale: 0.96 }}
                        >
                          <RefreshCw size={14} />
                          Try again
                        </motion.button>
                      ) : null}
                      <motion.button
                        onClick={onNext}
                        className="btn-primary text-sm px-6 py-2.5 inline-flex items-center gap-2 focus:ring-2 focus:ring-[var(--color-accent-lime)]"
                        whileTap={{ scale: 0.96 }}
                      >
                        {nextLabel}
                        <SkipForward size={15} />
                      </motion.button>
                    </>
                  )}
                  {onExplain ? (
                    <motion.button
                      onClick={onExplain}
                      className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1 focus:ring-2 focus:ring-[var(--color-accent-lime)]"
                      whileTap={{ scale: 0.96 }}
                    >
                      <HelpCircle size={12} />
                      Why?
                    </motion.button>
                  ) : null}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <XPReward amount={xp ?? 0} anchor={anchorEl ?? null} onComplete={() => {}} showMessage={false} />
      {visible && isCorrect && <Confetti count={70} />}
    </>
  )
}
