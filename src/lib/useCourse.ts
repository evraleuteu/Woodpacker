import { useEffect, useState } from 'react'
import { loadCourse, loadCoursesList, loadActiveCourseId, refreshFromServer, subscribe, type RepositoryEvent } from './storage'
import type { Course } from './types'

const REFRESH_EVENTS: RepositoryEvent['type'][] = [
  'course:created',
  'course:updated',
  'course:deleted',
  'course:active',
  'materials:processed',
  'knowledgegraph:updated',
  'exercises:generated',
  'repo:sync',
]

export interface TransformProgress {
  phase: string
  progress: number
  mode: 'ai' | 'local'
}

export function useCourse(): Course | null {
  const [course, setCourse] = useState<Course | null>(() => loadCourse())

  useEffect(() => {
    void refreshFromServer().then(() => setCourse(loadCourse()))
    const update = () => setCourse(loadCourse())
    return subscribe((event) => {
      if (REFRESH_EVENTS.includes(event.type)) {
        update()
      }
    })
  }, [])

  return course
}

export function useCourses(): Course[] {
  const [courses, setCourses] = useState<Course[]>(() => loadCoursesList())

  useEffect(() => {
    void refreshFromServer().then(() => setCourses(loadCoursesList()))
    const update = () => setCourses(loadCoursesList())
    return subscribe((event) => {
      if (REFRESH_EVENTS.includes(event.type)) {
        update()
      }
    })
  }, [])

  return courses
}

export function useActiveCourseId(): string | null {
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveCourseId())

  useEffect(() => {
    void refreshFromServer().then(() => setActiveId(loadActiveCourseId()))
    const update = () => setActiveId(loadActiveCourseId())
    return subscribe((event) => {
      if (REFRESH_EVENTS.includes(event.type)) {
        update()
      }
    })
  }, [])

  return activeId
}

export function useTransformProgress(): TransformProgress | null {
  const [progress, setProgress] = useState<TransformProgress | null>(null)

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'transform:progress') {
        setProgress({ phase: event.phase, progress: event.progress, mode: event.mode })
      } else if (event.type === 'repo:sync') {
        setProgress(null)
      }
    })
  }, [])

  return progress
}
