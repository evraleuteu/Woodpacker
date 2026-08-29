// Storage service for woodpacker application
// Uses Prisma Client to interact with PostgreSQL database
// Falls back to localStorage for course metadata

import {
  PrismaClient,
  Prisma,
  User,
  LearningMaterial,
  Chapter,
  KnowledgeUnit,
  Exercise,
  Pattern,
  WoodpeckerCycle,
  Progress,
  SpeakingSession,
  SpeakingAttempt,
  SpeakingPattern,
  SpeakingMastery,
  PatternMastery,
} from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import type { Course } from '../lib/types'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// User operations
export function getUser(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } })
}

export function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } })
}

export function createUser(data: Prisma.UserUncheckedCreateInput): Promise<User> {
  return prisma.user.create({ data })
}

export function updateUser(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<User> {
  return prisma.user.update({ where: { id }, data })
}

export function deleteUser(id: string): Promise<User> {
  return prisma.user.delete({ where: { id } })
}

// Learning Material operations
export function getLearningMaterial(id: string): Promise<LearningMaterial | null> {
  return prisma.learningMaterial.findUnique({ where: { id } })
}

export function listLearningMaterials(userId: string): Promise<LearningMaterial[]> {
  return prisma.learningMaterial.findMany({ where: { user_id: userId } })
}

export function findDuplicateMaterial(
  userId: string,
  title: string,
  size: bigint | number
): Promise<LearningMaterial | null> {
  return prisma.learningMaterial.findFirst({
    where: { user_id: userId, title, size: BigInt(size) },
  })
}

export function createLearningMaterial(
  data: Prisma.LearningMaterialUncheckedCreateInput
): Promise<LearningMaterial> {
  return prisma.learningMaterial.create({ data })
}

export function updateLearningMaterial(
  id: string,
  data: Prisma.LearningMaterialUncheckedUpdateInput
): Promise<LearningMaterial> {
  return prisma.learningMaterial.update({ where: { id }, data })
}

export function deleteLearningMaterial(id: string): Promise<LearningMaterial> {
  return prisma.learningMaterial.delete({ where: { id } })
}

// Chapter operations
export function getChapter(id: string): Promise<Chapter | null> {
  return prisma.chapter.findUnique({ where: { id } })
}

export function listChapters(materialId: string): Promise<Chapter[]> {
  return prisma.chapter.findMany({ where: { material_id: materialId } })
}

export function createChapter(data: Prisma.ChapterUncheckedCreateInput): Promise<Chapter> {
  return prisma.chapter.create({ data })
}

export function updateChapter(
  id: string,
  data: Prisma.ChapterUncheckedUpdateInput
): Promise<Chapter> {
  return prisma.chapter.update({ where: { id }, data })
}

export function deleteChapter(id: string): Promise<Chapter> {
  return prisma.chapter.delete({ where: { id } })
}

// Knowledge Unit operations
export function getKnowledgeUnit(id: string): Promise<KnowledgeUnit | null> {
  return prisma.knowledgeUnit.findUnique({
    where: { id },
    include: { chapter: true, material: true, exercises: true },
  })
}

export function listKnowledgeUnits(materialId: string): Promise<KnowledgeUnit[]> {
  return prisma.knowledgeUnit.findMany({
    where: { material_id: materialId },
    include: { chapter: true, exercises: true },
  })
}

export function createKnowledgeUnit(
  data: Prisma.KnowledgeUnitUncheckedCreateInput
): Promise<KnowledgeUnit> {
  return prisma.knowledgeUnit.create({ data })
}

export function updateKnowledgeUnit(
  id: string,
  data: Prisma.KnowledgeUnitUncheckedUpdateInput
): Promise<KnowledgeUnit> {
  return prisma.knowledgeUnit.update({ where: { id }, data })
}

export function deleteKnowledgeUnit(id: string): Promise<KnowledgeUnit> {
  return prisma.knowledgeUnit.delete({ where: { id } })
}

// Exercise operations
export function getExercise(id: string): Promise<Exercise | null> {
  return prisma.exercise.findUnique({ where: { id } })
}

export function listExercises(knowledgeUnitId: string): Promise<Exercise[]> {
  return prisma.exercise.findMany({ where: { knowledge_unit_id: knowledgeUnitId } })
}

export function createExercise(data: Prisma.ExerciseUncheckedCreateInput): Promise<Exercise> {
  return prisma.exercise.create({ data })
}

export function updateExercise(
  id: string,
  data: Prisma.ExerciseUncheckedUpdateInput
): Promise<Exercise> {
  return prisma.exercise.update({ where: { id }, data })
}

export function deleteExercise(id: string): Promise<Exercise> {
  return prisma.exercise.delete({ where: { id } })
}

// Pattern operations
export function getPattern(id: string): Promise<Pattern | null> {
  return prisma.pattern.findUnique({ where: { id } })
}

export function listPatterns(materialId: string): Promise<Pattern[]> {
  return prisma.pattern.findMany({ where: { material_id: materialId } })
}

export function createPattern(data: Prisma.PatternUncheckedCreateInput): Promise<Pattern> {
  return prisma.pattern.create({ data })
}

export function updatePattern(id: string, data: Prisma.PatternUncheckedUpdateInput): Promise<Pattern> {
  return prisma.pattern.update({ where: { id }, data })
}

export function deletePattern(id: string): Promise<Pattern> {
  return prisma.pattern.delete({ where: { id } })
}

// Woodpecker Cycle operations
export function getWoodpeckerCycle(id: string): Promise<WoodpeckerCycle | null> {
  return prisma.woodpeckerCycle.findUnique({ where: { id } })
}

export function listWoodpeckerCycles(materialId: string): Promise<WoodpeckerCycle[]> {
  return prisma.woodpeckerCycle.findMany({ where: { material_id: materialId } })
}

export function createWoodpeckerCycle(
  data: Prisma.WoodpeckerCycleUncheckedCreateInput
): Promise<WoodpeckerCycle> {
  return prisma.woodpeckerCycle.create({ data })
}

export function updateWoodpeckerCycle(
  id: string,
  data: Prisma.WoodpeckerCycleUncheckedUpdateInput
): Promise<WoodpeckerCycle> {
  return prisma.woodpeckerCycle.update({ where: { id }, data })
}

export function deleteWoodpeckerCycle(id: string): Promise<WoodpeckerCycle> {
  return prisma.woodpeckerCycle.delete({ where: { id } })
}

// Progress operations
export function getProgress(id: string): Promise<Progress | null> {
  return prisma.progress.findUnique({ where: { id } })
}

export function listProgress(userId: string): Promise<Progress[]> {
  return prisma.progress.findMany({ where: { user_id: userId } })
}

export function createProgress(data: Prisma.ProgressUncheckedCreateInput): Promise<Progress> {
  return prisma.progress.create({ data })
}

export function updateProgress(
  id: string,
  data: Prisma.ProgressUncheckedUpdateInput
): Promise<Progress> {
  return prisma.progress.update({ where: { id }, data })
}

export function deleteProgress(id: string): Promise<Progress> {
  return prisma.progress.delete({ where: { id } })
}

export async function upsertProgress(
  userId: string,
  exerciseId: string,
  data: { score: number },
): Promise<Progress> {
  const existing = await prisma.progress.findFirst({
    where: { user_id: userId, exercise_id: exerciseId },
  })
  if (existing) {
    return prisma.progress.update({
      where: { id: existing.id },
      data: {
        score: data.score,
        attempts: { increment: 1 },
        last_reviewed: new Date(),
      },
    })
  }
  return prisma.progress.create({
    data: {
      user_id: userId,
      exercise_id: exerciseId,
      score: data.score,
      attempts: 1,
      last_reviewed: new Date(),
    },
  })
}

export async function listProgressByExercise(userId: string): Promise<Progress[]> {
  return prisma.progress.findMany({ where: { user_id: userId } })
}

// Speaking Session operations
export function getSpeakingSession(id: string): Promise<SpeakingSession | null> {
  return prisma.speakingSession.findUnique({ where: { id } })
}

export function listSpeakingSessions(userId: string): Promise<SpeakingSession[]> {
  return prisma.speakingSession.findMany({ where: { user_id: userId } })
}

export function createSpeakingSession(
  data: Prisma.SpeakingSessionUncheckedCreateInput
): Promise<SpeakingSession> {
  return prisma.speakingSession.create({ data })
}

export function updateSpeakingSession(
  id: string,
  data: Prisma.SpeakingSessionUncheckedUpdateInput
): Promise<SpeakingSession> {
  return prisma.speakingSession.update({ where: { id }, data })
}

export function deleteSpeakingSession(id: string): Promise<SpeakingSession> {
  return prisma.speakingSession.delete({ where: { id } })
}

// Speaking Attempt operations
export function getSpeakingAttempt(id: string): Promise<SpeakingAttempt | null> {
  return prisma.speakingAttempt.findUnique({ where: { id } })
}

export function listSpeakingAttempts(sessionId: string): Promise<SpeakingAttempt[]> {
  return prisma.speakingAttempt.findMany({ where: { session_id: sessionId } })
}

export function createSpeakingAttempt(
  data: Prisma.SpeakingAttemptUncheckedCreateInput
): Promise<SpeakingAttempt> {
  return prisma.speakingAttempt.create({ data })
}

export function updateSpeakingAttempt(
  id: string,
  data: Prisma.SpeakingAttemptUncheckedUpdateInput
): Promise<SpeakingAttempt> {
  return prisma.speakingAttempt.update({ where: { id }, data })
}

export function deleteSpeakingAttempt(id: string): Promise<SpeakingAttempt> {
  return prisma.speakingAttempt.delete({ where: { id } })
}

// Speaking Pattern operations
export function getSpeakingPattern(id: string): Promise<SpeakingPattern | null> {
  return prisma.speakingPattern.findUnique({ where: { id } })
}

export function listSpeakingPatterns(pattern: string): Promise<SpeakingPattern[]> {
  return prisma.speakingPattern.findMany({ where: { pattern } })
}

export function createSpeakingPattern(
  data: Prisma.SpeakingPatternUncheckedCreateInput
): Promise<SpeakingPattern> {
  return prisma.speakingPattern.create({ data })
}

export function updateSpeakingPattern(
  id: string,
  data: Prisma.SpeakingPatternUncheckedUpdateInput
): Promise<SpeakingPattern> {
  return prisma.speakingPattern.update({ where: { id }, data })
}

export function deleteSpeakingPattern(id: string): Promise<SpeakingPattern> {
  return prisma.speakingPattern.delete({ where: { id } })
}

// Speaking Mastery operations
export function getSpeakingMastery(id: string): Promise<SpeakingMastery | null> {
  return prisma.speakingMastery.findUnique({ where: { id } })
}

export function listSpeakingMastery(userId: string): Promise<SpeakingMastery[]> {
  return prisma.speakingMastery.findMany({ where: { user_id: userId } })
}

export function createSpeakingMastery(
  data: Prisma.SpeakingMasteryUncheckedCreateInput
): Promise<SpeakingMastery> {
  return prisma.speakingMastery.create({ data })
}

export function updateSpeakingMastery(
  id: string,
  data: Prisma.SpeakingMasteryUncheckedUpdateInput
): Promise<SpeakingMastery> {
  return prisma.speakingMastery.update({ where: { id }, data })
}

export function deleteSpeakingMastery(id: string): Promise<SpeakingMastery> {
  return prisma.speakingMastery.delete({ where: { id } })
}

// Pattern Mastery operations
export function getPatternMastery(id: string): Promise<PatternMastery | null> {
  return prisma.patternMastery.findUnique({ where: { id } })
}

export function listPatternMastery(pattern: string): Promise<PatternMastery[]> {
  return prisma.patternMastery.findMany({ where: { pattern } })
}

export function createPatternMastery(
  data: Prisma.PatternMasteryUncheckedCreateInput
): Promise<PatternMastery> {
  return prisma.patternMastery.create({ data })
}

export function updatePatternMastery(
  id: string,
  data: Prisma.PatternMasteryUncheckedUpdateInput
): Promise<PatternMastery> {
  return prisma.patternMastery.update({ where: { id }, data })
}

export function deletePatternMastery(id: string): Promise<PatternMastery> {
  return prisma.patternMastery.delete({ where: { id } })
}

// Course operations (localStorage fallback)
const STORAGE_KEY = 'woodpacker:courses'
const ACTIVE_KEY = 'woodpacker:active-course'

export function getCourses(): Course[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Course[]
  } catch {
    return []
  }
}

