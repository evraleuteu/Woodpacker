import { NextResponse } from 'next/server'
import { dbDeleteCourseMaterialFile, getLocalUserId } from '@/storage/storage.service'

export const runtime = 'nodejs'

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    let courseId = url.searchParams.get('courseId') ?? url.searchParams.get('course_id')
    let fileId = url.searchParams.get('fileId') ?? url.searchParams.get('file_id')
    let objectKey = url.searchParams.get('objectKey') ?? url.searchParams.get('object_key')

    // Allow JSON body as fallback (for fetch with body)
    if ((!courseId || !fileId) && req.headers.get('content-type')?.includes('application/json')) {
      try {
        const body = (await req.json()) as { courseId?: string; course_id?: string; fileId?: string; file_id?: string; objectKey?: string }
        courseId = courseId ?? body.courseId ?? body.course_id ?? null
        fileId = fileId ?? body.fileId ?? body.file_id ?? null
        objectKey = objectKey ?? body.objectKey ?? null
      } catch {}
    }

    if (!courseId || !fileId) {
      return NextResponse.json({ error: 'courseId and fileId query parameters required' }, { status: 400 })
    }

    const userId = await getLocalUserId()
    const result = await dbDeleteCourseMaterialFile(userId, courseId, fileId)

    // If objectKey was provided explicitly and differs, also try to delete it (best-effort)
    if (objectKey && objectKey !== result.removedObjectKey) {
      try {
        const { removeObject } = await import('@/storage/minio.service')
        await removeObject(objectKey).catch(() => {})
      } catch {}
    }

    return NextResponse.json({ ok: true, removedObjectKey: result.removedObjectKey })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not delete material'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
