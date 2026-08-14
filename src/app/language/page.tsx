'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { BookOpen, Mic, Crosshair, Upload, RefreshCw, Headphones, Diamond, BarChart3, Flame, Trophy, PenLine } from 'lucide-react'
import { loadCourse } from '@/lib/storage'
import { buildPracticePlan, PRACTICE_META, PRACTICE_COLORS, PRACTICE_DIMENSIONS, type PracticeDimension } from '@/lib/plan'

const DIM_ICONS: Record<PracticeDimension, typeof BookOpen> = {
  vocabulary: BookOpen,
  grammar: Diamond,
  listening: Headphones,
  reading: BookOpen,
  hearing: Mic,
  speaking: PenLine,
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function LanguagePage() {
  const course = useMemo(() => loadCourse(), [])
  const plan = useMemo(() => (course ? buildPracticePlan(course) : null), [course])

  const decks = PRACTICE_DIMENSIONS.map((dimension) => ({
    dimension,
    icon: DIM_ICONS[dimension],
    items: (plan?.items ?? []).filter((i) => i.dimension === dimension),
  }))
  const totalItems = plan?.items.length ?? 0
  const maxItems = Math.max(1, ...decks.map((d) => d.items.length))
  const totalMinutes = decks.reduce((n, d) => n + Math.ceil(d.items.length * PRACTICE_META[d.dimension].perItemMinutes), 0)
  const lessons = course?.modules.flatMap((m) => m.lessons) ?? []
  const decksByLesson = lessons.slice(0, 6).map((l) => ({
    id: l.id,
    name: l.title,
    module: course!.modules.find((m) => m.lessons.some((x) => x.id === l.id))?.title ?? 'Lesson',
    type: 'Lesson',
    items: l.vocabulary.length + l.grammar.length + l.exercises.length + l.materials.speaking.recalls.length,
    progress: 0,
  }))

  if (!course || !plan) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4 ai-glow">
            <BookOpen size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Language Mastery</h1>
          <p className="text-sm text-[#A8A29E] mb-6 max-w-md mx-auto">
            Upload materials first — your skill areas and decks will be built from them automatically.
          </p>
          <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Upload size={14} />
            Upload your first materials
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8 max-w-6xl mx-auto"
    >
      <motion.div variants={itemVariants} className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center">
            <BookOpen size={16} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Language Mastery</h1>
        </div>
        <p className="text-[#A8A29E] text-sm">
          {course.title} · {course.stats.lessons} lessons across all skill areas.
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-8">
        {decks.map((area) => (
          <div key={area.dimension} className="glass-card rounded-xl p-5 text-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-3">
              <area.icon size={16} className="text-white" />
            </div>
            <h3 className="font-semibold text-sm">{PRACTICE_META[area.dimension].label}</h3>
            <div className="text-xs text-[#A8A29E] mt-1">{area.items.length} items</div>
            <div className="progress-bar mt-3">
              <div
                className="progress-bar-fill"
                style={{ width: `${(area.items.length / maxItems) * 100}%`, background: PRACTICE_COLORS[area.dimension] }}
              />
            </div>
            <div className="text-xs text-gradient mt-1">{Math.ceil(area.items.length * PRACTICE_META[area.dimension].perItemMinutes)} min/day</div>
          </div>
        ))}
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-xl p-6">
          <h2 className="font-semibold text-sm mb-4">Active Decks</h2>
          <div className="space-y-3">
            {decksByLesson.map((deck) => (
              <div key={deck.id} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(250,248,245,0.02)]">
                <div>
                  <div className="text-sm font-medium">{deck.name}</div>
                  <div className="text-xs text-[#6B7280]">{deck.module} &middot; {deck.items} items</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${deck.progress}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gradient">{deck.progress}%</span>
                </div>
              </div>
            ))}
            {decksByLesson.length === 0 && <div className="text-xs text-[#6B7280] py-2">No lessons yet.</div>}
          </div>
          <Link href="/materials" className="block text-center text-xs text-gradient hover:opacity-80 mt-4">
            View all language materials →
          </Link>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h2 className="font-semibold text-sm mb-4">Learning Progress</h2>
          <div className="space-y-3">
            {[
              { label: 'Total Practice Items', value: String(totalItems), change: `~${totalMinutes} min/day`, icon: Trophy, color: 'from-[#059669] to-[#10B981]' },
              { label: 'Vocabulary Terms', value: String(course.stats.vocabulary), change: 'from your materials', icon: BarChart3, color: 'from-[#10B981] to-[#34D399]' },
              { label: 'Grammar Rules', value: String(course.stats.grammar), change: 'detected in your materials', icon: BookOpen, color: 'from-[#059669] to-[#10B981]' },
              { label: 'Exercises', value: String(course.stats.exercises), change: `${course.stats.lessons} lessons`, icon: Flame, color: 'from-[#D97706] to-[#F59E0B]' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(250,248,245,0.02)]">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                    <s.icon size={12} className="text-white" />
                  </div>
                  <span className="text-sm">{s.label}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gradient">{s.value}</div>
                  <div className="text-[10px] text-[#6B7280]">{s.change}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h2 className="font-semibold text-sm mb-5">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          <Link
            href="/upload"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <Upload size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Upload Material</div>
          </Link>
          <Link
            href="/speaking"
            className="group p-4 rounded-xl bg-gradient-to-br from-[rgba(16,185,129,0.08)] to-[rgba(5,150,105,0.05)] border border-[rgba(16,185,129,0.15)] text-center transition-all hover:border-[rgba(16,185,129,0.3)] ai-glow-hover"
          >
            <Mic size={18} className="mx-auto mb-2 text-[#10B981]" />
            <div className="text-xs font-medium">Speaking Practice</div>
          </Link>
          <Link
            href="/accent"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <Crosshair size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Accent Training</div>
          </Link>
          <Link
            href="/cycles"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <RefreshCw size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Review Cycles</div>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  )
}