'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Mic,
  Headphones,
  Volume2,
  Lock,
  CheckCircle2,
  Play,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Upload,
  Trophy,
  BookMarked,
  Braces,
  BookOpen,
} from 'lucide-react'
import { loadCyclesProgress, saveCyclesProgress, type CyclesProgress } from '@/lib/storage'
import { useCourse } from '@/lib/useCourse'
import { buildPracticePlan, PRACTICE_COLORS, type PracticeDimension, type PracticeItem } from '@/lib/plan'
import { normalizeAnswer } from '@/lib/exercise-helpers'
import { practiceItemToPremium } from '@/lib/cycle-helpers'
import { CYCLE_COUNT, CYCLE_DURATIONS, cycleStates, cycleComplete } from '@/lib/cycles'
import { FlashcardDeck } from '@/components/exercises/FlashcardDeck'
import type { Lesson } from '@/lib/types'

const CYCLE_SUPPORT = [
  { days: 30, label: 'Full support — audio, transcript, hints' },
  { days: 15, label: 'Audio + keywords only' },
  { days: 7, label: 'Audio only, no transcript' },
  { days: 3, label: 'Question only, no audio' },
  { days: 1, label: 'Full spontaneous, no hints' },
]

function findLesson(course: ReturnType<typeof useCourse>, lessonTitle: string) {
  if (!course) return undefined
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (lesson.title === lessonTitle) return lesson
    }
  }
  return undefined
}

