'use client'

import { motion } from 'framer-motion'
import { cardEntrance } from '@/lib/animations'
import type { PremiumExercise } from '@/lib/types/exercise'

interface ExerciseCardProps {
  exercise: PremiumExercise
  success?: boolean
  error?: boolean
  children: React.ReactNode
  className?: string
}

/** Centered wrapper card with consistent premium styling, elevation & status glow. */
export function ExerciseCard({
  exercise,
  success = false,
  error = false,
  children,
  className = '',
}: ExerciseCardProps) {
  const statusClass = success ? 'success-glow' : error ? 'error-shake' : 'elevated'
  return (
    <motion.div
      variants={cardEntrance}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`exercise-card mx-auto w-full max-w-2xl ${statusClass} ${className}`}
      role="region"
      aria-label={exercise.challengeTitle}
    >
      <div className="p-6 sm:p-8">{children}</div>
    </motion.div>
  )
}
