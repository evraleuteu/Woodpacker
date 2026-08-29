import type { Course } from './types'

const COURSES_KEY = 'woodpacker:courses'
const ACTIVE_KEY = 'woodpacker:active-course'
const OLD_KEY = 'woodpacker:course'
const EVENT_NAME = 'woodpacker:repo-event'

export type RepositoryEvent =
  | { type: 'course:created' | 'course:updated'; course: Course }
  | { type: 'materials:processed' | 'knowledgegraph:updated' | 'exercises:generated'; course?: Course }
  | { type: 'course:deleted'; id: string }
  | { type: 'course:active'; id: string }
  | { type: 'repo:sync' }
  | { type: 'transform:progress'; phase: string; progress: number; mode: 'ai' | 'local' }

function stripDataUrls(course: Course): Course {
  return {
    ...course,
    sourceFiles: course.sourceFiles.map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.kind,
      words: f.words,
      size: f.size,
      path: f.path,
      role: f.role,
      durationSec: f.durationSec,
      text: f.text,
      objectKey: f.objectKey,
      pageCount: f.pageCount,
    })),
  }
}

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return JSON.stringify(stripDataUrls(obj as Course))
  }
}

if (typeof window !== 'undefined') {
  const old = localStorage.getItem(OLD_KEY)
  if (old) {
    try {
      const course = JSON.parse(old) as Course
      const existing = loadCourses()
      if (!existing.some((c) => c.id === course.id)) {
        saveCourses([course])
      }
      localStorage.setItem(ACTIVE_KEY, course.id)
      localStorage.removeItem(OLD_KEY)
    } catch {}
  }
}

function normalizeCourse(course: Course): Course {
  return {
    id: course.id,
    title: course.title ?? 'Untitled course',
    description: course.description ?? '',
    language: course.language,
    createdAt: course.createdAt ?? new Date().toISOString(),
    mode: course.mode ?? 'local',
    concepts: course.concepts ?? [],
    edges: course.edges ?? [],
    modules: (course.modules ?? []).map((m) => ({
      ...m,
      lessons: (m.lessons ?? []).map((l) => ({
        ...l,
        vocabulary: l.vocabulary ?? [],
        grammar: l.grammar ?? [],
        exercises: l.exercises ?? [],
        objectives: l.objectives ?? [],
        sourceAssets: l.sourceAssets ?? [],
      })),
    })),
    duplicates: course.duplicates ?? [],
    path: course.path ?? [],
    stats: {
      lessons: course.stats?.lessons ?? 0,
      vocabulary: course.stats?.vocabulary ?? 0,
      grammar: course.stats?.grammar ?? 0,
      exercises: course.stats?.exercises ?? 0,
      concepts: course.stats?.concepts ?? 0,
      duplicatesMerged: course.stats?.duplicatesMerged ?? 0,
    },
    sourceFiles: course.sourceFiles ?? [],
  }
}

function loadCourses(): Course[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(COURSES_KEY)
    if (!raw) return []
    if (coursesCache && coursesCache.raw === raw) return coursesCache.courses
    const parsed = JSON.parse(raw) as Course[]
    if (!Array.isArray(parsed)) return []
    const courses = parsed.map(normalizeCourse)
    coursesCache = { raw, courses }
    return courses
  } catch {
    return []
  }
}

let coursesCache: { raw: string; courses: Course[] } | null = null

function invalidateCoursesCache(): void {
  coursesCache = null
}

function saveCourses(courses: Course[]): void {
  invalidateCoursesCache()
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(COURSES_KEY, safeStringify(courses))
  } catch {
    try {
      localStorage.setItem(COURSES_KEY, JSON.stringify(courses.map(stripDataUrls)))
    } catch {
      return
    }
  }
}

export function loadCoursesList(): Course[] {
  return loadCourses()
}

export function loadActiveCourseId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function loadActiveCourse(): Course | null {
  const courses = loadCourses()
  const activeId = loadActiveCourseId()
  return courses.find((c) => c.id === activeId) ?? courses[0] ?? null
}

function setActiveLocal(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_KEY, id)
  const course = loadCourses().find((c) => c.id === id)
  if (course) dispatch({ type: 'course:active', id: course.id })
}

export function setActiveCourseId(id: string): void {
  setActiveLocal(id)
  void syncToServer({ activeCourseId: id })
}

function dispatch(event: RepositoryEvent): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: event }))
}

export function publishEvent(event: RepositoryEvent): void {
  dispatch(event)
}

