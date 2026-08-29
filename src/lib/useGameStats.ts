'use client'

import { useState, useCallback } from 'react'
import { BADGE_SPECS, xpForExercise } from '@/lib/exercise-config'
import type { Badge, GameStats } from '@/lib/types/exercise'
import type { PracticeDimension } from '@/lib/types/exercise'

const STORAGE_KEY = 'woodpacker:game-stats'

interface SerializedStats {
  xp: number
  streak: number
  level: number
  dailyGoal: number
  goalProgress: number
  solved: number
  mistakes: number
  consecutiveCorrect: number
  lastPracticeDay: number | null
  badgeProgress: Record<string, number>
  earnedBadges: string[]
}

function dayOfYear(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const start = Date.UTC(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start) / 86400000)
}

function emptyStats(): SerializedStats {
  return {
    xp: 0,
    streak: 0,
    level: 1,
    dailyGoal: 20,
    goalProgress: 0,
    solved: 0,
    mistakes: 0,
    consecutiveCorrect: 0,
    lastPracticeDay: null,
    badgeProgress: {},
    earnedBadges: [],
  }
}

function loadStats(): SerializedStats {
  if (typeof window === 'undefined') return emptyStats()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStats()
    const parsed = JSON.parse(raw) as SerializedStats
    return { ...emptyStats(), ...parsed }
  } catch {
    return emptyStats()
  }
}

function saveStats(stats: SerializedStats): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {}
}

function computeLevel(xp: number): number {
  return Math.max(1, Math.floor(xp / 100) + 1)
}

function computeBadges(stats: SerializedStats): Badge[] {
  const earned = new Set(stats.earnedBadges)
  return BADGE_SPECS.map((spec) => {
    const progress = statForDimension(stats, spec.practice)
    return {
      id: spec.id,
      label: spec.label,
      description: spec.description,
      icon: spec.icon,
      earned: earned.has(spec.id) || progress >= spec.threshold,
      threshold: spec.threshold,
      progress,
    }
  })
}

function statForDimension(stats: SerializedStats, practice: 'any' | PracticeDimension): number {
  if (practice === 'any') return stats.solved
  if (practice === 'other') return stats.solved
  return stats.badgeProgress[practice] ?? 0
}

interface UseGameStatsResult {
  stats: GameStats
  badges: Badge[]
  addXp: (amount: number, practice: PracticeDimension, perfect?: boolean) => { earnedBadges: Badge[] }
  reset: () => void
}

export function useGameStats(): UseGameStatsResult {
  const [serialized, setSerialized] = useState<SerializedStats>(() => loadStats())

  const persist = useCallback((next: SerializedStats) => {
    setSerialized(next)
    saveStats(next)
  }, [])

  const addXp = useCallback(
    (amount: number, practice: PracticeDimension, perfect = false): { earnedBadges: Badge[] } => {
      const prev = loadStats()
      const today = dayOfYear(new Date())
      const dayMatch = prev.lastPracticeDay === today
      const isYesterday = prev.lastPracticeDay !== null && today - (prev.lastPracticeDay ?? 0) === 1

      let streak = prev.streak
      if (!dayMatch) {
        streak = isYesterday ? streak + 1 : 1
      }

      const xp = prev.xp + amount
      const goalProgress = prev.goalProgress + amount
      const solved = prev.solved + 1
      const consecutiveCorrect = perfect ? prev.consecutiveCorrect + 1 : 0

      const badgeProgress = { ...prev.badgeProgress }
      badgeProgress[practice] = (badgeProgress[practice] ?? 0) + 1

      const newStats: SerializedStats = {
        ...prev,
        xp,
        streak,
        level: computeLevel(xp),
        goalProgress,
        solved,
        mistakes: perfect ? prev.mistakes : prev.mistakes + 1,
        consecutiveCorrect,
        lastPracticeDay: today,
        badgeProgress,
        earnedBadges: [...prev.earnedBadges],
      }

      const badgesBefore = computeBadges(prev)
      const badgesAfter = computeBadges(newStats)
      const earnedBadges = badgesAfter.filter(
        (b) => b.earned && !badgesBefore.find((x) => x.id === b.id)?.earned,
      )

      for (const b of earnedBadges) {
        if (!newStats.earnedBadges.includes(b.id)) {
          newStats.earnedBadges.push(b.id)
        }
      }

      persist(newStats)
      return { earnedBadges }
    },
    [persist],
  )

  const reset = useCallback(() => {
    persist(emptyStats())
  }, [persist])

  const stats: GameStats = {
    xp: serialized.xp,
    streak: serialized.streak,
    level: serialized.level,
    dailyGoal: serialized.dailyGoal,
    goalProgress: serialized.goalProgress,
    goalTarget: serialized.dailyGoal,
    solved: serialized.solved,
    mistakes: serialized.mistakes,
    consecutiveCorrect: serialized.consecutiveCorrect,
  }

  const badges = computeBadges(serialized)

  return { stats, badges, addXp, reset }
}

export { xpForExercise }
