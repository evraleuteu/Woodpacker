'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { Avatar } from './Avatar'
import { emitConfetti } from '@/lib/animations'
import type { PremiumExercise } from '@/lib/types/exercise'
import type { UserAnswer } from '@/lib/exercise-model'

interface GameBoardProps {
  exercise: PremiumExercise
  pairs: Array<{ pairId: string; front: string; back: string; frontImage?: string; backImage?: string }>
  onAnswer: (answer: UserAnswer) => void
  disabled?: boolean
}

interface CardState {
  id: string
  pairId: string
  side: 'front' | 'back'
  revealed: boolean
  matched: boolean
}

/**
 * Memory-matching game board. Cards flip when tapped; matching pairs are
 * connected and removed. Celebrates when all pairs are matched.
 */
export function GameBoard({ exercise, pairs, onAnswer, disabled = false }: GameBoardProps) {
  const [cards, setCards] = useState<CardState[]>([])
  const [flipped, setFlipped] = useState<string[]>([])
  const [matchedCount, setMatchedCount] = useState(0)
  const [lock, setLock] = useState(false)

  useEffect(() => {
    resetBoard(pairs)
  }, [pairs])

  function resetBoard(pairs: GameBoardProps['pairs']) {
    const deck: CardState[] = []
    for (const p of pairs) {
      deck.push({ id: `${p.pairId}-f`, pairId: p.pairId, side: 'front', revealed: false, matched: false })
      deck.push({ id: `${p.pairId}-b`, pairId: p.pairId, side: 'back', revealed: false, matched: false })
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
    setCards(deck)
    setFlipped([])
    setMatchedCount(0)
    setLock(false)
  }

  const handleFlip = (cardId: string) => {
    if (disabled || lock || flipped.length === 2 || flipped.includes(cardId)) return
    const nextFlipped = [...flipped, cardId]
    setFlipped(nextFlipped)
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, revealed: true } : c)))

    if (nextFlipped.length === 2) {
      setLock(true)
      const [a, b] = nextFlipped.map((id) => cards.find((c) => c.id === id)!).filter(Boolean)
      const match = a && b && a.pairId === b.pairId
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) => (c.id === a?.id || c.id === b?.id ? { ...c, revealed: false, matched: !!match } : c)),
        )
        setFlipped([])
        setLock(false)
        if (match) {
          setMatchedCount((m) => m + 1)
        }
      }, 900)
    }
  }

  useEffect(() => {
    if (matchedCount === pairs.length && pairs.length > 0) {
      const rect = document.getElementById('gameboard-root')
      if (rect) emitConfetti(rect, 80)
      const correct = pairs.map((p) => `${p.front} → ${p.back}`).join('\n')
      onAnswer({ type: 'pattern-drill', completed: true })
      void correct
    }
  }, [matchedCount, pairs, onAnswer])

  const solved = matchedCount === pairs.length && pairs.length > 0

  return (
    <motion.div className="flex flex-col items-center" id="gameboard-root">
      <div className="flex justify-center mb-2">
        <Avatar emotion={solved ? 'celebrate' : flipped.length ? 'thinking' : 'idle'} size={70} />
      </div>

      <p className="text-center text-[#A8A29E] mb-2 max-w-md">{exercise.prompt}</p>
      <div className="text-xs text-[#6B7280] mb-6">{matchedCount}/{pairs.length} pairs matched</div>

      {solved && (
        <motion.div
          className="mb-4 px-4 py-2 rounded-lg bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-sm text-[#10B981]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          All matched!
        </motion.div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full max-w-xl mb-4">
        <AnimatePresence>
          {cards.map((c) => {
            const pair = pairs.find((p) => p.pairId === c.pairId)
            if (!pair) return null
            const isFlipped = c.revealed || c.matched
            const face = c.side === 'back' ? pair.back : pair.front
            const faceImage = c.side === 'back' ? pair.backImage : pair.frontImage
            return (
              <motion.button
                key={c.id}
                type="button"
                onClick={() => handleFlip(c.id)}
                disabled={disabled || c.matched || c.revealed || lock}
                className={`game-card-inner focus-ring relative overflow-hidden ${c.matched ? 'matched' : ''}`}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: c.matched ? 0.6 : 1, rotateY: isFlipped ? 180 : 0 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.35, type: 'spring', stiffness: 320, damping: 22 }}
                aria-label={isFlipped ? face : 'unrevealed card'}
              >
                  {isFlipped ? (
                    <div className="text-center text-sm font-medium text-[#FAF8F5] p-2">
                      {faceImage ? (
                        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-sky)] flex items-center justify-center mx-auto mb-1">
                          <span className="text-[8px] text-white font-bold">IMG</span>
                        </div>
                      ) : null}
                      {face}
                    </div>
                ) : (
                  <span className="text-[#6B7280] text-2xl">?</span>
                )}
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      {!solved && (
        <button
          type="button"
          onClick={() => resetBoard(pairs)}
          disabled={disabled}
          className="btn-secondary text-xs flex items-center gap-1.5 focus:ring-2 focus:ring-[var(--color-accent-lime)]"
        >
          <RefreshCw size={13} />
          Reset board
        </button>
      )}
    </motion.div>
  )
}
