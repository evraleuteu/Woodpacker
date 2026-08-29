/** Derives a shuffled, deduped word bank from a correct answer sentence. */
export function wordBankFromAnswer(answer: string): string[] {
  return Array.from(new Set(answer.split(/\s+/).filter((w) => w.length > 0)))
}

/** Counts occurrences of `val` in an array. */
export function countOccurrences(arr: string[], val: string): number {
  return arr.filter((v) => v === val).length
}

/** Shuffles an array in place using Fisher–Yates. */
export function shuffle<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Normalises an answer string for comparison: lowercase, collapse spaces, drop punctuation edges. */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s']/gu, '')
    .replace(/\s+/g, ' ')
}

/** True when two answers are equivalent after normalisation + word-set comparison. */
export function answersMatch(a: string, b: string): boolean {
  const na = normalizeAnswer(a)
  const nb = normalizeAnswer(b)
  if (na === nb) return true
  const wa = na.split(' ').filter(Boolean)
  const wb = nb.split(' ').filter(Boolean)
  if (wa.length !== wb.length) return false
  return wa.every((w) => wb.includes(w)) && wb.every((w) => wa.includes(w))
}

/** Compare a set of placed words against expected words (order-independent). */
export function wordsMatchPlaced(placed: string[], expected: string[]): boolean {
  if (placed.length !== expected.length) return false
  const pa = placed.map(normalizeAnswer)
  const ea = expected.map(normalizeAnswer)
  return pa.every((w) => ea.includes(w)) && ea.every((w) => pa.includes(w))
}

/**
 * For fill-blank exercises, returns the prompt split into visible "slots",
 * where missing words are represented as empty placeholders. Missing words are
 * derived from `answer`. Falls back to a single gap if no explicit markers.
 */
export interface GapSlot {
  text: string // visible label before the gap (empty for a leading gap)
  gap: boolean
  answer: string // expected word (only meaningful when gap===true)
}

export function buildGapSlots(prompt: string, answer?: string): GapSlot[] {
  const gapRegex = /___|\[\s*\]|\.\.\./
  if (answer && !gapRegex.test(prompt)) {
    // No explicit markers — use the whole answer as the single blank.
    return [{ text: prompt.trim(), gap: true, answer: answer.trim() }]
  }
  if (!answer) {
    // Split the prompt on gap markers, mark gaps, derive expected answer from neighbours.
    const parts = prompt.split(/(\s*___|\[\s*\]|\.\.\.\s*)/).filter((p) => p.length > 0)
    const slots: GapSlot[] = []
    for (const part of parts) {
      if (gapRegex.test(part)) {
        slots.push({ text: '', gap: true, answer: '' })
      } else {
        const prev = slots[slots.length - 1]
        if (prev && prev.gap) {
          prev.answer = part.trim()
        } else {
          slots.push({ text: part.trim(), gap: false, answer: '' })
        }
      }
    }
    return slots.length ? slots : [{ text: prompt.trim(), gap: false, answer: '' }]
  }
  // Both markers and an answer present — derive per-gap answers from the answer sentence.
  const answerWords = answer.split(/\s+/).filter(Boolean)
  let ai = 0
  const parts = prompt.split(/(\s*___|\[\s*\]|\.\.\.\s*)/).filter((p) => p.length > 0)
  const slots: GapSlot[] = []
  for (const part of parts) {
    if (gapRegex.test(part)) {
      slots.push({ text: '', gap: true, answer: answerWords[ai] ?? '' })
      ai++
    } else {
      slots.push({ text: part.trim(), gap: false, answer: '' })
    }
  }
  return slots.length ? slots : [{ text: prompt.trim(), gap: false, answer: '' }]
}

/** Compare two answer strings for equivalence (order-independent word match). */
export function answersEquivalent(a: string, b: string): boolean {
  return answersMatch(a, b) || wordsMatchPlaced(a.split(/\s+/).filter(Boolean), b.split(/\s+/).filter(Boolean))
}

import type { UserAnswer } from '@/lib/exercise-model'

/** Human-readable summary of a structured answer for the feedback panel. */
export function labelForAnswer(answer: UserAnswer | null): string {
  if (!answer) return 'No answer'
  switch (answer.type) {
    case 'multiple-choice':
    case 'single-choice':
      return answer.selectedOptionId
    case 'multiple-select':
      return (answer.selectedOptionIds ?? []).join(', ')
    case 'fill-blank':
    case 'gap-text':
      return Object.values(answer.values ?? {}).join(' | ')
    case 'sentence-completion':
    case 'translation':
    case 'free-text':
    case 'grammar-transformation':
      return answer.text
    case 'word-order':
      return (answer.orderedTokenIds ?? []).join(' → ')
    case 'matching':
      return Object.entries(answer.pairs ?? {})
        .map(([k, v]) => `${k} = ${v}`)
        .join('; ')
    case 'drag-drop':
      return Object.entries(answer.placement ?? {})
        .map(([k, v]) => `${k} = ${v}`)
        .join('; ')
    case 'pattern-drill':
      return answer.completed ? 'All pairs matched' : ''
    case 'article-selection':
    case 'case-selection':
      return Object.entries(answer.selected ?? {})
        .map(([k, v]) => `${k} = ${v}`)
        .join('; ')
    case 'listening':
      return answer.answer ?? ''
    case 'speaking':
      return answer.text ?? answer.audioUrl ?? '(recording)'
    case 'image-description':
      return answer.text ?? '(description)'
    case 'true-false':
      return answer.selected ?? ''
    case 'assessment':
      return answer.answer ?? ''
    default:
      return ''
  }
}