export function saveCourses(courses: Course[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses))
  } catch {
    return
  }
}

export function saveCourse(course: Course): void {
  const courses = getCourses()
  const existingIndex = courses.findIndex((c) => c.id === course.id)
  if (existingIndex >= 0) {
    courses[existingIndex] = course
  } else {
    courses.unshift(course)
  }
  saveCourses(courses)
}

export function deleteCourse(id: string): void {
  const courses = getCourses().filter((c) => c.id !== id)
  saveCourses(courses)
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
  const courses = getCourses()
  const activeId = loadActiveCourseId()
  return courses.find((c) => c.id === activeId) ?? courses[0] ?? null
}

// Database-backed course persistence
const LOCAL_USER_EMAIL = 'local@woodpacker.local'
let localUserId: string | null = null

export async function getLocalUserId(): Promise<string> {
  if (localUserId) return localUserId
  let user = await prisma.user.findUnique({ where: { email: LOCAL_USER_EMAIL } })
  if (!user) {
    user = await prisma.user.create({ data: { email: LOCAL_USER_EMAIL, name: 'Local Learner' } })
  }
  localUserId = user.id
  return user.id
}

export async function dbListCourses(userId: string): Promise<Course[]> {
  const rows = await prisma.course.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' } })
  return rows.map((r) => r.data as unknown as Course)
}

