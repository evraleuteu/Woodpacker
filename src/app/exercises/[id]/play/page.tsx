'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useCourse } from '@/lib/useCourse'
import { enrichExercise } from '@/lib/exercise-enrich'
import { flattenExercises } from '@/lib/exercise-utils'
import { useGameStats } from '@/lib/useGameStats'
import { ProgressHeader } from '@/components/exercises/ProgressHeader'
import { FlashcardDeck } from '@/components/exercises/FlashcardDeck'
import type { PremiumExercise, PracticeDimension } from '@/lib/types/exercise'

export default function ExercisePlayPage() {
  const params = useParams()
  const course = useCourse()
  const exerciseId = params?.id as string | undefined
  const { stats, badges, addXp } = useGameStats()

  const exercises = useMemo<PremiumExercise[]>(() => {
    if (!course) return []
    return flattenExercises(course).map((loc) => {
      const enriched = enrichExercise(loc.exercise, {
        locale: course.language,
        lessonTitle: loc.lessonTitle,
        moduleTitle: loc.moduleTitle,
        vocabulary: findLesson(course, loc.lessonTitle)?.vocabulary,
      })
      const materials = findLesson(course, loc.lessonTitle)?.materials
      if (enriched.practice === 'reading' && materials?.reading?.passage) {
        enriched.sourceText = materials.reading.passage
      } else if (enriched.practice === 'listening' && materials?.listening?.transcript) {
        enriched.sourceText = materials.listening.transcript
      }
      return enriched
    })
  }, [course])

  const initialIndex = useMemo(() => {
    if (!exercises.length) return 0
    const idx = exerciseId ? exercises.findIndex((e) => e.id === exerciseId) : -1
    return idx >= 0 ? idx : 0
  }, [exercises, exerciseId])

  const handleResult = (result: { correct: boolean; xp: number; practice: PracticeDimension }) => {
    if (result.correct) {
      addXp(result.xp, result.practice, true)
    } else {
      addXp(0, result.practice, false)
    }
  }

  if (!course || !exercises.length) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 max-w-2xl mx-auto">
        <div className="glass-card rounded-3xl p-12 text-center">
          <h3 className="font-semibold mb-1 text-[var(--color-foreground)]">No exercises available</h3>
          <p className="text-sm mb-4 text-[var(--color-muted)]">Upload materials to create a course first.</p>
          <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm">
            Upload Materials
          </Link>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto flex max-w-3xl flex-col px-4 pb-4"
    >
      <div className="shrink-0">
        <ProgressHeader stats={stats} badges={badges} />
      </div>
      <div className="flex-1 min-h-0">
        <FlashcardDeck exercises={exercises} initialIndex={initialIndex} onResult={handleResult} />
      </div>
    </motion.div>
  )
}

function findLesson(course: ReturnType<typeof useCourse>, lessonTitle: string) {
  if (!course) return undefined
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (lesson.title === lessonTitle) return lesson
    }
  }
  return undefined
}