const DIMENSION_ICONS: Record<PracticeDimension, typeof BookMarked> = {
  vocabulary: BookMarked,
  grammar: Braces,
  listening: Headphones,
  reading: BookOpen,
  hearing: Volume2,
  speaking: Mic,
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function CyclePracticePage() {
  const rawCycle = Number(useParams<{ cycle: string }>().cycle)
  const cycle = Number.isFinite(rawCycle) ? Math.min(CYCLE_COUNT, Math.max(1, Math.round(rawCycle))) : 1

  const course = useCourse()
  const [progress, setProgress] = useState<CyclesProgress>(() => loadCyclesProgress())
  const [index, setIndex] = useState(0)
  const [reviewMode, setReviewMode] = useState(false)
  const [queue, setQueue] = useState<string[]>(() => {
    if (!course) return []
    const plan = buildPracticePlan(course)
    const prog = loadCyclesProgress()
    return plan.items.filter((i) => (prog[i.id] ?? 0) < cycle).map((i) => i.id)
  })

  if (!course) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-2xl mx-auto">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4 ai-glow">
            <Sparkles size={22} className="text-white" />
          </div>
          <h3 className="font-semibold mb-1 text-[var(--color-foreground)]">No course yet</h3>
          <p className="text-sm text-[var(--color-foreground-secondary)] mb-4 max-w-md mx-auto">
            Upload materials first and Woodpecker will build your five-cycle practice program.
          </p>
          <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Upload size={14} />
            Upload materials
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  const allLessons = course.modules.flatMap((m) => m.lessons)
  const plan = buildPracticePlan(course)
  const totalItems = plan.items.length
  const support = CYCLE_SUPPORT[cycle - 1]
  const doneInCycle = cycleStates(progress, totalItems)[cycle - 1].done
  const complete = cycleComplete(progress, cycle, totalItems)
  const unlocked = cycle <= 1 || cycleComplete(progress, cycle - 1, totalItems)
  const nextCycleUnlocked = cycle < CYCLE_COUNT && cycleComplete(progress, cycle, totalItems)

  const lessonIndex = (lesson: Lesson) => {
    let n = 0
    for (const mod of course.modules) {
      for (const l of mod.lessons) {
        if (l.id === lesson.id) return n
        n++
}
}
    return n
  }

  if (!unlocked) {
    const prev = cycle - 1
    const prevDone = cycleStates(progress, totalItems)[prev - 1].done
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-[1600px] mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-background-secondary)] border border-[var(--color-border)] flex items-center justify-center mx-auto mb-4">
            <Lock size={22} className="text-[var(--color-foreground-secondary)]" />
          </div>
          <h3 className="font-semibold mb-1 text-[var(--color-foreground)]">Cycle {cycle} is locked</h3>
          <p className="text-sm text-[var(--color-foreground-secondary)] mb-4 max-w-md mx-auto">
            Complete every item of Cycle {prev} first — {prevDone}/{totalItems} items done — to unlock it.
          </p>
          <div className="flex items-center justify-center gap-2 max-w-xs mx-auto mb-6">
            <div className="flex-1 progress-bar h-1.5">
              <div className="progress-bar-fill" style={{ width: `${totalItems ? (prevDone / totalItems) * 100 : 0}%` }} />
            </div>
            <span className="text-xs text-[var(--color-foreground-secondary)]">{Math.round((prevDone / Math.max(1, totalItems)) * 100)}%</span>
          </div>
          <Link href={`/cycles/${prev}`} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Play size={14} />
            Go to Cycle {prev}
          </Link>
          <Link href="/cycles" className="block text-xs text-[var(--color-foreground-secondary)] hover:text-[var(--color-foreground)] transition-colors mt-4">
            Back to overview
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  if (totalItems === 0) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-[1600px] mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <h3 className="font-semibold mb-1 text-[var(--color-foreground)]">No practice items found</h3>
          <p className="text-sm text-[var(--color-foreground-secondary)] mb-4 max-w-md mx-auto">
            Upload materials with exercises, transcripts or reading passages — they become your practice items.
          </p>
          <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Upload size={14} />
            Upload materials
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  const markDone = (id: string) => {
    const next = { ...progress, [id]: Math.max(cycle, progress[id] ?? 0) }
    setProgress(next)
    saveCyclesProgress(next)
  }

  const itemById = new Map(plan.items.map((i) => [i.id, i]))

  const isOpenEnded = (item: PracticeItem): boolean => {
    if (!item.exercise) return true
    if (!item.exercise.answer) return true
    return normalizeAnswer(item.exercise.answer) === normalizeAnswer(item.exercise.prompt)
  }

  const validated = (item: PracticeItem, correct: boolean): boolean => correct || isOpenEnded(item)

  const handleNext = (itemId: string, correct: boolean) => {
    const item = itemById.get(itemId)
    const ok = item ? validated(item, correct) : false
    if (ok) {
      markDone(itemId)
    }
    setQueue((prev) => {
      const rest = prev.filter((id) => id !== itemId)
      return ok ? rest : [...rest, itemId]
    })
    setIndex((i) => Math.max(0, Math.min(i, queue.length - (ok ? 2 : 1))))
  }

  const doneIds = new Set(plan.items.filter((i) => (progress[i.id] ?? 0) >= cycle).map((i) => i.id))
  const pending = plan.items.filter((i) => !doneIds.has(i.id))
  const sessionItems = queue.map((id) => itemById.get(id)).filter((x): x is PracticeItem => !!x)
  const current = sessionItems[Math.min(index, sessionItems.length - 1)] ?? null

  if (complete && pending.length === 0 && !reviewMode) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-[1600px] mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-5 ai-glow">
            <Trophy size={26} className="text-white" />
          </div>
          <h3 className="text-2xl font-bold mb-2 text-[var(--color-foreground)]">Cycle {cycle} complete!</h3>
          <p className="text-sm text-[var(--color-foreground-secondary)] mb-6 max-w-md mx-auto">
            You finished all {totalItems} items of Cycle {cycle}.{' '}
            {cycle < CYCLE_COUNT
              ? `Cycle ${cycle + 1} is now unlocked — ${CYCLE_SUPPORT[cycle].label}.`
              : 'You mastered the full Woodpecker course — automatic recall is yours.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setReviewMode(true)
                setQueue(plan.items.map((i) => i.id))
                setIndex(0)
              }}
              className="btn-secondary inline-flex items-center gap-2 text-sm"
            >
              <RotateCcw size={14} />
              Review again
            </button>
            {cycle < CYCLE_COUNT ? (
              <Link href={`/cycles/${cycle + 1}`} className="btn-primary inline-flex items-center gap-2 text-sm">
                Start Cycle {cycle + 1}
                <ArrowRight size={14} />
              </Link>
            ) : (
              <Link href="/cycles" className="btn-primary inline-flex items-center gap-2 text-sm">
                Back to overview
              </Link>
            )}
          </div>
        </motion.div>
      </motion.div>
    )
  }

  const progressPct = totalItems ? (doneInCycle / totalItems) * 100 : 0

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="mx-auto w-full max-w-[1200px] px-3 py-3 sm:px-4 lg:px-6">
      <motion.div variants={itemVariants} className="mb-4">
        <div className="mb-1 flex flex-wrap items-center gap-2 sm:gap-3">
          <Link href="/cycles" className="flex items-center gap-1 text-[11px] text-[var(--color-foreground-secondary)] transition-colors hover:text-[var(--color-foreground)]">
            <ArrowLeft size={12} />
            Cycles
          </Link>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--color-foreground)] sm:text-[32px]">Cycle {cycle} — {CYCLE_DURATIONS[cycle - 1]} days</h1>
          <span className="rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] text-[var(--color-primary)]">
            {support.label}
          </span>
        </div>
        <div className="mt-2 flex max-w-xl items-center gap-3">
          <div className="progress-bar h-2 flex-1">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[11px] text-[var(--color-foreground-secondary)]">
            {doneInCycle}/{totalItems} done
          </span>
        </div>
        <div className="mt-2 text-[11px] text-[var(--color-foreground-secondary)]">
          Failed or skipped items come back at the end — every item must be answered correctly before Cycle {cycle} completes.
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="mb-4">
        {current ? (
          <div key={current.id}>
            <FlashcardDeck
              key={current.id}
              exercises={sessionItems.map((item) => {
                const enriched = practiceItemToPremium(item, course?.language)
                const lesson = findLesson(course, item.lessonTitle)
                const materials = lesson?.materials
                if (enriched.practice === 'reading' && materials?.reading?.passage) {
                  enriched.sourceText = materials.reading.passage
                } else if (enriched.practice === 'listening' && materials?.listening?.transcript) {
                  enriched.sourceText = materials.listening.transcript
                }
                return enriched
              })}
              initialIndex={sessionItems.findIndex((i) => i.id === current.id)}
              onResult={(result) => {
                handleNext(current.id, result.correct)
              }}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-6 text-center">
            <div className="text-sm text-[var(--color-foreground-secondary)] mb-3">You&apos;ve completed every item of this cycle.</div>
            <Link href="/cycles" className="btn-primary inline-flex items-center gap-2 text-sm">
              Back to overview
            </Link>
          </div>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">All items — {totalItems}</h2>
          <span className="text-[10px] text-[var(--color-foreground-secondary)]">
            {reviewMode ? `${doneInCycle}/${totalItems} done` : `${pending.length} remaining in this cycle`}
          </span>
        </div>
        <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
          {plan.items.map((item) => {
            const done = doneIds.has(item.id)
            const ItemIcon = DIMENSION_ICONS[item.dimension]
            return (
              <button
                key={item.id}
                onClick={() => {
                  const qi = queue.indexOf(item.id)
                  if (qi >= 0) setIndex(qi)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${done ? 'cursor-default' : 'hover:bg-[var(--color-background)]'}`}
              >
                {done ? (
                  <CheckCircle2 size={14} className="text-[#10B981] shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-[var(--color-border)] shrink-0" />
                )}
                <ItemIcon size={12} style={{ color: PRACTICE_COLORS[item.dimension] }} className="shrink-0" />
                <span className={`text-xs truncate ${done ? 'text-[var(--color-foreground-secondary)] line-through' : 'text-[var(--color-foreground)]'}}`}>{item.prompt}</span>
                <span className="ml-auto text-[10px] text-[var(--color-foreground-secondary)] shrink-0">
                  {item.lessonTitle} · L{lessonIndex(course.modules.flatMap((m) => m.lessons).find((l) => l.id === item.lessonId) ?? allLessons[0]) + 1}
                </span>
              </button>
            )
          })}
        </div>
      </motion.div>

      {cycle < CYCLE_COUNT && (
        <motion.div variants={itemVariants} className="flex items-center justify-between mt-6 p-4 rounded-xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20">
          <div className="text-xs text-[var(--color-foreground-secondary)]">
            {nextCycleUnlocked ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-[var(--color-primary)]" />
                Cycle {cycle + 1} is unlocked — {CYCLE_SUPPORT[cycle].label}.
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock size={14} className="text-[var(--color-foreground-secondary)]" />
                Cycle {cycle + 1} unlocks when every item of Cycle {cycle} is done ({doneInCycle}/{totalItems}).
              </span>
            )}
          </div>
          {nextCycleUnlocked && (
            <Link href={`/cycles/${cycle + 1}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#059669] to-[#10B981] text-white text-xs font-medium">
              Start Cycle {cycle + 1}
              <ArrowRight size={11} />
            </Link>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}