export async function dbGetActiveCourseId(userId: string): Promise<string | null> {
  const row = await prisma.course.findFirst({ where: { user_id: userId, active: true }, orderBy: { updated_at: 'desc' } })
  return row?.id ?? null
}

export async function dbSaveCourse(userId: string, course: Course, setActive: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (setActive) {
      await tx.course.updateMany({ where: { user_id: userId, active: true }, data: { active: false } })
    }
    await tx.course.upsert({
      where: { id: course.id },
      create: {
        id: course.id,
        user_id: userId,
        title: course.title,
        data: course as unknown as Prisma.InputJsonValue,
        active: setActive,
      },
      update: {
        title: course.title,
        data: course as unknown as Prisma.InputJsonValue,
        active: setActive,
      },
    })
  })
}

export async function dbSetActiveCourse(userId: string, courseId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.course.updateMany({ where: { user_id: userId, active: true }, data: { active: false } })
    await tx.course.updateMany({ where: { id: courseId, user_id: userId }, data: { active: true } })
  })
}

async function deleteLearningMaterialsCascade(userId: string, where: { object_key?: string; title?: string }): Promise<void> {
  const lms = await prisma.learningMaterial.findMany({ where: { user_id: userId, ...where }, select: { id: true } })
  for (const lm of lms) {
    try {
      const kus = await prisma.knowledgeUnit.findMany({ where: { material_id: lm.id }, select: { id: true } })
      const kuIds = kus.map(k => k.id)
      if (kuIds.length) {
        await prisma.exercise.deleteMany({ where: { knowledge_unit_id: { in: kuIds } } }).catch(() => {})
        await prisma.knowledgeUnit.deleteMany({ where: { id: { in: kuIds } } }).catch(() => {})
      }
      await prisma.chapter.deleteMany({ where: { material_id: lm.id } }).catch(() => {})
      await prisma.pattern.deleteMany({ where: { material_id: lm.id } }).catch(() => {})
      await prisma.woodpeckerCycle.deleteMany({ where: { material_id: lm.id } }).catch(() => {})
      await prisma.learningMaterial.delete({ where: { id: lm.id } }).catch(() => {})
    } catch {}
  }
}

