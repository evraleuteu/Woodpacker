import type { Course } from './types'

const KEY = 'woodpacker:course'

export function saveCourse(course: Course): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(course))
  } catch {
    localStorage.setItem(KEY, JSON.stringify(course).slice(0, 100000))
  }
}

export function loadCourse(): Course | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as Course
  } catch {
    return null
  }
}

export function clearCourse(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    return
  }
}
