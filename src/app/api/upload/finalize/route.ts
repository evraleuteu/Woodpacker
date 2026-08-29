import { NextResponse } from 'next/server'
import { BUCKET, composeObjectParts, getMinioClient, removeObject } from '@/storage/minio.service'
import { createLearningMaterial, findDuplicateMaterial, getLocalUserId } from '@/storage/storage.service'

export const runtime = 'nodejs'

const MAX_CHUNKS = 500

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

  let body: { fileName?: string; uploadId?: string; chunkTotal?: number; mime?: string; size?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const fileName = body.fileName
  const uploadId = body.uploadId
  const chunkTotal = Number(body.chunkTotal)
  if (!fileName || !uploadId || !Number.isInteger(chunkTotal) || chunkTotal <= 0 || chunkTotal > MAX_CHUNKS) {
    return NextResponse.json({ error: 'fileName, uploadId and chunkTotal are required' }, { status: 400 })
  }

  const mime = body.mime || 'application/octet-stream'
  const totalSize = typeof body.size === 'number' && Number.isInteger(body.size) ? body.size : 0
  const objectKey = `uploads/${uploadId}/${fileName}`

  try {
    const client = getMinioClient()
    const partStats: { bucket: string; key: string; size: number; etag?: string }[] = []
    for (let i = 0; i < chunkTotal; i++) {
      try {
        const stat = await client.statObject(BUCKET, `${objectKey}.part-${i}`)
        partStats.push({ bucket: BUCKET, key: `${objectKey}.part-${i}`, size: stat.size, etag: stat.etag })
      } catch {
        throw new Error(`Chunk ${i + 1}/${chunkTotal} of "${fileName}" is missing from storage — please retry the transformation.`)
      }
    }

    if (totalSize > 0) {
      const existing = await findDuplicateMaterial(userId, fileName, BigInt(totalSize))
      if (existing) {
        for (let i = 0; i < chunkTotal; i++) {
          await removeObject(`${objectKey}.part-${i}`).catch(() => {})
        }
        return NextResponse.json({
          ok: true,
          duplicate: true,
          objectKey: existing.object_key ?? objectKey,
          size: existing.size ? Number(existing.size) : totalSize,
          materialId: existing.id,
        })
      }
    }

    let composed: { size: number; etag: string | undefined }
    try {
      composed = await composeObjectParts(BUCKET, objectKey, partStats, mime)
    } catch (err) {
      throw new Error(
        `Could not assemble "${fileName}": ${err instanceof Error ? err.message : 'unknown error'}`
      )
    }
    for (let i = 0; i < chunkTotal; i++) {
      await removeObject(`${objectKey}.part-${i}`).catch(() => {})
    }

    const material = await createLearningMaterial({
      user_id: userId,
      title: fileName,
      type: kindFromMime(mime, fileName),
      language: 'unknown',
      status: 'uploaded',
      size: BigInt(composed.size),
      object_key: objectKey,
    })

    return NextResponse.json({ ok: true, objectKey, size: composed.size, materialId: material.id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Finalize failed' },
      { status: 500 }
    )
  }
}