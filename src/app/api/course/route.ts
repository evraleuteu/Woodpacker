import { NextResponse } from 'next/server'
import {
  dbDeleteCourse,
  dbGetActiveCourseId,
  dbListCourses,
  dbSaveCourse,
  dbSetActiveCourse,
  getLocalUserId,
} from '@/storage/storage.service'
import type { Course } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const userId = await getLocalUserId()
    const [courses, activeId] = await Promise.all([dbListCourses(userId), dbGetActiveCourseId(userId)])
    return NextResponse.json({ courses, activeId })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load courses' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { course?: Course; activeCourseId?: string }
    const userId = await getLocalUserId()
    if (body.course && typeof body.course === 'object' && body.course.id) {
      await dbSaveCourse(userId, body.course, true)
      return NextResponse.json({ ok: true })
    }
    if (body.activeCourseId) {
      await dbSetActiveCourse(userId, body.activeCourseId)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'course or activeCourseId required' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save course' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id query parameter required' }, { status: 400 })
    }
    const userId = await getLocalUserId()
    await dbDeleteCourse(userId, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete course' },
      { status: 500 }
    )
  }
}