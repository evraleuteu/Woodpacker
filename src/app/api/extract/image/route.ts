import { NextResponse } from 'next/server'
import { transcribeImage, visionConfigured } from '@/lib/llm'

export const runtime = 'nodejs'
export const maxDuration = 300

const EXTRACTION_SERVICE_URL =
  process.env.PYTHON_EXTRACTION_SERVICE_URL ??
  process.env.EXTRACTION_SERVICE_URL ??
  'http://127.0.0.1:8001'

const SERVICE_TIMEOUT_MS =
  Number(process.env.EXTRACTION_SERVICE_TIMEOUT_MS ?? 120000)

const MAX_IMAGE_BYTES = 25 * 1024 * 1024

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
])

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 250000)
}

function getExtension(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    default:
      return 'png'
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? ''

    let imageBytes: Buffer
    let mime = 'image/png'

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: 'file field required' },
          { status: 400 }
        )
      }

      mime = (file.type || 'image/png').toLowerCase()

      if (!ALLOWED_MIME.has(mime)) {
        return NextResponse.json(
          { error: `Unsupported image type: ${mime}` },
          { status: 415 }
        )
      }

      imageBytes = Buffer.from(await file.arrayBuffer())
    } else {
      mime = (
        req.headers.get('x-image-type') ?? 'image/png'
      ).toLowerCase()

      if (!ALLOWED_MIME.has(mime)) {
        return NextResponse.json(
          { error: `Unsupported image type: ${mime}` },
          { status: 415 }
        )
      }

      imageBytes = Buffer.from(await req.arrayBuffer())
    }

    if (!imageBytes.length) {
      return NextResponse.json(
        { error: 'No image data provided' },
        { status: 400 }
      )
    }

    if (imageBytes.length > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'Image too large (max 25 MB)' },
        { status: 413 }
      )
    }

    const errors: string[] = []

    // Vision OCR
    if (visionConfigured()) {
      try {
        const dataUrl =
          `data:${mime};base64,${imageBytes.toString('base64')}`

        const text = await transcribeImage(dataUrl)

        if (text?.trim()) {
          return NextResponse.json({
            text: cleanText(`[PAGE 1]\n${text}`),
            engine: 'vision',
          })
        }

        errors.push('vision: empty transcription')
      } catch (err) {
        console.error('Vision OCR failed:', err)

        errors.push(
          `vision: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }
    }

    // Surya OCR
    try {
      const form = new FormData()

      form.append(
        'file',
        new Blob([new Uint8Array(imageBytes)], { type: mime }),
        `upload.${getExtension(mime)}`
      )

      const controller = new AbortController()

      const timeout = setTimeout(
        () => controller.abort(),
        SERVICE_TIMEOUT_MS
      )

      try {
        const res = await fetch(
          `${EXTRACTION_SERVICE_URL}/extract/image`,
          {
            method: 'POST',
            body: form,
            signal: controller.signal,
          }
        )

        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          throw new Error(
            `HTTP ${res.status}: ${detail.slice(0, 200)}`
          )
        }

        const data = await res.json()

        if (data?.text?.trim()) {
          return NextResponse.json({
            text: cleanText(data.text),
            engine: data.engine ?? 'surya',
          })
        }

        errors.push('surya: empty transcription')
      } finally {
        clearTimeout(timeout)
      }
    } catch (err) {
      console.error('Surya OCR failed:', err)

      errors.push(
        `surya: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }

    return NextResponse.json(
      {
        error: 'Image text extraction failed',
        details: errors,
      },
      { status: 503 }
    )
  } catch (err) {
    console.error('Image extraction route failed:', err)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}