export async function dbDeleteCourse(userId: string, courseId: string): Promise<void> {
  // Fetch course first to clean up associated storage objects
  const courseRow = await prisma.course.findFirst({ where: { id: courseId, user_id: userId } })
  if (courseRow) {
    const data = courseRow.data as unknown as { sourceFiles?: Array<{ objectKey?: string; name?: string; size?: number }> }
    const sourceFiles = data?.sourceFiles ?? []
    // Best-effort MinIO + LearningMaterial cleanup per source file (with cascade)
    const { removeObject } = await import('./minio.service')
    for (const f of sourceFiles) {
      if (f.objectKey) {
        try { await removeObject(f.objectKey).catch(() => {}) } catch {}
        try { await prisma.lessonMaterialFile.deleteMany({ where: { object_key: f.objectKey } }).catch(() => {}) } catch {}
        await deleteLearningMaterialsCascade(userId, { object_key: f.objectKey }).catch(() => {})
        // Also try by title fallback (older records may not have object_key indexed the same)
        if (f.name) {
          await deleteLearningMaterialsCascade(userId, { title: f.name }).catch(() => {})
        }
      } else if (f.name) {
        await deleteLearningMaterialsCascade(userId, { title: f.name }).catch(() => {})
      }
    }
    // Also clean any remaining LessonMaterialFile with matching object_key (in case LearningMaterial path missed)
    const objectKeys = sourceFiles.map(s => s.objectKey).filter(Boolean) as string[]
    if (objectKeys.length) {
      try {
        await prisma.lessonMaterialFile.deleteMany({ where: { object_key: { in: objectKeys } } }).catch(() => {})
      } catch {}
    }
  }

  const deleted = await prisma.course.deleteMany({ where: { id: courseId, user_id: userId } })
  if (deleted.count > 0) {
    const remaining = await prisma.course.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 1,
    })
    if (remaining.length > 0) {
      await prisma.course.updateMany({
        where: { user_id: userId, active: true },
        data: { active: false },
      })
      await prisma.course.update({ where: { id: remaining[0].id }, data: { active: true } })
    }
  }
}

