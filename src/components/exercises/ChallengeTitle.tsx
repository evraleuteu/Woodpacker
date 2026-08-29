'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

interface ChallengeTitleProps {
  children: React.ReactNode
  subtitle?: string
  icon?: React.ReactNode
}

/** Large, bold instruction heading. Task must be clear within 1 second. */
export function ChallengeTitle({ children, subtitle, icon }: ChallengeTitleProps) {
  return (
    <motion.div
      className="flex flex-col items-center text-center mb-6"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex items-center justify-center gap-3 mb-1">
        {icon ?? <Sparkles size={22} className="text-[var(--color-accent-purple)]" />}
        <h1 className="challenge-title text-[#FAF8F5]">{children}</h1>
      </div>
      {subtitle ? <p className="text-sm text-[#A8A29E] max-w-md">{subtitle}</p> : null}
    </motion.div>
  )
}
