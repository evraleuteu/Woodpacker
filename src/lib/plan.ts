import type { Course, Exercise, Lesson } from './types'
import { classifyExercise } from './heuristics'

export type PracticeDimension = 'vocabulary' | 'grammar' | 'listening' | 'reading' | 'hearing' | 'speaking'

export const PRACTICE_META: Record<PracticeDimension, { label: string; perItemMinutes: number }> = {
  vocabulary: { label: 'Vocabulary', perItemMinutes: 1 },
  grammar: { label: 'Grammar', perItemMinutes: 2 },
  listening: { label: 'Listening', perItemMinutes: 1.5 },
  reading: { label: 'Reading', perItemMinutes: 3 },
  hearing: { label: 'Hearing', perItemMinutes: 1 },
  speaking: { label: 'Speaking', perItemMinutes: 2 },
}

export const PRACTICE_DIMENSIONS: PracticeDimension[] = ['vocabulary', 'grammar', 'listening', 'reading', 'hearing', 'speaking']

export const PRACTICE_COLORS: Record<PracticeDimension, string> = {
  vocabulary: '#8B5CF6',
  grammar: '#F59E0B',
  listening: '#3B82F6',
  reading: '#10B981',
  hearing: '#EC4899',
  speaking: '#F97316',
}

export interface PracticeItem {
  id: string
  lessonId: string
  lessonTitle: string
  dimension: PracticeDimension
  prompt: string
  kind: 'textbook' | 'generated'
  exercise?: Exercise
}

export interface PracticePlan {
  items: PracticeItem[]
  counts: Record<PracticeDimension, number>
}

function buildPracticePlanForLesson(lesson: Lesson, items: PracticeItem[], counts: Record<PracticeDimension, number>) {
  const push = (dimension: PracticeDimension, prompt: string, kind: 'textbook' | 'generated', exercise?: Exercise) => {
    counts[dimension]++
    items.push({
      id: `${lesson.id}-${dimension}-${counts[dimension]}`,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      dimension,
      prompt,
      kind,
      exercise,
    })
  }

  for (const ex of lesson.exercises) {
    const cls = classifyExercise(ex.prompt)
    if (cls.practice === 'other') continue
    const p = cls.practice as PracticeDimension
    push(p, ex.prompt, 'textbook', ex)
  }

  const m = lesson.materials
  if (m?.listening?.transcript) {
    push('hearing', `Listen to the audio: ${m.listening.title ?? lesson.title}`, 'generated')
    for (const q of m.listening.questions ?? []) push('listening', q, 'generated')
  }
  if (m?.reading?.passage) {
    push('reading', `Read the passage: ${m.reading.title ?? lesson.title}`, 'generated')
    for (const q of m.reading.questions ?? []) push('reading', q, 'generated')
  }
  for (const r of m?.speaking?.roleplays ?? []) push('speaking', r, 'generated')
  for (const d of m?.speaking?.drills ?? []) push('speaking', d, 'generated')
  for (const r of m?.speaking?.recalls ?? []) push('speaking', r, 'generated')
}

export function buildPracticePlan(course: Course): PracticePlan {
  const items: PracticeItem[] = []
  const counts: Record<PracticeDimension, number> = { vocabulary: 0, grammar: 0, listening: 0, reading: 0, hearing: 0, speaking: 0 }

  const allLessons = course.modules.flatMap((m) => m.lessons)
  for (const lesson of allLessons) {
    buildPracticePlanForLesson(lesson, items, counts)
  }

  const claimedAudio = new Set<string>()
  for (const lesson of allLessons) {
    if (lesson.materials?.listening?.transcript) {
      for (const id of lesson.sourceAssets ?? []) claimedAudio.add(id)
    }
  }
  for (const f of course.sourceFiles) {
    if (f.kind !== 'audio' && f.kind !== 'video') continue
    if (claimedAudio.has(f.id)) continue
    const lesson = allLessons.find((l) => (l.sourceAssets ?? []).includes(f.id))
    counts.hearing++
    items.push({
      id: `hearing-${f.id}`,
      lessonId: lesson?.id ?? '',
      lessonTitle: lesson?.title ?? f.name,
      dimension: 'hearing',
      prompt: `Listen to the audio: ${f.name}`,
      kind: 'generated',
    })
  }

  return { items, counts }
}