export async function dbDeleteCourseMaterialFile(
  userId: string,
  courseId: string,
  fileId: string,
): Promise<{ removedObjectKey?: string | null }> {
  const courseRow = await prisma.course.findFirst({ where: { id: courseId, user_id: userId } })
  if (!courseRow) throw new Error('Course not found')
  const data = courseRow.data as unknown as { sourceFiles?: Array<{ id: string; objectKey?: string; name?: string; size?: number }> }
  const file = data?.sourceFiles?.find(f => f.id === fileId)
  if (!file) throw new Error('File not found in course')
  const objectKey = file.objectKey ?? null

  // Remove from course JSON
  const nextSourceFiles = (data.sourceFiles ?? []).filter(f => f.id !== fileId)
  // Also clean references in modules/lessons sourceAssets and edges if needed
  const raw = data as unknown as Record<string, unknown> & { modules?: Array<{ lessons?: Array<{ sourceAssets?: string[] }> }>; concepts?: unknown[]; edges?: unknown[] }
  if (Array.isArray(raw.modules)) {
    for (const m of raw.modules) if (Array.isArray(m.lessons)) for (const l of m.lessons) if (Array.isArray(l.sourceAssets)) l.sourceAssets = l.sourceAssets.filter((id: string) => id !== fileId)
  }
  await prisma.course.update({
    where: { id: courseId },
    data: { data: { ...data, sourceFiles: nextSourceFiles } as unknown as Prisma.InputJsonValue },
  })

  // MinIO + LearningMaterial cleanup (with cascade)
  if (objectKey) {
    const { removeObject } = await import('./minio.service')
    try { await removeObject(objectKey).catch(() => {}) } catch {}
    try { await prisma.lessonMaterialFile.deleteMany({ where: { object_key: objectKey } }).catch(() => {}) } catch {}
    await deleteLearningMaterialsCascade(userId, { object_key: objectKey }).catch(() => {})
    if (file.name) {
      await deleteLearningMaterialsCascade(userId, { title: file.name }).catch(() => {})
    }
  } else if (file.name) {
    await deleteLearningMaterialsCascade(userId, { title: file.name }).catch(() => {})
  }

  return { removedObjectKey: objectKey }
}

export function subscribe(callback: (event: unknown) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail) callback(detail)
  }

  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === ACTIVE_KEY) {
      callback({ type: 'repo:sync' })
    }
  }

  window.addEventListener('woodpacker:repo-event', handler as EventListener)
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener('woodpacker:repo-event', handler as EventListener)
    window.removeEventListener('storage', storageHandler)
  }
}

// Backward-compatible aggregate for existing importers
export const storage = {
  getUser,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  getLearningMaterial,
  listLearningMaterials,
  createLearningMaterial,
  updateLearningMaterial,
  deleteLearningMaterial,
  getChapter,
  listChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  getKnowledgeUnit,
  listKnowledgeUnits,
  createKnowledgeUnit,
  updateKnowledgeUnit,
  deleteKnowledgeUnit,
  getExercise,
  listExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  getPattern,
  listPatterns,
  createPattern,
  updatePattern,
  deletePattern,
  getWoodpeckerCycle,
  listWoodpeckerCycles,
  createWoodpeckerCycle,
  updateWoodpeckerCycle,
  deleteWoodpeckerCycle,
  getProgress,
   listProgress,
  createProgress,
  updateProgress,
  deleteProgress,
  upsertProgress,
  listProgressByExercise,
  getSpeakingSession,
  listSpeakingSessions,
  createSpeakingSession,
  updateSpeakingSession,
  deleteSpeakingSession,
  getSpeakingAttempt,
  listSpeakingAttempts,
  createSpeakingAttempt,
  updateSpeakingAttempt,
  deleteSpeakingAttempt,
  getSpeakingPattern,
  listSpeakingPatterns,
  createSpeakingPattern,
  updateSpeakingPattern,
  deleteSpeakingPattern,
  getSpeakingMastery,
  listSpeakingMastery,
  createSpeakingMastery,
  updateSpeakingMastery,
  deleteSpeakingMastery,
  getPatternMastery,
  listPatternMastery,
  createPatternMastery,
  updatePatternMastery,
  deletePatternMastery,
  getCourses,
  saveCourses,
  saveCourse,
  deleteCourse,
  loadActiveCourseId,
  loadActiveCourse,
  subscribe,
}

export default storage