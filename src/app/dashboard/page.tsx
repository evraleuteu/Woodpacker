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
  Diamond,
  Play,
  RefreshCw,
  Library,
  Trophy,
  Target,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Headphones,
  PenLine,
} from 'lucide-react'
import { loadCourse } from '@/lib/storage'
import { buildPracticePlan, PRACTICE_META, PRACTICE_COLORS, PRACTICE_DIMENSIONS, type PracticeDimension } from '@/lib/plan'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const DIM_ICONS: Record<PracticeDimension, typeof BookOpen> = {
  vocabulary: BookOpen,
  grammar: Diamond,
  listening: Headphones,
  reading: BookOpen,
  hearing: Mic,
  speaking: PenLine,
}

export default function DashboardPage() {
  const course = useMemo(() => loadCourse(), [])
  const plan = useMemo(() => (course ? buildPracticePlan(course) : null), [course])

  const firstLesson = course?.modules[0]?.lessons[0]
  const decks = PRACTICE_DIMENSIONS.map((dimension) => ({
    dimension,
    icon: DIM_ICONS[dimension],
    items: (plan?.items ?? []).filter((i) => i.dimension === dimension),
  }))
  const totalItems = plan?.items.length ?? 0
  const maxItems = Math.max(1, ...decks.map((d) => d.items.length))
  const totalMinutes = decks.reduce((n, d) => n + Math.ceil(d.items.length * PRACTICE_META[d.dimension].perItemMinutes), 0)
  const biggest = [...decks].sort((a, b) => b.items.length - a.items.length)[0]
  const recentLessons = course?.modules.flatMap((m) => m.lessons.map((l) => ({ lesson: l, module: m }))).slice(0, 4) ?? []
  const perModule = course?.modules.map((m) => ({ title: m.title, lessons: m.lessons.length })) ?? []

  if (!course || !plan) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-5 ai-glow">
            <Sparkles size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Welcome to Woodpecker</h1>
          <p className="text-sm text-[#A8A29E] mb-6 max-w-lg mx-auto">
            Upload your textbook, workbook, audio or notes — Woodpecker reconstructs them into a learning system: lessons,
            vocabulary, grammar, exercises and Woodpecker practice cycles.
          </p>
          <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Upload size={14} />
            Upload your first materials
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  const missionItems = decks.flatMap((d) => d.items.slice(0, 1).map((item) => ({ label: `${PRACTICE_META[d.dimension].label}: ${item.prompt}`, done: false }))).slice(0, 4)

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8 max-w-6xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-xs text-[#10B981]">
              <CheckCircle2 size={12} />
              Course ready
            </span>
          </div>
          <p className="text-[#A8A29E] text-sm">{course.description}</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#059669] to-[#10B981] text-white text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.97]"
        >
          <Upload size={14} />
          Add Materials
        </Link>
      </motion.div>

      {/* Top row: Daily Mission + Continue Learning + Practice Load */}
      <motion.div variants={itemVariants} className="grid grid-cols-12 gap-4 mb-6">
        {/* Daily Mission */}
        <div className="col-span-4 glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-[#10B981]" />
              <h2 className="font-semibold text-sm">Today&apos;s Mission</h2>
            </div>
            <span className="text-xs text-[#6B7280]">0%</span>
          </div>
          <div className="progress-bar mb-4 h-2">
            <div className="progress-bar-fill" style={{ width: '0%' }} />
          </div>
          <div className="space-y-2">
            {missionItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-3.5 h-3.5 rounded-full border border-[rgba(250,248,245,0.15)] shrink-0" />
                <span className="text-[#FAF8F5] truncate">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-[rgba(250,248,245,0.06)] text-xs text-[#6B7280]">
            <Clock size={12} />
            ~{totalMinutes} min for the full day
          </div>
        </div>

        {/* Continue Learning Hero */}
        <div className="col-span-5 glass-card rounded-xl p-5 relative overflow-hidden group cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(16,185,129,0.08)] to-transparent pointer-events-none" />
          <div className="relative">
            <div className="text-xs text-[#6B7280] mb-1 flex items-center gap-2">
              <Play size={10} className="text-[#10B981]" />
              Continue Learning
            </div>
            <h3 className="text-lg font-bold mb-1">{firstLesson?.title ?? course.title}</h3>
            <p className="text-sm text-[#A8A29E] mb-4">
              {firstLesson ? `From ${course.modules[0]?.title} · ${course.stats.lessons} lessons in your course` : 'Start your course'}
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1 progress-bar h-2">
                <div className="progress-bar-fill" style={{ width: '0%' }} />
              </div>
              <span className="text-sm font-bold text-gradient">0%</span>
            </div>
            <Link
              href="/cycles"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#059669] to-[#10B981] text-white text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              Start
              <Play size={14} />
            </Link>
          </div>
        </div>

        {/* Practice Load */}
        <div className="col-span-3 glass-card rounded-xl p-5 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D97706] to-[#F59E0B] flex items-center justify-center mb-3 animate-streak-flame">
            <Flame size={24} className="text-white" />
          </div>
          <div className="text-3xl font-bold text-gradient-gold">{totalItems}</div>
          <div className="text-sm text-[#6B7280]">Practice Items</div>
          <div className="mt-3 flex items-center gap-1 text-xs text-[#F59E0B] bg-[rgba(245,158,11,0.08)] px-3 py-1 rounded-full">
            <Sparkles size={10} />
            {decks.length} dimensions · ~{totalMinutes} min/day
          </div>
        </div>
      </motion.div>

      {/* Second row: Practice Decks + Course Structure + Biggest Deck */}
      <motion.div variants={itemVariants} className="grid grid-cols-12 gap-4 mb-6">
        {/* Practice Decks */}
        <div className="col-span-4 glass-card rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Trophy size={14} className="text-[#10B981]" />
            Practice Decks
          </h2>
          <div className="space-y-3">
            {decks.map((d) => (
              <div key={d.dimension}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-[#A8A29E] flex items-center gap-1.5">
                    <d.icon size={12} style={{ color: PRACTICE_COLORS[d.dimension] }} />
                    {PRACTICE_META[d.dimension].label}
                  </span>
                  <span className="font-semibold">{d.items.length}</span>
                </div>
                <div className="progress-bar h-1.5">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${(d.items.length / maxItems) * 100}%`, background: PRACTICE_COLORS[d.dimension] }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[rgba(250,248,245,0.06)]">
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>Total Items</span>
              <span className="text-gradient font-bold text-sm">{totalItems}</span>
            </div>
          </div>
        </div>

        {/* Course Structure */}
        <div className="col-span-5 glass-card rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-[#10B981]" />
            Course Structure
          </h2>
          <div className="flex items-end justify-between gap-2 h-32">
            {perModule.slice(0, 7).map((m, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full rounded-md bg-gradient-to-t from-[#059669] to-[#10B981] transition-all duration-500"
                  style={{ height: `${(m.lessons / Math.max(...perModule.map((p) => p.lessons))) * 100}%` }}
                />
                <span className="text-[10px] text-[#6B7280] max-w-full truncate px-1">{m.title.length > 10 ? `${m.title.slice(0, 9)}…` : m.title}</span>
                <span className="text-[10px] text-[#A8A29E]">{m.lessons} lessons</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[rgba(250,248,245,0.06)] flex items-center justify-between text-xs text-[#6B7280]">
            <span>{course.modules.length} module(s) · {course.stats.lessons} lessons</span>
            <Link href="/materials" className="text-[#10B981] hover:text-[#34D399] transition-colors">
              View materials
            </Link>
          </div>
        </div>

        {/* Biggest Deck */}
        <div className="col-span-3 glass-card rounded-xl p-5 bg-gradient-to-br from-[rgba(16,185,129,0.04)] to-transparent border-[rgba(16,185,129,0.15)]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-[#F59E0B]" />
            <h2 className="font-semibold text-sm">Recommended Focus</h2>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D97706] to-[#F59E0B] flex items-center justify-center mb-3">
            <Target size={18} className="text-white" />
          </div>
          <h3 className="font-semibold mb-1">{PRACTICE_META[biggest.dimension].label}</h3>
          <p className="text-xs text-[#A8A29E] mb-4">
            {biggest.items.length} items · ~{Math.ceil(biggest.items.length * PRACTICE_META[biggest.dimension].perItemMinutes)} min/day — your biggest deck
          </p>
          <Link
            href="/cycles"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#10B981] hover:text-[#34D399] transition-colors"
          >
            Practice Now
            <ArrowRight size={12} />
          </Link>
        </div>
      </motion.div>

      {/* Third row: Lessons in course */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Lessons in Your Course</h2>
          <Link href="/materials" className="text-xs text-[#6B7280] hover:text-[#FAF8F5] transition-colors">
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {recentLessons.map(({ lesson, module }) => {
            const items = lesson.vocabulary.length + lesson.grammar.length + lesson.exercises.length + lesson.materials.speaking.recalls.length
            return (
              <div key={lesson.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[rgba(250,248,245,0.02)]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-[rgba(16,185,129,0.1)] text-[#10B981] flex items-center justify-center shrink-0">
                    <BookOpen size={12} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm truncate">{lesson.title}</div>
                    <div className="text-xs text-[#6B7280] truncate">{module.title}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-[#10B981]">{items} items</span>
                  <Link href="/cycles" className="text-sm font-medium text-gradient hover:opacity-80">
                    Practice
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
        <h2 className="font-semibold text-sm mb-5">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          <Link
            href="/speaking"
            className="group p-4 rounded-xl bg-gradient-to-br from-[rgba(16,185,129,0.08)] to-[rgba(5,150,105,0.05)] border border-[rgba(16,185,129,0.15)] text-center transition-all hover:border-[rgba(16,185,129,0.3)] ai-glow-hover"
          >
            <Mic size={18} className="mx-auto mb-2 text-[#10B981]" />
            <div className="text-xs font-medium">Speaking Practice</div>
          </Link>
          <Link
            href="/cycles"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <RefreshCw size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Review Cycles</div>
          </Link>
          <Link
            href="/upload"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <Upload size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Upload More</div>
          </Link>
          <Link
            href="/materials"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <Library size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Library</div>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  )
}