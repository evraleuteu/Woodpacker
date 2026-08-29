'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { randomPositive } from '@/lib/animations'

interface XPRewardProps {
  amount: number
  /** anchor element to float up from */
  anchor: HTMLElement | null
  onComplete?: () => void
  showMessage?: boolean
}

/** Floating "+10 XP" number that rises and fades, plus a positive message. */
export function XPReward({ amount, anchor, onComplete, showMessage = true }: XPRewardProps) {
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!anchor || done) return
    const t = setTimeout(() => {
      setDone(true)
      setTimeout(() => onComplete?.(), 200)
    }, 1500)
    return () => clearTimeout(t)
  }, [anchor, done, onComplete])

  if (done) return null

  const position = !anchor
    ? { x: 0, y: 0 }
    : (() => {
        const rect = anchor.getBoundingClientRect()
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      })()

  const visible = !!anchor && !done

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed z-50 pointer-events-none flex flex-col items-center"
          style={{ left: position.x, top: position.y }}
          initial={{ opacity: 0, scale: 0.5, y: 0 }}
          animate={{ opacity: 1, scale: 1, y: -70 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#A855F7] to-[#84CC16] text-white text-sm font-extrabold shadow-lg"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: 2 }}
          >
            +{amount} XP
          </motion.span>
          {showMessage && (
            <motion.span
              className="mt-1 text-xs font-medium text-[#84CC16]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              {randomPositive()}
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

