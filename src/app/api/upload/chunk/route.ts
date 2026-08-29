import { NextResponse } from 'next/server'
import { Readable } from 'stream'
import Busboy from '@fastify/busboy'
import { uploadObject } from '@/storage/minio.service'
import { findDuplicateMaterial, getLocalUserId } from '@/storage/storage.service'

export const runtime = 'nodejs'

const MAX_CHUNK_BYTES = 64 * 1024 * 1024
const MAX_CHUNKS = 500

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    ;(stream as import('stream').Readable).on('data', (chunk: Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data') || !req.body) {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })
  }

  let userId: string
  try {
    userId = await getLocalUserId()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Database unavailable' },
      { status: 500 }
    )
  }

  const fields: Record<string, string> = {}
  let chunkBuffer: Buffer | null = null

  try {
    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { files: 1, fileSize: MAX_CHUNK_BYTES },
    })

    busboy.on('field', (fieldname, value) => {
      fields[fieldname] = value
    })

    busboy.on('file', async (fieldname, file) => {
      if (fieldname !== 'chunk') {
        file.resume()
        return
      }
      try {
        chunkBuffer = await streamToBuffer(file)
      } catch {
        chunkBuffer = null
      }
    })

    const finished = new Promise<void>((resolve, reject) => {
      busboy.on('finish', resolve)
      busboy.on('error', reject)
    })

    Readable.fromWeb(req.body as never).pipe(busboy)
    await finished

    const fileName = fields.fileName
    const uploadId = fields.uploadId
    const chunkIndex = Number(fields.chunkIndex)
    const chunkTotal = Number(fields.chunkTotal)
    if (!fileName || !uploadId || !Number.isInteger(chunkIndex) || !Number.isInteger(chunkTotal)) {
      return NextResponse.json({ error: 'fileName, uploadId, chunkIndex and chunkTotal fields are required' }, { status: 400 })
    }
    if (chunkIndex < 0 || chunkIndex >= chunkTotal || chunkTotal > MAX_CHUNKS) {
      return NextResponse.json({ error: 'invalid chunk range' }, { status: 400 })
    }
    if (!chunkBuffer) {
      return NextResponse.json({ error: 'no chunk file provided' }, { status: 400 })
    }

    const mime = fields.mime || 'application/octet-stream'
    const totalSize = Number(fields.size)
    const objectKey = `uploads/${uploadId}/${fileName}`
    const partKey = `${objectKey}.part-${chunkIndex}`

    if (Number.isInteger(totalSize) && totalSize > 0) {
      const existing = await findDuplicateMaterial(userId, fileName, BigInt(totalSize))
      if (existing) {
        return NextResponse.json({
          ok: true,
          duplicate: true,
          objectKey: existing.object_key ?? objectKey,
          size: existing.size ? Number(existing.size) : totalSize,
          materialId: existing.id,
        })
      }
    }

    await uploadObject(chunkBuffer, partKey, mime)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chunk upload failed' },
      { status: 500 }
    )
  }
}