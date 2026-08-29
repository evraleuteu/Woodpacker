import { NextResponse } from 'next/server'
import { Readable } from 'stream'
import { getObjectStream } from '@/storage/minio.service'
import { getLocalUserId } from '@/storage/storage.service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key')
  if (!key) return new NextResponse('Missing object key', { status: 400 })
  try {
    await getLocalUserId()
  } catch {
    return new NextResponse('Database unavailable', { status: 500 })
  }
  try {
    const obj = await getObjectStream(key)
    if (!obj) return new NextResponse('Not found', { status: 404 })
    const reader = Readable.toWeb(obj.stream as import('stream').Readable).getReader()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const pump = (): void => {
          void reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                controller.close()
                return
              }
              controller.enqueue(value)
              pump()
            })
            .catch((err) => controller.error(err))
        }
        pump()
      },
    })
    return new NextResponse(body, {
      headers: {
        'Content-Type': obj.mime,
        'Content-Length': String(obj.size),
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : 'Could not load material', { status: 500 })
  }
}
