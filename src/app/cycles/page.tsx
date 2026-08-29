'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Mic,
  Headphones,
  MessageSquare,
  Crosshair,
  Volume2,
  Trophy,
  Sparkles,
  Upload,
  BookOpen,
  CalendarDays,
  Clock,
  ListOrdered,
  LayoutDashboard,
  BookMarked,
  Braces,
  ArrowUpRight,
  Lock,
  CheckCircle2,
  Play,
} from 'lucide-react'
import { useCourse } from '@/lib/useCourse'
import { loadCyclesProgress, type CyclesProgress } from '@/lib/storage'
import { groupFiles } from '@/lib/grouping'
import { buildPracticePlan, PRACTICE_META, PRACTICE_DIMENSIONS, PRACTICE_COLORS, type PracticeDimension } from '@/lib/plan'
import { cycleStates, CYCLE_DURATIONS } from '@/lib/cycles'
import type { Lesson } from '@/lib/types'

const cycleProgression = [
  { cycle: 1, duration: '30 Days', support: 'Full support — audio, transcript, hints', icon: Volume2 },
  { cycle: 2, duration: '15 Days', support: 'Audio + keywords only', icon: Headphones },
  { cycle: 3, duration: '7 Days', support: 'Audio only, no transcript', icon: Mic },
  { cycle: 4, duration: '3 Days', support: 'Question only, no audio', icon: MessageSquare },
  { cycle: 5, duration: '1 Day', support: 'Full spontaneous, no hints', icon: Crosshair },
]

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