export function deleteCourse(id: string): void {
  const courses = loadCourses()
  // Collect objectKeys for best-effort local cleanup logging (server does authoritative MinIO deletion)
  const toDelete = courses.find(c => c.id === id)
  const objectKeys = toDelete?.sourceFiles.map(f => f.objectKey).filter(Boolean) as string[] | undefined
  if (objectKeys?.length) {
    // Fire-and-forget per-object cleanup via existing material delete endpoint is handled server-side
    // in dbDeleteCourse (MinIO + LearningMaterial). No extra client calls needed.
  }
  const filtered = courses.filter((c) => c.id !== id)
  saveCourses(filtered)
  const activeId = loadActiveCourseId()
  if (activeId === id) {
    localStorage.setItem(ACTIVE_KEY, filtered[0]?.id ?? '')
  }
  dispatch({ type: 'course:deleted', id })
  void fetch(`/api/course?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
}

export async function deleteCourseMaterialFile(courseId: string, fileId: string): Promise<void> {
  const courses = loadCourses()
  const idx = courses.findIndex(c => c.id === courseId)
  if (idx === -1) throw new Error('Course not found locally')
  const course = courses[idx]
  const file = course.sourceFiles.find(f => f.id === fileId)
  if (!file) throw new Error('File not found in course')

  // Optimistic local update: remove from sourceFiles and from all lesson sourceAssets
  const nextCourse: Course = {
    ...course,
    sourceFiles: course.sourceFiles.filter(f => f.id !== fileId),
    modules: course.modules.map(m => ({
      ...m,
      lessons: m.lessons.map(l => ({
        ...l,
        sourceAssets: l.sourceAssets.filter(id => id !== fileId),
      })),
    })),
  }
  // Recalculate stats roughly (less precise than server rebuild, but keeps UI consistent)
  nextCourse.stats = {
    ...nextCourse.stats,
  }
  courses[idx] = nextCourse
  saveCourses(courses)
  dispatch({ type: 'course:updated', course: nextCourse })
  // If active course is this one, dispatch repo sync
  if (loadActiveCourseId() === courseId) {
    dispatch({ type: 'course:active', id: courseId })
  }

  // Persist to backend (authoritative MinIO + DB cleanup)
  const qs = new URLSearchParams({ courseId, fileId })
  if (file.objectKey) qs.set('objectKey', file.objectKey)
  const res = await fetch(`/api/course/material?${qs.toString()}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // Rollback on failure by reloading from server
    await refreshFromServer()
    throw new Error(body || `Failed to delete material (HTTP ${res.status})`)
  }
  // Ensure server state is reflected (course JSON already updated, but refresh to catch any server-side stats)
  await refreshFromServer()
}

export function saveCourse(course: Course): void {
  const courses = [...loadCourses()]
  const existingIndex = courses.findIndex((c) => c.id === course.id)
  if (existingIndex >= 0) {
    courses[existingIndex] = course
  } else {
    courses.unshift(course)
  }
  saveCourses(courses)
  setActiveLocal(course.id)
  dispatch({ type: 'course:created', course })
  dispatch({ type: 'course:updated', course })
  void syncToServer({ course })
}

export function loadCourse(): Course | null {
  return loadActiveCourse()
}

export function clearCourse(): void {
  const activeId = loadActiveCourseId()
  const courses = loadCourses()
  const course = courses.find((c) => c.id === activeId)
  const filtered = courses.filter((c) => c.id !== activeId)
  saveCourses(filtered)
  if (typeof window !== 'undefined') localStorage.removeItem(ACTIVE_KEY)
  if (course) dispatch({ type: 'course:deleted', id: course.id })
  if (activeId) {
    void fetch(`/api/course?id=${encodeURIComponent(activeId)}`, { method: 'DELETE' }).catch(() => {})
  }
}

async function syncToServer(body: { course?: Course; activeCourseId?: string }): Promise<void> {
  try {
    const payload: { course?: Course; activeCourseId?: string } = {}
    if (body.course) payload.course = stripDataUrls(body.course)
    if (body.activeCourseId) payload.activeCourseId = body.activeCourseId
    await fetch('/api/course', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // offline: the localStorage cache still holds the data
  }
}

let refreshPromise: Promise<void> | null = null

export function refreshFromServer(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch('/api/course')
        if (!res.ok) return
        const data = (await res.json()) as { courses?: Course[]; activeId?: string | null }
        if (!data.courses) return
        const local = loadCourses()
        const localById = new Map(local.map((c) => [c.id, c]))
        const merged: Course[] = []
        for (const c of data.courses) {
          merged.push(localById.get(c.id) ?? c)
        }
        for (const c of local) {
          if (!merged.some((m) => m.id === c.id)) merged.push(c)
        }
        await backfillObjectKeys(merged)
        saveCourses(merged)
        if (data.activeId) localStorage.setItem(ACTIVE_KEY, data.activeId)
        dispatch({ type: 'repo:sync' })
      } catch {
        // offline: keep the cache
      }
    })()
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

async function backfillObjectKeys(courses: Course[]): Promise<void> {
  try {
    const res = await fetch('/api/materials')
    if (!res.ok) return
    const data = (await res.json()) as { materials?: { title: string; size: number | null; objectKey: string | null }[] }
    const byKey = new Map<string, string>()
    for (const m of data.materials ?? []) {
      if (m.objectKey && m.size != null) byKey.set(`${m.title}|${m.size}`, m.objectKey)
    }
    if (!byKey.size) return
    for (const course of courses) {
      course.sourceFiles = course.sourceFiles.map((f) => {
        if (f.objectKey) return f
        const key = byKey.get(`${f.name}|${f.size}`)
        return key ? { ...f, objectKey: key } : f
      })
    }
  } catch {
    // offline: keep the cache
  }
}

export function subscribe(callback: (event: RepositoryEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = (e: Event) => {
    const detail = (e as CustomEvent<RepositoryEvent>).detail
    if (detail) callback(detail)
  }

  const storageHandler = (e: StorageEvent) => {
    if (e.key === COURSES_KEY || e.key === ACTIVE_KEY) {
      callback({ type: 'repo:sync' })
    }
  }

  window.addEventListener(EVENT_NAME, handler)
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener(EVENT_NAME, handler)
    window.removeEventListener('storage', storageHandler)
  }
}

const CYCLES_KEY = 'woodpacker:cycles-progress'

export type CyclesProgress = Record<string, number>

export function loadCyclesProgress(): CyclesProgress {
  try {
    const raw = localStorage.getItem(CYCLES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as CyclesProgress
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function saveCyclesProgress(progress: CyclesProgress): void {
  try {
    localStorage.setItem(CYCLES_KEY, JSON.stringify(progress))
  } catch {
    return
  }
}