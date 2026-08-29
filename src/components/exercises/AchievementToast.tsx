'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, X, Sparkles } from 'lucide-react'
import { toastVariants } from '@/lib/animations'
import type { Badge } from '@/lib/types/exercise'

interface AchievementToastProps {
  badge: Badge
  autoDismissMs?: number
  onDismiss?: () => void
  onViewCollection?: () => void
}

export function AchievementToast({ badge, autoDismissMs = 3500, onDismiss, onViewCollection }: AchievementToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss?.(), 250)
    }, autoDismissMs)
    return () => clearTimeout(t)
  }, [autoDismissMs, onDismiss])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-4 right-4 z-[100] max-w-xs w-full"
          variants={toastVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onViewCollection}
        >
          <div className="flex items-center gap-3 p-4 rounded-xl glass-card border-2 border-[var(--color-accent-purple)] shadow-[0_0_24px_rgba(168,85,247,0.25)]">
            <motion.div
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center text-white shrink-0"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              {badge.icon === 'flame' ? <Trophy size={18} /> : <Sparkles size={18} />}
            </motion.div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#F59E0B] uppercase tracking-wide">Badge Unlocked</span>
              </div>
              <div className="text-sm font-semibold text-[#FAF8F5]">{badge.label}</div>
              <div className="text-[10px] text-[#6B7280] mt-0.5">{badge.description}</div>
            </div>
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setVisible(false)
                setTimeout(() => onDismiss?.(), 250)
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] focus:ring-1 focus:ring-[var(--color-accent-lime)] shrink-0"
              aria-label="Dismiss"
            >
              <X size={10} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
