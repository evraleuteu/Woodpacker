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
  BookMarked,
  Braces,
  ArrowUpRight,
} from 'lucide-react'
import { loadCourse } from '@/lib/storage'
import { groupFiles } from '@/lib/grouping'
import { buildPracticePlan, PRACTICE_META, PRACTICE_DIMENSIONS, PRACTICE_COLORS, type PracticeDimension } from '@/lib/plan'
import type { Course, Lesson } from '@/lib/types'

const CYCLE_DURATIONS = [30, 15, 7, 3, 1]

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
  const [course] = useState<Course | null>(() => loadCourse())
  if (!course) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4 ai-glow">
            <Sparkles size={22} className="text-white" />
          </div>
          <h3 className="font-semibold mb-1">No course to cycle through yet</h3>
          <p className="text-sm text-[#A8A29E] mb-4 max-w-md mx-auto">
            Upload your textbook and Woodpecker will build the cycles — speaking with accent evaluation, hearing, listening and reading — the same items, spaced 30 → 15 → 7 → 3 → 1 days until recall is automatic.
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
  const practiceCounts = plan.counts
  const totalItems = plan.items.length
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
        <h1 className="text-3xl font-bold tracking-tight">Woodpecker Cycles</h1>
        <p className="text-[#A8A29E] text-sm mt-1">
          The chess Woodpecker Method applied to your textbook: every practice item — vocabulary, grammar, listening, reading, hearing and speaking — is drilled 5 times, 30, 15, 7, 3, then 1 day, until recall is automatic.
        </p>
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

      <motion.div variants={itemVariants} className="mb-6">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <ListOrdered size={14} className="text-[#10B981]" />
          Study Order — your textbook is the source of truth
        </h2>
        <div className="space-y-3">
          {groupFiles(course.sourceFiles).map((group) => {
              const fileIds = group.files.map((f) => f.id)
              const groupLessons = allLessons.filter((l) => l.sourceAssets.some((id) => fileIds.includes(id)))
              if (!groupLessons.length) return null
              const totalWords = group.files.reduce((n, f) => n + (f.words ?? 0), 0)
              return (
                <div key={group.key} className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-[rgba(250,248,245,0.03)] flex items-center justify-center">
                      <BookOpen size={13} className="text-[#10B981]" />
                    </div>
                    <span className="text-sm font-medium">{group.display}</span>
                    <span className="text-[11px] text-[#6B7280]">
                      ({groupLessons.length} lesson(s), {groupLessons.reduce((n, l) => n + l.exercises.length, 0)} exercises, {totalWords.toLocaleString()} words)
                    </span>
                  </div>
                  {group.files.length > 1 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {group.files.slice(0, 5).map((f) => (
                        <span key={f.id} className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)] text-[#6B7280]">
                          {f.name}
                        </span>
                      ))}
                      {group.files.length > 5 && <span className="text-[10px] text-[#6B7280]">+{group.files.length - 5} more</span>}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {groupLessons.map((lesson) => (
                      <div key={lesson.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[rgba(250,248,245,0.02)]">
                        <span className="w-6 h-6 rounded-md bg-gradient-to-br from-[#059669] to-[#10B981] text-[10px] text-white font-bold flex items-center justify-center shrink-0">
                          {lessonIndex(lesson) + 1}
                        </span>
                        <span className="text-xs font-medium truncate">{lesson.title}</span>
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

      <motion.div variants={itemVariants} className="mb-6">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Crosshair size={14} className="text-[#10B981]" />
          Practice Dimensions — speaking, hearing, listening, reading and more
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PRACTICE_DIMENSIONS.map((dimension) => {
            const meta = PRACTICE_META[dimension]
            const Icon = DIMENSION_ICONS[dimension]
            const count = practiceCounts[dimension]
            return (
              <div key={dimension} className="rounded-xl p-4 border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${PRACTICE_COLORS[dimension]}1A`, color: PRACTICE_COLORS[dimension] }}>
                    <Icon size={14} />
                  </div>
                  <span className="text-sm font-semibold">{meta.label}</span>
                  <span className="ml-auto text-[11px] text-[#6B7280]">{count} items</span>
                </div>
                <div className="flex items-end gap-1 h-8">
                  {CYCLE_DURATIONS.map((days) => (
                    <div key={days} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="text-[10px] font-semibold" style={{ color: PRACTICE_COLORS[dimension] }}>
                        {daily(count, days)}
                      </div>
                      <div className="w-full rounded-sm" style={{ height: `${Math.max(10, Math.min(100, (daily(count, days) / Math.max(1, daily(count, 1))) * 100))}%`, backgroundColor: PRACTICE_COLORS[dimension], opacity: 0.35 }} />
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
                  <Link href="/speaking" className="mt-3 flex items-center gap-1 text-[11px] text-[#10B981] hover:text-white transition-colors">
                    Practice with accent evaluation
                    <ArrowUpRight size={11} />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="mb-6">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <CalendarDays size={14} className="text-[#10B981]" />
          Woodpecker Course — the same {totalItems} practice items, 5 times
        </h2>
        <div className="grid grid-cols-5 gap-3">
          {CYCLE_DURATIONS.map((days, i) => {
            const perDay = daily(totalItems, days)
            const minutes = estimateMinutes(perDay)
            return (
              <div key={days} className={`rounded-xl p-4 border ${i === 0 ? 'border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.05)]' : 'border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gradient">Cycle {i + 1}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]">
                    {i === 0 ? 'Today' : i === 1 ? 'Next' : 'Upcoming'}
                  </span>
                </div>
                <div className="text-2xl font-bold">{days} days</div>
                <div className="text-xs text-[#6B7280] mt-1">{perDay} items/day</div>
                <div className="text-[11px] text-[#6B7280]">~{minutes} min/day</div>
                <div className="flex h-1.5 rounded-full overflow-hidden mt-3 bg-[rgba(250,248,245,0.05)]">
                  {PRACTICE_DIMENSIONS.map((dimension) =>
                    practiceCounts[dimension] > 0 ? (
                      <div key={dimension} style={{ width: `${(practiceCounts[dimension] / Math.max(1, totalItems)) * 100}%`, backgroundColor: PRACTICE_COLORS[dimension] }} />
                    ) : null
                  )}
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">
                  {PRACTICE_DIMENSIONS.filter((dimension) => practiceCounts[dimension] > 0).map((dimension) => (
                    <span key={dimension} className="text-[9px] text-[#6B7280]">
                      {daily(practiceCounts[dimension], days)} {dimension}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="rounded-xl border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.03)] p-6 mb-8">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center">
            <Clock size={12} className="text-white" />
          </div>
          Daily Session — Today (Cycle 1, {CYCLE_DURATIONS[0]} days)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          {PRACTICE_DIMENSIONS.map((dimension) => {
            const count = practiceCounts[dimension]
            const perDay = daily(count, CYCLE_DURATIONS[0])
            return (
              <div key={dimension} className="text-center p-3 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                <div className="text-sm font-bold" style={{ color: PRACTICE_COLORS[dimension] }}>{perDay}</div>
                <div className="text-[11px] text-[#6B7280]">{PRACTICE_META[dimension].label}</div>
                <div className="text-[10px] text-[#6B7280]">~{Math.max(1, Math.round(perDay * PRACTICE_META[dimension].perItemMinutes))} min</div>
              </div>
            )
          })}
          {!totalItems && <div className="text-xs text-[#6B7280] col-span-full py-2">No practice items detected in the uploaded materials yet.</div>}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#A8A29E] mb-4">
          <Clock size={12} className="text-[#10B981]" />
          Estimated time: <span className="text-[#10B981] font-medium">{estimateMinutes(daily(totalItems, CYCLE_DURATIONS[0]))} minutes</span>
          <span>&middot;</span>
          <span>over {CYCLE_DURATIONS[0]} days</span>
        </div>
        {totalItems > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-[#A8A29E] mb-2">First items on the list</div>
            {plan.items.slice(0, 6).map((item) => {
              const Icon = DIMENSION_ICONS[item.dimension]
              return (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[rgba(250,248,245,0.02)]">
                  <Icon size={12} style={{ color: PRACTICE_COLORS[item.dimension] }} />
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${PRACTICE_COLORS[item.dimension]}1A`, color: PRACTICE_COLORS[item.dimension] }}>
                    {PRACTICE_META[item.dimension].label}
                  </span>
                  <span className="text-xs truncate">{item.prompt}</span>
                  <span className="ml-auto text-[10px] text-[#6B7280] shrink-0">{item.lessonTitle}</span>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="rounded-xl border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.03)] p-6">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center">
            <Trophy size={12} className="text-white" />
          </div>
          Pattern Mastery Deck — repeated structures from your materials
        </h3>
        <div className="space-y-2">
          {allLessons
            .flatMap((l) => l.grammar)
            .slice(0, 8)
            .map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[rgba(250,248,245,0.02)]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">{rule.name}</span>
                  <span className="text-xs text-[#6B7280] shrink-0">({rule.examples[0] ? rule.examples[0].slice(0, 40) : 'pattern'})</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(107,114,128,0.1)] text-[#6B7280] border-[rgba(107,114,128,0.2)] border shrink-0">
                  {rule.difficulty}
                </span>
              </div>
            ))}
          {grammarTopics === 0 && <div className="text-xs text-[#6B7280] py-2">No grammar patterns detected yet.</div>}
        </div>
      </motion.div>
    </motion.div>
  )
}