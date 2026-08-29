'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Upload,
  BookOpen,
  Mic,
  BarChart3,
  Flame,
  Play,
  RefreshCw,
  Library,
  Target,
  Clock,
  Sparkles,
  ArrowRight,
  Check,
  Calendar,
  Headphones,
  PenLine,
  Award,
  TrendingUp,
  Activity,
  Users,
  BookMarked,
  Hourglass,
} from 'lucide-react'
import { useCourse } from '@/lib/useCourse'
import { useGameStats } from '@/lib/useGameStats'
import {
  buildPracticePlan,
  PRACTICE_META,
  PRACTICE_COLORS,
  PRACTICE_DIMENSIONS,
  type PracticeDimension,
} from '@/lib/plan'

const DIM_ICONS: Record<PracticeDimension, typeof BookOpen> = {
  vocabulary: BookMarked,
  grammar: PenLine,
  listening: Headphones,
  reading: BookOpen,
  hearing: Mic,
  speaking: Mic,
}

export default function DashboardPage() {
  const course = useCourse()
  const { stats: gameStats } = useGameStats()
  const plan = useMemo(() => (course ? buildPracticePlan(course) : null), [course])

  if (!course || !plan) {
    return (
      <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
        {/* Empty state */}
        <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-10 md:p-14 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-5">
            <Sparkles size={26} className="text-[#1F7A4C]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
            Welcome to Woodpacker
          </h1>
          <p className="text-sm leading-relaxed text-[#6B7280] mt-2 max-w-lg mx-auto">
            Upload your textbook, workbook, audio or notes — Woodpacker reconstructs them into a learning system: lessons, vocabulary, grammar,
            exercises and adaptive practice cycles. Your command center will appear here.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold hover:bg-[#16643D] shadow-sm transition-colors"
            >
              <Upload size={16} /> Upload your first materials
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]"
            >
              Take the onboarding tour <ArrowRight size={14} />
            </Link>
          </div>

          {/* Empty preview grid */}
          <div className="grid md:grid-cols-3 gap-4 mt-10 text-left">
            {[
              { title: 'Today\u2019s Goal', desc: 'Daily missions appear here once you upload materials', icon: Target },
              { title: 'Mastery Score', desc: 'Your overall fluency score tracks speaking, listening & vocabulary', icon: Award },
              { title: 'Upcoming Reviews', desc: 'Adaptive schedule keeps everything you learn alive', icon: Calendar },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-dashed border-[#D1D5DB] bg-[#FAFBFC] p-5">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center mb-3">
                  <c.icon size={16} className="text-[#9CA3AF]" />
                </div>
                <div className="text-sm font-semibold text-[#6B7280]">{c.title}</div>
                <div className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const firstLesson = course.modules[0]?.lessons[0]
  const decks = PRACTICE_DIMENSIONS.map((dimension) => ({
    dimension,
    icon: DIM_ICONS[dimension],
    items: (plan?.items ?? []).filter((i) => i.dimension === dimension),
  }))
  const totalItems = plan?.items.length ?? 0
  const maxItems = Math.max(1, ...decks.map((d) => d.items.length))
  const totalMinutes = decks.reduce((n, d) => n + Math.ceil(d.items.length * PRACTICE_META[d.dimension].perItemMinutes), 0)
  const biggest = [...decks].sort((a, b) => b.items.length - a.items.length)[0]
  const recentLessons = course.modules.flatMap((m) => m.lessons.map((l) => ({ lesson: l, module: m }))).slice(0, 4) ?? []
  const perModule = course.modules.map((m) => ({ title: m.title, lessons: m.lessons.length })) ?? []

  const missionItems = decks
    .flatMap((d) => d.items.slice(0, 1).map((item) => ({ label: `${PRACTICE_META[d.dimension].label}: ${item.prompt.slice(0, 64)}`, done: false })))
    .slice(0, 4)
  const goalPct = gameStats.goalTarget > 0 ? Math.min(100, Math.round((gameStats.goalProgress / gameStats.goalTarget) * 100)) : 0
  const masteryScore = Math.min(100, Math.round((totalItems / Math.max(1, totalItems + 20)) * 78 + 12 + Math.min(10, gameStats.xp / 20)))

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="text-[28px] font-bold tracking-tight text-[#111827] truncate"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {course.title}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-xs font-semibold text-[#1F7A4C]">
              <Check size={12} /> Course ready
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#E5E7EB] text-xs font-medium text-[#6B7280]">
              <Users size={12} /> {course.stats.lessons} lessons
            </span>
          </div>
          <p className="text-sm text-[#6B7280] mt-1 max-w-2xl leading-relaxed truncate">{course.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold hover:bg-[#16643D] shadow-sm transition-colors"
          >
            <Upload size={14} /> Add Materials
          </Link>
        </div>
      </div>

      {/* Command Center grid – Today's Goal, Streak, Mastery Score */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        {/* Today's Goal */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-12 lg:col-span-5 rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center">
                <Target size={14} className="text-[#1F7A4C]" />
              </span>
              Today&apos;s Goal
            </h2>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C]"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {goalPct}%
            </span>
          </div>

          <div className="h-2.5 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] overflow-hidden p-0.5 mb-4">
            <div className="h-full rounded-full bg-[#1F7A4C] transition-all" style={{ width: `${goalPct}%` }} />
          </div>

          <div className="space-y-2.5">
            {missionItems.length ? (
              missionItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FAFBFC] border border-[#F3F4F6]">
                  <span className="w-5 h-5 rounded-full border-2 border-[#D1D5DB] bg-white shrink-0" />
                  <span className="text-sm text-[#111827] truncate leading-snug">{item.label}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-[#6B7280] py-2">No missions yet — upload materials to generate your daily plan.</div>
            )}
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#F3F4F6] text-xs text-[#6B7280]">
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="text-[#1F7A4C]" /> ~{totalMinutes} min today
            </span>
            <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
            <span className="flex items-center gap-1">
              <Flame size={12} className="text-[#F4B942]" /> {gameStats.streak} day streak
            </span>
            <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
            <span style={{ fontFamily: 'var(--font-space-grotesk)' }} className="font-semibold text-[#1F7A4C]">
              {gameStats.xp} XP
            </span>
          </div>
        </motion.div>

        {/* Current Streak + Mastery Score */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="col-span-12 md:col-span-6 lg:col-span-3 rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm flex flex-col"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-center">
              <Flame size={14} className="text-[#D97706]" />
            </span>
            <h2 className="text-sm font-bold text-[#111827]">Current Streak</h2>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <div
              className="text-4xl font-extrabold tracking-tight text-[#111827] flex items-center gap-2"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {gameStats.streak}
              <span className="text-2xl">🔥</span>
            </div>
            <div className="text-sm font-medium text-[#6B7280] mt-1">{gameStats.streak === 1 ? 'day' : 'days'} — keep it up</div>
            <div className="mt-4 w-full rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-3 flex items-center gap-2">
              <Hourglass size={14} className="text-[#D97706] shrink-0" />
              <div className="text-xs leading-snug text-[#92400E]">
                <span className="font-semibold">Next streak:</span> Complete today&apos;s goal before midnight
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-center text-[#6B7280] flex items-center justify-center gap-1">
            <TrendingUp size={12} /> {gameStats.level} · Level {gameStats.level}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="col-span-12 md:col-span-6 lg:col-span-4 rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#1F7A4C] flex items-center justify-center">
                <Award size={14} className="text-white" />
              </span>
              Mastery Score
            </h2>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C]">Live</span>
          </div>

          <div className="flex items-center gap-5">
            {/* Circular progress */}
            <div className="relative w-24 h-24 shrink-0">
              <svg className="w-24 h-24 -rotate-90">
                <circle cx="48" cy="48" r="42" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  fill="none"
                  stroke="#1F7A4C"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(masteryScore / 100) * 264} 264`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {masteryScore}
                </span>
                <span className="text-[10px] font-semibold tracking-wide uppercase text-[#6B7280]">/ 100</span>
              </div>
            </div>

            <div className="flex-1 space-y-2.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#6B7280]">Vocabulary</span>
                  <span className="font-semibold text-[#111827]">82%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                  <div className="h-full bg-[#1F7A4C] rounded-full" style={{ width: '82%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#6B7280]">Speaking</span>
                  <span className="font-semibold text-[#111827]">64%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                  <div className="h-full bg-[#2FBF71] rounded-full" style={{ width: '64%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#6B7280]">Retention</span>
                  <span className="font-semibold text-[#111827]">91%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                  <div className="h-full bg-[#F4B942] rounded-full" style={{ width: '91%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-[#FAFBFC] border border-[#E5E7EB] p-3 flex items-center justify-between">
            <span className="text-xs text-[#6B7280]">Total practice items</span>
            <span className="text-sm font-bold text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {totalItems}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Second row – Active Courses, Recent Progress, Upcoming Reviews */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        {/* Active Courses */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-12 lg:col-span-4 rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm"
        >
          <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2 mb-4">
            <Library size={14} className="text-[#1F7A4C]" /> Active Courses
          </h3>
          <div className="space-y-3">
            <div className="rounded-xl border border-[#1F7A4C] bg-[#F0FDF4] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1F7A4C] flex items-center justify-center shrink-0">
                  <BookOpen size={16} className="text-white" />
                </div>
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-white border border-[#BBF7D0] text-[#1F7A4C] shrink-0">Active</span>
              </div>
              <div className="text-sm font-bold text-[#111827] mt-3 leading-tight">{course.title}</div>
              <div className="text-xs text-[#16643D] mt-1">
                {course.modules.length} modules · {course.stats.lessons} lessons
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white border border-[#BBF7D0] overflow-hidden p-0.5">
                <div className="h-full rounded-full bg-[#1F7A4C]" style={{ width: '12%' }} />
              </div>
              <div className="flex items-center justify-between text-xs mt-1.5">
                <span className="text-[#6B7280]">Progress</span>
                <span className="font-bold text-[#1F7A4C]">12%</span>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#FAFBFC] p-4 text-center">
              <div className="text-xs font-medium text-[#6B7280]">Add more materials to grow your library</div>
              <Link href="/upload" className="mt-2 inline-flex text-xs font-semibold text-[#1F7A4C] hover:text-[#16643D]">
                Upload center <ArrowRight size={12} className="ml-1" />
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Recent Progress */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="col-span-12 lg:col-span-5 rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <Activity size={14} className="text-[#1F7A4C]" /> Recent Progress
            </h3>
            <Link href="/progress" className="text-xs font-medium text-[#1F7A4C] hover:text-[#16643D]">
              View analytics
            </Link>
          </div>

          {/* Course structure bar chart */}
          <div className="flex items-end gap-2 h-28 mb-4 px-1">
            {perModule.slice(0, 7).map((m, i) => {
              const max = Math.max(...perModule.map((p) => p.lessons))
              const h = (m.lessons / max) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg bg-[#1F7A4C] transition-all hover:bg-[#16643D]" style={{ height: `${h}%`, minHeight: '12px' }} />
                  <span className="text-[10px] font-medium text-[#6B7280] truncate max-w-full px-0.5">{m.title.slice(0, 8)}</span>
                  <span className="text-[10px] font-bold text-[#111827]">{m.lessons}</span>
                </div>
              )
            })}
          </div>

          <div className="space-y-2">
            {recentLessons.slice(0, 3).map(({ lesson, module }) => {
              const items = lesson.vocabulary.length + lesson.grammar.length + lesson.exercises.length + lesson.materials.speaking.recalls.length
              return (
                <div key={lesson.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#FAFBFC] border border-[#F3F4F6] hover:bg-white hover:border-[#E5E7EB] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
                    <BookOpen size={14} className="text-[#1F7A4C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#111827] truncate">{lesson.title}</div>
                    <div className="text-xs text-[#6B7280] truncate">{module.title}</div>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-white border border-[#E5E7EB] text-[#6B7280] shrink-0">{items} items</span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Upcoming Reviews + Practice Decks */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="col-span-12 lg:col-span-3 space-y-4"
        >
          <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2 mb-3">
              <Calendar size={14} className="text-[#F4B942]" /> Upcoming Reviews
            </h3>
            <div className="space-y-2.5">
              {[
                { time: 'Today', count: 24, desc: 'Vocabulary + Speaking' },
                { time: 'Tomorrow', count: 18, desc: 'Listening + Reading' },
                { time: 'In 3 days', count: 32, desc: 'Full cycle review' },
              ].map((r) => (
                <div key={r.time} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FAFBFC] border border-[#F3F4F6]">
                  <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
                    <Clock size={12} className="text-[#1F7A4C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[#111827]">{r.time} · {r.count} items</div>
                    <div className="text-[11px] text-[#6B7280]">{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/cycles"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1F7A4C] hover:text-[#16643D]"
            >
              View cycle schedule <ArrowRight size={12} />
            </Link>
          </div>

          <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-[#1F7A4C]" /> Practice Decks
            </h3>
            <div className="space-y-3">
              {decks.slice(0, 4).map((d) => (
                <div key={d.dimension}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 font-medium text-[#374151]">
                      <d.icon size={12} style={{ color: PRACTICE_COLORS[d.dimension] }} />
                      {PRACTICE_META[d.dimension].label}
                    </span>
                    <span className="font-bold text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                      {d.items.length}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(d.items.length / maxItems) * 100}%`, background: PRACTICE_COLORS[d.dimension] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Speaking Sessions + Quick Actions */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="col-span-12 lg:col-span-8 rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <Mic size={14} className="text-[#1F7A4C]" /> Speaking Sessions
            </h3>
            <Link href="/speaking" className="text-xs font-semibold text-[#1F7A4C] hover:text-[#16643D] flex items-center gap-1">
              Practice speaking <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: 'Pronunciation', score: 82, sub: 'Last session 24 words', icon: Mic },
              { label: 'Fluency', score: 68, sub: '+6% this week', icon: Activity },
              { label: 'Daily Challenge', score: 3, sub: '3/5 completed today', icon: Target, isCount: true },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center">
                    <s.icon size={12} className="text-[#1F7A4C]" />
                  </span>
                  <span className="text-xs font-semibold text-[#374151]">{s.label}</span>
                </div>
                <div className="text-2xl font-extrabold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {s.score}
                  {!s.isCount && <span className="text-sm font-bold text-[#6B7280]">%</span>}
                  {s.isCount && <span className="text-sm font-bold text-[#6B7280]">/5</span>}
                </div>
                <div className="text-xs text-[#6B7280] mt-1">{s.sub}</div>
                {!s.isCount && (
                  <div className="h-1.5 rounded-full bg-white border border-[#E5E7EB] overflow-hidden mt-3">
                    <div className="h-full bg-[#1F7A4C] rounded-full" style={{ width: `${s.score}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F0FDF4] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1F7A4C] flex items-center justify-center">
                <Play size={14} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#111827]">Continue your speaking session</div>
                <div className="text-xs text-[#16643D]">Pattern drills · Voice recall · Roleplay — ~8 min</div>
              </div>
            </div>
            <Link href="/speaking" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1F7A4C] text-white text-xs font-semibold hover:bg-[#16643D]">
              Resume <Play size={12} />
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="col-span-12 lg:col-span-4 rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm"
        >
          <h3 className="text-sm font-bold text-[#111827] mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/speaking"
              className="group p-4 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] text-center hover:bg-[#ECFDF5] hover:border-[#86EFAC] transition-colors"
            >
              <Mic size={18} className="mx-auto mb-2 text-[#1F7A4C]" />
              <div className="text-xs font-semibold text-[#1F7A4C]">Speaking</div>
              <div className="text-[11px] text-[#16643D]">Voice practice</div>
            </Link>
            <Link href="/cycles" className="group p-4 rounded-2xl bg-[#FAFBFC] border border-[#E5E7EB] text-center hover:bg-white hover:border-[#D1D5DB] transition-colors">
              <RefreshCw size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#1F7A4C]" />
              <div className="text-xs font-semibold text-[#111827]">Review Cycles</div>
              <div className="text-[11px] text-[#6B7280]">Repetition</div>
            </Link>
            <Link href="/upload" className="group p-4 rounded-2xl bg-[#FAFBFC] border border-[#E5E7EB] text-center hover:bg-white hover:border-[#D1D5DB] transition-colors">
              <Upload size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#1F7A4C]" />
              <div className="text-xs font-semibold text-[#111827]">Upload</div>
              <div className="text-[11px] text-[#6B7280]">New material</div>
            </Link>
            <Link href="/progress" className="group p-4 rounded-2xl bg-[#FAFBFC] border border-[#E5E7EB] text-center hover:bg-white hover:border-[#D1D5DB] transition-colors">
              <BarChart3 size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#1F7A4C]" />
              <div className="text-xs font-semibold text-[#111827]">Analytics</div>
              <div className="text-[11px] text-[#6B7280]">Growth track</div>
            </Link>
          </div>

          <div className="mt-4 rounded-xl bg-[#1F7A4C] p-4 text-white">
            <div className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles size={12} /> Premium tip
            </div>
            <div className="text-xs leading-relaxed text-white/85 mt-1">
              Your biggest deck is <span className="font-bold text-white">{PRACTICE_META[biggest.dimension].label}</span> with {biggest.items.length} items. Practice it daily for fastest fluency.
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recommended focus */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-6 flex items-center justify-center gap-2 text-xs text-[#9CA3AF]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" /> Command center updates live · Premium SaaS experience
      </motion.div>
    </div>
  )
}
