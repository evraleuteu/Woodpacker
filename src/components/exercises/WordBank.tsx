'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import type { DragEvent } from 'react'

interface WordBankProps {
  words: string[]
  /** words already placed in the answer area (excluded from the bank) */
  placed: string[]
  /** called when a word is tapped (mobile-friendly selection) */
  onWordTap?: (word: string) => void
  /** orientation of the bank */
  vertical?: boolean
  disabled?: boolean
}

/**
 * Renders a bank of draggable word chips. Uses the native HTML5 Drag and
 * Drop API (no extra dependencies) and also supports tap-to-select on touch
 * devices via `onWordTap`.
 */
export function WordBank({ words, placed, onWordTap, vertical = false, disabled = false }: WordBankProps) {
  const available = words.filter((w) => countOccurrences(words, w) > countOccurrences(placed, w))
  if (!available.length) return null

  return (
    <div
      className={`flex flex-wrap gap-2 ${vertical ? 'flex-col w-full' : 'justify-center'} mb-2`}
      role="toolbar"
      aria-label="Word bank"
    >
      <AnimatePresence>
        {Array.from(uniqueWithOrder(available)).map((word, i) => {
          const remaining = countOccurrences(available, word)
          return (
            <WordChip
              key={`${word}-${i}`}
              word={word}
              index={i}
              remaining={remaining}
              total={countOccurrences(available, word)}
              onTap={onWordTap}
              disabled={disabled}
            />
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function countOccurrences(arr: string[], val: string): number {
  return arr.filter((v) => v === val).length
}

function uniqueWithOrder(arr: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of arr) {
    const key = item
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }
  return result
}

interface WordChipProps {
  word: string
  index: number
  remaining: number
  total: number
  onTap?: (word: string) => void
  disabled?: boolean
}

function WordChip({ word, index, remaining, total, onTap, disabled }: WordChipProps) {
  const id = `wb-chip-${index}-${encodeURIComponent(word).replace(/[^a-z0-9]/gi, '')}`

  const handleDragStart = (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData('application/x-word', word)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', word)
  }

  return (
    <motion.button
      id={id}
      type="button"
      disabled={disabled}
      draggable={!disabled}
      onDragStart={handleDragStart as unknown as (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void}
      onClick={() => onTap?.(word)}
      aria-label={word}
      onDoubleClick={(e) => {
        e.preventDefault()
      }}
      className={`word-chip text-left relative overflow-hidden select-none`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
    >
      {word}
      {total > 1 && (
        <span
          className="absolute -top-1 -right-1 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
          style={{ color: '#6B7280', background: 'rgba(250,248,245,0.06)' }}
          aria-hidden="true"
        >
          {remaining}
        </span>
      )}
    </motion.button>
  )
}