export default function CyclesPage() {
  const course = useCourse()
  const [progress] = useState<CyclesProgress>(() => loadCyclesProgress())
  const [tab, setTab] = useState<'overview' | 'practice'>('practice')
  if (!course) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
        <motion.div variants={itemVariants} className="rounded-[20px] border border-dashed border-[#D1D5DB] bg-white p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-4">
                    <Sparkles size={22} className="text-[#1F7A4C]" />
          </div>
                  <h3 className="font-semibold mb-1 text-[#111827]">No course to cycle through yet</h3>
                  <p className="text-sm text-[#6B7280] mb-4 max-w-md mx-auto">
            Upload your textbook and Woodpecker will build the cycles — speaking with accent evaluation, hearing, listening and reading — the same items, spaced 30 → 15 → 7 → 3 → 1 days until recall is automatic.
          </p>
                  <Link href="/upload" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold hover:bg-[#16643D]">
            <Upload size={14} />
            Upload materials
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  const allLessons = course.modules.flatMap((m) => m.lessons)
  const plan = buildPracticePlan(course)
  const practiceCounts = plan.counts
  const totalItems = plan.items.length
  const cycleStatesList = cycleStates(progress, totalItems)
  const audioFiles = course.sourceFiles.filter((f) => f.kind === 'audio' || f.kind === 'video').length
  const grammarTopics = new Set(allLessons.flatMap((l) => l.grammar.map((g) => g.name))).size

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

  const daily = (count: number, days: number) => Math.ceil(count / days)
  const estimateMinutes = (count: number) => Math.max(5, Math.ceil((count * 2.5) / 5) * 5)

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="text-[28px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>Woodpecker Cycles</h1>
        <p className="text-[#6B7280] text-sm mt-1 max-w-4xl leading-relaxed">
          The chess Woodpecker Method applied to your textbook: every practice item — vocabulary, grammar, listening, reading, hearing and speaking — is drilled 5 times, 30, 15, 7, 3, then 1 day, until recall is automatic.
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="flex items-center gap-1 mb-6 w-fit rounded-xl p-1 bg-white border border-[#E5E7EB]">
        <button
          onClick={() => setTab('practice')}
          className={`flex items-center gap-2 text-xs px-4 py-2 rounded-lg font-medium transition-all cursor-pointer ${
            tab === 'practice'
                    ? 'bg-[#1F7A4C] text-white'
                    : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <Crosshair size={13} />
          Practice Dimensions
        </button>
        <button
          onClick={() => setTab('overview')}
          className={`flex items-center gap-2 text-xs px-4 py-2 rounded-lg font-medium transition-all cursor-pointer ${
            tab === 'overview'
                    ? 'bg-[#1F7A4C] text-white'
                    : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <LayoutDashboard size={13} />
          Overview
        </button>
      </motion.div>

      {tab === 'practice' && (
        <>
        <motion.div variants={itemVariants} className="mb-6">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <CalendarDays size={14} className="text-[#10B981]" />
          Cycle Progression — complete each cycle to unlock the next
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {cycleStatesList.map((state, i) => {
            const days = CYCLE_DURATIONS[i]
            const perDay = daily(totalItems, days)
            const minutes = estimateMinutes(perDay)
            const isFirstActive = state.unlocked && !state.complete && !cycleStatesList.slice(0, i).some((s) => s.unlocked && !s.complete)
            const isCurrent = isFirstActive
            return (
              <div
                key={state.cycle}
                className={`rounded-[28px] p-5 border transition-all duration-200 ${
                  state.complete
                    ? 'border-[#BBF7D0] bg-[#F0FDF4] hover:bg-[#DCFCE7]'
                    : state.unlocked
                      ? isCurrent
                        ? 'border-[#9FC5A5] bg-[#DDEEE0] shadow-soft'
                        : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#FAFBFC]'
                      : 'border-[#E5E7EB] bg-[#F9FAFB] opacity-70'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`font-bold ${isCurrent ? 'text-[clamp(1.6rem,2vw,2.4rem)] text-[#111827]' : 'text-lg text-[#111827]'}`}>
                    Cycle {state.cycle}
                  </span>
                  {state.complete ? (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-[#1F7A4C] text-white border border-[#16643D]">
                      <CheckCircle2 size={10} />
                      Complete
                    </span>
                  ) : state.unlocked ? (
                    <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${isCurrent ? 'bg-[#F7E7B7] text-[#8B5E00] border border-[#F2CF70]' : 'bg-[#F0FDF4] text-[#1F7A4C] border border-[#BBF7D0]'}`}>
                      {isCurrent ? 'Current' : 'Ready'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-white text-[#6B7280] border border-[#E5E7EB]">
                      <Lock size={9} />
                      Locked
                    </span>
                  )}
                </div>
                <div className={`${isCurrent ? 'text-[clamp(2.1rem,4vw,4rem)]' : 'text-3xl'} font-extrabold tracking-[-0.05em] text-[#111827] leading-none`}>{days} days</div>
                <div className="text-sm text-[#6B7280] mt-2">{perDay} items/day</div>
                <div className="text-xs text-[#6B7280] mt-1">~{minutes} min/day</div>
                <div className="flex h-2 rounded-full overflow-hidden mt-4 bg-[#E5E7EB]">
                  {PRACTICE_DIMENSIONS.map((dimension) =>
                    practiceCounts[dimension] > 0 ? (
                      <div key={dimension} style={{ width: `${(practiceCounts[dimension] / Math.max(1, totalItems)) * 100}%`, backgroundColor: PRACTICE_COLORS[dimension] }} />
                    ) : null
                  )}
                </div>
                {state.unlocked && (
                  <div className="flex items-center gap-2 mt-4">
                    <div className="flex-1 h-2 rounded-full bg-white/70 overflow-hidden">
                      <div className="h-full rounded-full bg-[#1F7A4C]" style={{ width: `${totalItems ? (state.done / totalItems) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-[#6B7280] shrink-0">
                      {state.done}/{totalItems}
                    </span>
                  </div>
                )}
                <Link
                  href={`/cycles/${state.cycle}`}
                  aria-disabled={!state.unlocked}
                  className={`mt-4 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[16px] text-sm font-semibold transition-all ${
                    state.unlocked
                      ? 'bg-[#1F7A4C] text-white hover:bg-[#16643D] shadow-sm'
                      : 'bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed'
                  }`}
                  onClick={(e) => {
                    if (!state.unlocked) e.preventDefault()
                  }}
                >
                  {state.complete ? (
                    <>
                      Review
                      <Play size={11} />
                    </>
                  ) : state.unlocked ? (
                    <>
                      Practice
                      <Play size={11} />
                    </>
                  ) : (
                    <>
                      <Lock size={11} />
                      Locked
                    </>
                  )}
                </Link>
              </div>
            )
          })}
        </div>
        {totalItems === 0 && (
          <div className="text-xs text-[#6B7280] mt-2">No practice items detected yet — upload materials with exercises, transcripts or reading passages.</div>
        )}
      </motion.div>

        <motion.div variants={itemVariants} className="mb-6">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Crosshair size={14} className="text-[#10B981]" />
          Practice Dimensions — speaking, hearing, listening, reading and more
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PRACTICE_DIMENSIONS.map((dimension) => {
            const meta = PRACTICE_META[dimension]
            const Icon = DIMENSION_ICONS[dimension]
            const count = practiceCounts[dimension]
            return (
              <div key={dimension} className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border" style={{ backgroundColor: `${PRACTICE_COLORS[dimension]}14`, color: PRACTICE_COLORS[dimension], borderColor: `${PRACTICE_COLORS[dimension]}33` }}>
                    <Icon size={15} />
                  </div>
                  <span className="text-sm font-semibold text-[#111827]">{meta.label}</span>
                  <span className="ml-auto text-[11px] text-[#6B7280]">{count} items</span>
                </div>
                <div className="flex items-end gap-1 h-10">
                  {CYCLE_DURATIONS.map((days) => (
                    <div key={days} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="text-[10px] font-semibold" style={{ color: PRACTICE_COLORS[dimension] }}>
                        {daily(count, days)}
                      </div>
                      <div className="w-full rounded-sm" style={{ height: `${Math.max(12, Math.min(100, (daily(count, days) / Math.max(1, daily(count, 1))) * 100))}%`, backgroundColor: PRACTICE_COLORS[dimension], opacity: 0.4 }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-[#6B7280] mt-1">
                  <span>30d</span>
                  <span>15d</span>
                  <span>7d</span>
                  <span>3d</span>
                  <span>1d</span>
                </div>
                {dimension === 'speaking' && (
                  <Link href="/speaking" className="mt-3 flex items-center gap-1 text-[11px] text-[#1F7A4C] hover:text-[#16643D] transition-colors font-medium">
                    Practice with accent evaluation
                    <ArrowUpRight size={11} />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>
        </>
      )}

      {tab === 'overview' && (
        <>
          <motion.div variants={itemVariants} className="mb-6">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2 text-[#111827]">
              <ListOrdered size={14} className="text-[#1F7A4C]" />
              Study Order — your textbook is the source of truth
            </h2>
            <div className="space-y-3">
              {groupFiles(course.sourceFiles).map((group) => {
                const fileIds = group.files.map((f) => f.id)
                const groupLessons = allLessons.filter((l) => l.sourceAssets.some((id) => fileIds.includes(id)))
                if (!groupLessons.length) return null
                const totalWords = group.files.reduce((n, f) => n + (f.words ?? 0), 0)
                return (
                  <div key={group.key} className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center">
                        <BookOpen size={13} className="text-[#1F7A4C]" />
                      </div>
                      <span className="text-sm font-medium text-[#111827]">{group.display}</span>
                      <span className="text-[11px] text-[#6B7280]">
                        ({groupLessons.length} lesson(s), {groupLessons.reduce((n, l) => n + l.exercises.length, 0)} exercises, {totalWords.toLocaleString()} words)
                      </span>
                    </div>
                    {group.files.length > 1 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {group.files.slice(0, 5).map((f) => (
                          <span key={f.id} className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAFBFC] border border-[#E5E7EB] text-[#6B7280]">
                            {f.name}
                          </span>
                        ))}
                        {group.files.length > 5 && <span className="text-[10px] text-[#6B7280]">+{group.files.length - 5} more</span>}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {groupLessons.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#FAFBFC] border border-[#E5E7EB]">
                          <span className="w-6 h-6 rounded-md bg-[#1F7A4C] text-[10px] text-white font-bold flex items-center justify-center shrink-0">
                            {lessonIndex(lesson) + 1}
                          </span>
                          <span className="text-xs font-medium truncate text-[#111827]">{lesson.title}</span>
                          <span className="ml-auto flex items-center gap-2 text-[10px] text-[#6B7280] shrink-0">
                            <span>{lesson.vocabulary.length} vocab</span>
                            <span>&middot;</span>
                            <span>{lesson.grammar.length} grammar</span>
                            <span>&middot;</span>
                            <span>{lesson.exercises.length} exercises</span>
                            <span>&middot;</span>
                            <span>{lesson.difficulty}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="rounded-[20px] border border-[#E5E7EB] bg-white p-6 mb-8 shadow-sm">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2 text-[#111827]">
          <div className="w-6 h-6 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center">
            <Clock size={12} className="text-[#1F7A4C]" />
          </div>
          Daily Session — Today (Cycle 1, {CYCLE_DURATIONS[0]} days)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          {PRACTICE_DIMENSIONS.map((dimension) => {
            const count = practiceCounts[dimension]
            const perDay = daily(count, CYCLE_DURATIONS[0])
            return (
              <div key={dimension} className="text-center p-3 rounded-xl bg-[#FAFBFC] border border-[#E5E7EB]">
                <div className="text-sm font-bold" style={{ color: PRACTICE_COLORS[dimension] }}>{perDay}</div>
                <div className="text-[11px] text-[#6B7280]">{PRACTICE_META[dimension].label}</div>
                <div className="text-[10px] text-[#6B7280]">~{Math.max(1, Math.round(perDay * PRACTICE_META[dimension].perItemMinutes))} min</div>
              </div>
            )
          })}
          {!totalItems && <div className="text-xs text-[#6B7280] col-span-full py-2">No practice items detected in the uploaded materials yet.</div>}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-4">
          <Clock size={12} className="text-[#1F7A4C]" />
          Estimated time: <span className="text-[#1F7A4C] font-medium">{estimateMinutes(daily(totalItems, CYCLE_DURATIONS[0]))} minutes</span>
          <span>&middot;</span>
          <span>over {CYCLE_DURATIONS[0]} days</span>
        </div>
        {totalItems > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-[#6B7280] mb-2">First items on the list</div>
            {plan.items.slice(0, 6).map((item) => {
              const Icon = DIMENSION_ICONS[item.dimension]
              return (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#FAFBFC] border border-[#E5E7EB]">
                  <Icon size={12} style={{ color: PRACTICE_COLORS[item.dimension] }} />
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${PRACTICE_COLORS[item.dimension]}1A`, color: PRACTICE_COLORS[item.dimension] }}>
                    {PRACTICE_META[item.dimension].label}
                  </span>
                  <span className="text-xs truncate text-[#111827]">{item.prompt}</span>
                  <span className="ml-auto text-[10px] text-[#6B7280] shrink-0">{item.lessonTitle}</span>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="rounded-[20px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2 text-[#111827]">
          <div className="w-6 h-6 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center">
            <Trophy size={12} className="text-[#1F7A4C]" />
          </div>
          Pattern Mastery Deck — repeated structures from your materials
        </h3>
        <div className="space-y-2">
          {allLessons
            .flatMap((l) => l.grammar)
            .slice(0, 8)
            .map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFBFC] border border-[#E5E7EB]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate text-[#111827]">{rule.name}</span>
                  <span className="text-xs text-[#6B7280] shrink-0">({rule.examples[0] ? rule.examples[0].slice(0, 40) : 'pattern'})</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB] shrink-0">
                  {rule.difficulty}
                </span>
              </div>
            ))}
          {grammarTopics === 0 && <div className="text-xs text-[#6B7280] py-2">No grammar patterns detected yet.</div>}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="font-semibold text-sm mr-1">{course.title}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]">
            {allLessons.length} Lessons Found
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]">
            {totalItems} Practice Items
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]">
            {grammarTopics} Grammar Topics
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]">
            {audioFiles + practiceCounts.listening} Listening &amp; Audio Items
          </span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {cycleProgression.map((c) => (
            <div key={c.cycle} className="text-center p-4 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-3">
                <c.icon size={16} className="text-white" />
              </div>
              <div className="text-sm font-bold text-gradient">Cycle {c.cycle}</div>
              <div className="text-xs text-[#A8A29E] mb-1">{c.duration}</div>
              <div className="text-[10px] text-[#6B7280] leading-tight">{c.support}</div>
            </div>
          ))}
        </div>
      </motion.div>
        </>
      )}
    </motion.div>
  )
}