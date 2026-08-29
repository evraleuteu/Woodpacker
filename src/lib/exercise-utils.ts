import type { Exercise, Module } from '@/lib/types'

export interface ExerciseLocation {
  exercise: Exercise
  lessonId: string
  lessonTitle: string
  moduleId: string
  moduleTitle: string
  index: number
}

export function flattenExercises(course: { modules: Module[] }): ExerciseLocation[] {
  const result: ExerciseLocation[] = []
  let index = 0
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      for (const ex of lesson.exercises) {
        result.push({
          exercise: ex,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          moduleId: mod.id,
          moduleTitle: mod.title,
          index,
        })
        index++
      }
      if (mod.review) {
        for (const ex of mod.review.exercises) {
          result.push({
            exercise: ex,
            lessonId: mod.review!.title,
            lessonTitle: mod.review!.title,
            moduleId: mod.id,
            moduleTitle: mod.title,
            index,
          })
          index++
        }
      }
    }
  }
  return result
}

export function findExerciseById(course: { modules: Module[] }, id: string): ExerciseLocation | null {
  return flattenExercises(course).find((loc) => loc.exercise.id === id) ?? null
}
