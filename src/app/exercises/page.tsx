'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  ClipboardCheck,
  ListChecks,
  Languages,
  Brain,
  Repeat,
  MessageSquare,
  BookOpen,
  TextCursorInput,
  Sparkles,
  Upload,
  FileQuestion,
  Play,
  Radar,
} from 'lucide-react'
import { useCourse } from '@/lib/useCourse'
import { MaterialLibrary } from '@/components/MaterialLibrary'
import { SeeScreenshotButton } from '@/components/exercises/ScreenshotModal'
import FindMe from '@/components/exercises/FindMe'
import type { Exercise, ExerciseType } from '@/lib/types'

const EXERCISE_TYPES: ExerciseType[] = [
  'fill-blank',
  'multiple-choice',
  'translation',
  'recall',
  'pattern-drill',
  'roleplay',
  'comprehension',
  'assessment',
]

const TYPE_META: Record<ExerciseType, { label: string; icon: typeof ClipboardCheck; color: string }> = {
  'fill-blank': { label: 'Fill Blank', icon: TextCursorInput, color: '#10B981' },
  'multiple-choice': { label: 'Multiple Choice', icon: ListChecks, color: '#3B82F6' },
  translation: { label: 'Translation', icon: Languages, color: '#F59E0B' },
  recall: { label: 'Recall', icon: Brain, color: '#8B5CF6' },
  'pattern-drill': { label: 'Pattern Drill', icon: Repeat, color: '#EC4899' },
  roleplay: { label: 'Roleplay', icon: MessageSquare, color: '#14B8A6' },
  comprehension: { label: 'Comprehension', icon: BookOpen, color: '#F97316' },
  assessment: { label: 'Assessment', icon: ClipboardCheck, color: '#EF4444' },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

interface LessonExercise extends Exercise {
  lessonTitle: string
  moduleTitle: string
  isReview: boolean
}

export default function ExercisesPage() {
  const course = useCourse()
  const [filter, setFilter] = useState<ExerciseType | 'all'>('all')
  const [tab, setTab] = useState<'exercises' | 'materials' | 'findme'>('exercises')

  const exercises = useMemo<LessonExercise[]>(() => {
    if (!course) return []
    const all: LessonExercise[] = []
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        for (const exercise of lesson.exercises) {
          all.push({ ...exercise, lessonTitle: lesson.title, moduleTitle: mod.title, isReview: false })
        }
      }
      if (mod.review) {
        for (const exercise of mod.review.exercises) {
          all.push({ ...exercise, lessonTitle: mod.review.title, moduleTitle: mod.title, isReview: true })
        }
      }
    }
    return all
  }, [course])

  const filtered = filter === 'all' ? exercises : exercises.filter((e) => e.type === filter)
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: exercises.length }
    for (const type of EXERCISE_TYPES) result[type] = exercises.filter((e) => e.type === type).length
    return result
  }, [exercises])

  const grouped = useMemo(() => {
    const map = new Map<string, { moduleTitle: string; items: LessonExercise[] }>()
    for (const exercise of filtered) {
      const key = exercise.moduleTitle + '\u0000' + exercise.lessonTitle
      if (!map.has(key)) map.set(key, { moduleTitle: exercise.moduleTitle, items: [] })
      map.get(key)!.items.push(exercise)
    }
    return [...map.values()]
  }, [filtered])

  if (!course) {
    if (tab === 'materials') {
      return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
          <MaterialLibrary course={null} />
        </motion.div>
      )
    }
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
        <motion.div variants={itemVariants} className="rounded-[20px] border border-dashed border-[#D1D5DB] bg-white p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-4">
            <Sparkles size={22} className="text-[#1F7A4C]" />
          </div>
          <h3 className="font-semibold mb-1 text-[#111827]">No exercises yet</h3>
          <p className="text-sm text-[#6B7280] mb-4 max-w-md mx-auto">
            Upload your textbook and Woodpecker will extract every exercise — fill-blank, multiple-choice, translation, recall and more — from your materials.
          </p>
          <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Upload size={14} />
            Upload materials
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className={tab === 'findme' ? 'p-8 max-w-7xl mx-auto' : 'p-8 max-w-6xl mx-auto'}>
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="text-[clamp(3rem,7vw,7rem)] leading-[0.9] font-extrabold tracking-[-0.05em] text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
          All Exercises
        </h1>
        <p className="text-[clamp(1.1rem,2vw,2rem)] text-[#6B7280] mt-3 leading-relaxed max-w-5xl">
          Every exercise extracted from <span className="text-[#111827]">{course.title}</span> — {exercises.length} total across {course.modules.length} module(s).
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="flex items-center gap-3 mb-6 w-fit rounded-[20px] p-1.5 bg-white border border-[#E5E7EB] shadow-sm">
        <button
          onClick={() => setTab('exercises')}
          className={`flex items-center gap-2 text-sm px-5 py-3 rounded-[16px] font-semibold transition-all cursor-pointer ${
            tab === 'exercises'
              ? 'bg-[#1F7A4C] text-white shadow-sm'
              : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <FileQuestion size={16} />
          Exercises
        </button>
        <button
          onClick={() => setTab('materials')}
          className={`flex items-center gap-2 text-sm px-5 py-3 rounded-[16px] font-semibold transition-all cursor-pointer ${
            tab === 'materials'
              ? 'bg-[#1F7A4C] text-white shadow-sm'
              : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <BookOpen size={16} />
          Materials
        </button>
        <button
          onClick={() => setTab('findme')}
          className={`flex items-center gap-2 text-sm px-5 py-3 rounded-[16px] font-semibold transition-all cursor-pointer ${
            tab === 'findme'
              ? 'bg-[#1F7A4C] text-white shadow-sm'
              : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          <Radar size={16} />
          Find Me
        </button>
      </motion.div>

      {tab === 'materials' ? (
        <MaterialLibrary course={course} />
      ) : tab === 'findme' ? (
        <FindMe key={course.id} />
      ) : (
        <>
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {(['all', ...EXERCISE_TYPES] as const).map((type) => {
          const meta = type === 'all' ? null : TYPE_META[type]
          const count = counts[type]
          const isActive = filter === type
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`rounded-[24px] p-4 text-left border transition-all cursor-pointer ${
                isActive
                  ? 'border-[#A6D4B3] bg-[#EAF6EE] shadow-soft'
                  : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#FAFBFC]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center border"
                  style={
                    meta
                      ? { backgroundColor: `${meta.color}14`, color: meta.color, borderColor: `${meta.color}33` }
                      : { backgroundColor: '#F9FAFB', color: '#6B7280', borderColor: '#E5E7EB' }
                  }
                >
                  {meta ? <meta.icon size={16} /> : <FileQuestion size={16} />}
                </div>
                {isActive && <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1F7A4C]">Active</span>}
              </div>
              <div className="text-3xl font-extrabold tracking-[-0.04em] text-[#111827]">{count}</div>
              <div className="text-sm text-[#6B7280] mt-1">{meta ? meta.label : 'All'} {count === 1 ? 'exercise' : 'exercises'}</div>
            </button>
          )
        })}
      </motion.div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['all', ...EXERCISE_TYPES] as const).map((type) => {
          const meta = type === 'all' ? null : TYPE_META[type]
          const isActive = filter === type
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#1F7A4C] text-white border-transparent'
                  : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:text-[#111827] hover:border-[#D1D5DB]'
              }`}
            >
              {meta ? meta.label : `All (${counts.all})`}
            </button>
          )
        })}
      </div>

      {!filtered.length ? (
        <motion.div variants={itemVariants} className="rounded-[20px] border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-4">
            <FileQuestion size={22} className="text-[#1F7A4C]" />
          </div>
          <h3 className="font-semibold mb-1 text-[#111827]">No exercises of this type</h3>
          <p className="text-sm text-[#6B7280] mb-4 max-w-md mx-auto">Try another filter or upload materials containing exercises.</p>
          <Link href="/upload" className="btn-secondary inline-flex items-center gap-2 text-sm">
            <Upload size={14} />
            Upload materials
          </Link>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="space-y-6">
          {grouped.map((group) => (
            <div key={group.moduleTitle + group.items[0].lessonTitle} className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-[0.15em] text-[#6B7280] font-semibold">{group.moduleTitle}</span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] text-[#1F7A4C] font-bold flex items-center justify-center shrink-0">
                  {group.items[0].lessonTitle.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-[#111827] truncate">{group.items[0].lessonTitle}</span>
                {group.items[0].isReview && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">Review</span>
                )}
                <span className="ml-auto text-[11px] text-[#6B7280] shrink-0">
                  {group.items.length} exercise{group.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map((exercise, i) => {
                  const meta = TYPE_META[exercise.type]
                  const Icon = meta.icon
                  return (
                    <div key={exercise.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-[#FAFBFC] border border-[#E5E7EB]">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 border" style={{ backgroundColor: `${meta.color}14`, color: meta.color, borderColor: `${meta.color}33` }}>
                        <Icon size={12} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 border" style={{ backgroundColor: `${meta.color}14`, color: meta.color, borderColor: `${meta.color}33` }}>
                            {meta.label}
                          </span>
                          {exercise.name && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE] shrink-0">
                              {exercise.name}
                            </span>
                          )}
                          {exercise.page && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FAFBFC] text-[#6B7280] border border-[#E5E7EB] shrink-0">
                              {exercise.page}
                            </span>
                          )}
                          <span className="text-[10px] text-[#6B7280]">#{i + 1}</span>
                        </div>
                        <div className="text-xs leading-relaxed text-[#111827]">{exercise.prompt}</div>
                        {exercise.options && exercise.options.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {exercise.options.map((option, j) => (
                              <span key={j} className="text-[10px] px-2 py-0.5 rounded bg-white border border-[#E5E7EB] text-[#6B7280]">
                                {option}
                              </span>
                            ))}
                          </div>
                        )}
                        {exercise.answer && (
                          <div className="mt-1.5 text-[10px] text-[#1F7A4C]">
                            Answer: <span className="text-[#6B7280]">{exercise.answer}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <SeeScreenshotButton exercise={exercise} />
                        <Link
                          href={`/exercises/${exercise.id}/play`}
                          className="ml-1 w-7 h-7 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center text-[#1F7A4C] hover:bg-[#DCFCE7] transition-all shrink-0"
                          title="Play interactive exercise"
                        >
                          <Play size={13} />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </motion.div>
      )}
        </>
      )}
    </motion.div>
  )
}