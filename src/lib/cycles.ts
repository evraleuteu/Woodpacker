import type { CyclesProgress } from './storage'

export const CYCLE_COUNT = 5
export const CYCLE_DURATIONS = [30, 15, 7, 3, 1]

export interface CycleState {
  cycle: number
  total: number
  done: number
  complete: boolean
  unlocked: boolean
}

export function itemsDoneInCycle(progress: CyclesProgress, cycle: number, totalItems: number): number {
  if (totalItems <= 0) return 0
  let n = 0
  for (const id in progress) {
    if ((progress[id] ?? 0) >= cycle) n++
  }
  return Math.min(n, totalItems)
}

export function cycleComplete(progress: CyclesProgress, cycle: number, totalItems: number): boolean {
  return totalItems > 0 && itemsDoneInCycle(progress, cycle, totalItems) >= totalItems
}

export function cycleUnlocked(progress: CyclesProgress, cycle: number, totalItems: number): boolean {
  if (cycle <= 1) return true
  if (totalItems <= 0) return false
  return cycleComplete(progress, cycle - 1, totalItems)
}

export function cycleStates(progress: CyclesProgress, totalItems: number): CycleState[] {
  const states: CycleState[] = []
  for (let cycle = 1; cycle <= CYCLE_COUNT; cycle++) {
    const done = itemsDoneInCycle(progress, cycle, totalItems)
    states.push({
      cycle,
      total: totalItems,
      done,
      complete: cycleComplete(progress, cycle, totalItems),
      unlocked: cycleUnlocked(progress, cycle, totalItems),
    })
  }
  return states
}
