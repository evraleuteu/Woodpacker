import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Readable } from 'stream'
import Busboy from '@fastify/busboy'
import { removeObject, uploadObjectStream } from '@/storage/minio.service'
import { createLearningMaterial, findDuplicateMaterial, getLocalUserId } from '@/storage/storage.service'

export const runtime = 'nodejs'

const MAX_FILES = 24

interface UploadResult {
  id: string
  name: string
  kind: string
  mime: string
  size: number
  objectKey: string
  materialId: string
  duplicate: boolean
}

function kindFromMime(mime: string, name: string): string {
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('image/')) return 'image'
  if (name.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (name.toLowerCase().endsWith('.docx')) return 'docx'
  if (name.toLowerCase().endsWith('.epub')) return 'epub'
  if (name.toLowerCase().endsWith('.pptx')) return 'pptx'
  if (mime.startsWith('text/') || name.toLowerCase().endsWith('.txt')) return 'text'
  return 'unknown'
}

export async function POST(req: Request) {
  let userId: string
  try {
    userId = await getLocalUserId()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Database unavailable' },
      { status: 500 }
    )
  }

  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data') || !req.body) {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })
  }

  const uploadId = randomUUID()
  const results: UploadResult[] = []
  let filesCount = 0

  try {
    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { files: MAX_FILES + 1 },
    })

    const pending: { name: string; mime: string; done: Promise<{ size: number; objectKey: string; materialId: string; duplicate: boolean }> }[] = []

    busboy.on('file', (fieldname, file, filename, _transferEncoding, mimeType) => {
      if (fieldname !== 'files') {
        file.resume()
        return
      }
      filesCount++
      if (filesCount > MAX_FILES) {
        file.resume()
        return
      }
      const objectKey = `uploads/${uploadId}/${filename}`
      const done = uploadObjectStream(Readable.from(file), objectKey, mimeType || 'application/octet-stream').then(
        async (stored) => {
          const existing = await findDuplicateMaterial(userId, filename, stored.size)
          if (existing) {
            await removeObject(objectKey).catch(() => {})
            return {
              size: existing.size ? Number(existing.size) : stored.size,
              objectKey: existing.object_key ?? objectKey,
              materialId: existing.id,
              duplicate: true,
            }
          }
          const material = await createLearningMaterial({
            user_id: userId,
            title: filename,
            type: kindFromMime(mimeType, filename),
            language: 'unknown',
            status: 'uploaded',
            size: BigInt(stored.size),
            object_key: objectKey,
          })
          return { size: stored.size, objectKey: stored.objectKey, materialId: material.id, duplicate: false }
        }
      )
      pending.push({ name: filename, mime: mimeType, done })
    })

    const finished = new Promise<void>((resolve, reject) => {
      busboy.on('finish', resolve)
      busboy.on('error', reject)
    })

    Readable.fromWeb(req.body as never).pipe(busboy)
    await finished

    if (filesCount === 0) {
      return NextResponse.json({ error: 'no files provided' }, { status: 400 })
    }
    if (filesCount > MAX_FILES) {
      return NextResponse.json({ error: `too many files (max ${MAX_FILES})` }, { status: 400 })
    }

    const all = await Promise.all(pending.map((p) => p.done))
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i]
      const { size, objectKey, materialId, duplicate } = all[i]
      results.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: p.name,
        kind: kindFromMime(p.mime, p.name),
        mime: p.mime,
        size,
        objectKey,
        materialId,
        duplicate: duplicate ?? false,
      })
    }

    return NextResponse.json({ files: results })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}