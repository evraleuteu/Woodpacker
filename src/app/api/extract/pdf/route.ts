import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { Readable } from 'stream'
import Busboy from '@fastify/busboy'

export const runtime = 'nodejs'
export const maxDuration = 300

const EXTRACTION_SERVICE_PATH =
  process.env.EXTRACTION_SERVICE_PATH?.trim() ||
  // Renamed + moved: ../extraction-service → ./docling-extraction-service (single image hosts
  // both python-extraction-service and docling-extraction-service; subprocess fallback uses python pipeline)
  join(process.cwd(), 'docling-extraction-service')

const EXTRACTION_SERVICE_URL = (
  process.env.PYTHON_EXTRACTION_SERVICE_URL?.trim() ||
  process.env.EXTRACTION_SERVICE_URL?.trim() ||
  'http://127.0.0.1:8001'
).replace(/\/+$/, '')

const SERVICE_TIMEOUT_MS = (() => {
  const raw = Number(process.env.EXTRACTION_SERVICE_TIMEOUT_MS ?? 180_000)
  return Number.isFinite(raw) && raw > 0 ? raw : 180_000
})()

const SUBPROCESS_TIMEOUT_MS = (() => {
  const raw = Number(
    process.env.PYTHON_SUBPROCESS_TIMEOUT_MS ?? SERVICE_TIMEOUT_MS,
  )
  return Number.isFinite(raw) && raw > 0 ? raw : SERVICE_TIMEOUT_MS
})()

const MAX_PDF_SIZE = (() => {
  const raw =
    process.env.MAX_PDF_BYTES ?? process.env.MAX_PDF_SIZE ?? undefined
  if (raw === undefined) return 100 * 1024 * 1024
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 100 * 1024 * 1024
})()

function isSubprocessFallbackEnabled(): boolean {
  return process.env.ENABLE_SUBPROCESS_FALLBACK === 'true'
}

function getPythonExecutable(): string {
  const env = process.env.PYTHON_EXECUTABLE?.trim()
  if (env) return env

  const isWindows = process.platform === 'win32'

  return join(
    EXTRACTION_SERVICE_PATH,
    '.venv',
    isWindows ? 'Scripts' : 'bin',
    isWindows ? 'python.exe' : 'python',
  )
}

function getPythonModulePath(): string {
  return join(
    EXTRACTION_SERVICE_PATH,
    'src',
    'woodpacker_extraction',
    'extract_pdf.py',
  )
}

export async function POST(req: Request) {
  try {
    const contentLengthHeader = req.headers.get('content-length')
    if (contentLengthHeader) {
      const len = Number(contentLengthHeader)
      if (Number.isFinite(len) && len > MAX_PDF_SIZE) {
        return NextResponse.json(
          {
            error: `PDF exceeds the ${MAX_PDF_SIZE / 1024 / 1024}MB size limit`,
          },
          { status: 413 },
        )
      }
    }

    const contentType = req.headers.get('content-type') ?? ''

    let pdfBytes: Buffer

    if (contentType.includes('multipart/form-data')) {
      pdfBytes = await extractFileFromMultipart(req, contentType)
    } else {
      // Raw binary upload (e.g. application/pdf or octet-stream).
      // req.body may be null for an empty POST – treat as 400, not 500.
      if (req.body === null) {
        // Still attempt to read via arrayBuffer for compatibility – some
        // runtimes provide body via arrayBuffer even when .body is null.
        // If that also yields empty, the length check below handles it.
        const ab = await req.arrayBuffer().catch(() => new ArrayBuffer(0))
        if (ab.byteLength === 0) {
          return NextResponse.json(
            { error: 'Request body is empty' },
            { status: 400 },
          )
        }
        pdfBytes = Buffer.from(ab)
      } else {
        const arrayBuffer = await req.arrayBuffer()
        pdfBytes = Buffer.from(arrayBuffer)
      }
    }

    if (pdfBytes.length === 0) {
      return NextResponse.json(
        { error: 'No file data provided' },
        { status: 400 },
      )
    }

    if (pdfBytes.length > MAX_PDF_SIZE) {
      return NextResponse.json(
        {
          error: `PDF exceeds the ${MAX_PDF_SIZE / 1024 / 1024}MB size limit`,
        },
        { status: 413 },
      )
    }

    // Basic PDF signature validation — must start with %PDF-
    if (!isPdf(pdfBytes)) {
      return NextResponse.json(
        { error: 'Uploaded file is not a valid PDF' },
        { status: 400 },
      )
    }

    const result = await extractPdfText(pdfBytes)

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF extraction failed'

    // Map known validation / limit errors to appropriate status codes
    // instead of generic 500, so clients can distinguish user errors.
    const lower = message.toLowerCase()
    if (
      lower.includes('exceeds') ||
      lower.includes('too large') ||
      lower.includes('size limit') ||
      lower.includes('file too large')
    ) {
      console.warn('[PDF Extraction] rejected oversized upload:', message)
      return NextResponse.json({ error: message }, { status: 413 })
    }
    if (
      lower.includes('no file') ||
      lower.includes('multipart') ||
      lower.includes('not a valid pdf') ||
      lower.includes('no file data') ||
      lower.includes('body is empty') ||
      lower.includes('too many files')
    ) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (lower.includes('timed out') || lower.includes('timeout')) {
      console.error('[PDF Extraction] timeout:', err)
      return NextResponse.json({ error: message }, { status: 504 })
    }

    console.error('[PDF Extraction] unexpected error:', err)

    // Avoid leaking filesystem details (temp paths, python paths) to client.
    // Log full diagnostics server-side, return generic message.
    return NextResponse.json(
      { error: 'PDF extraction failed' },
      { status: 500 },
    )
  }
}

function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString() === '%PDF-'
}

async function extractFileFromMultipart(
  req: Request,
  contentType: string,
): Promise<Buffer> {
  if (!req.body) {
    throw new Error('Multipart request body is empty')
  }

  const bb = Busboy({
    headers: {
      'content-type': contentType,
    },
    limits: {
      files: 1,
      fileSize: MAX_PDF_SIZE,
    },
  })

  const chunks: Buffer[] = []
  let found = false
  let fileTooLarge = false
  let filesLimitHit = false

  const finished = new Promise<void>((resolve, reject) => {
    // @fastify/busboy: (fieldname, file, filename, encoding, mimetype)
    // Some versions emit (fieldname, stream, info). Handle both.
    bb.on('file', (_fieldname: string, stream: NodeJS.ReadableStream) => {
      if (found) {
        // Accept only one file — drain extras to avoid hanging.
        ;(stream as NodeJS.ReadableStream & { resume: () => void }).resume()
        return
      }
      found = true

      stream.on('data', (chunk: Uint8Array) => {
        chunks.push(Buffer.from(chunk))
      })

      stream.on('limit', () => {
        fileTooLarge = true
        // Drain the remainder so Busboy can finish.
        ;(stream as NodeJS.ReadableStream & { resume: () => void }).resume()
      })

      stream.on('error', reject)
    })

    bb.on('filesLimit', () => {
      filesLimitHit = true
    })

    bb.on('finish', resolve)
    bb.on('error', (e: unknown) =>
      reject(e instanceof Error ? e : new Error(String(e))),
    )
  })

  // Readable.fromWeb expects a WHATWG ReadableStream; cast via unknown to
  // satisfy Node's type which is missing async-iterable helpers in tsc.
  const nodeStream = Readable.fromWeb(
    req.body as unknown as Parameters<typeof Readable.fromWeb>[0],
  )

  // Forward any stream error to Busboy rejection.
  nodeStream.on('error', (e) => bb.emit('error', e))

  nodeStream.pipe(bb as unknown as NodeJS.WritableStream)

  await finished

  if (filesLimitHit) {
    throw new Error('Too many files - only one file allowed')
  }

  if (!found) {
    throw new Error('No file field found in multipart request')
  }

  if (fileTooLarge) {
    throw new Error(
      `PDF exceeds the ${MAX_PDF_SIZE / 1024 / 1024}MB size limit`,
    )
  }

  return Buffer.concat(chunks)
}

interface ExtractResult {
  text: string
  pageCount: number
}

async function extractPdfText(pdfBytes: Buffer): Promise<ExtractResult> {
  try {
    return await extractViaService(pdfBytes)
  } catch (serviceError) {
    console.warn(
      '[PDF Extraction] Extraction service failed:',
      serviceError instanceof Error
        ? serviceError.message
        : serviceError,
    )

    if (!isSubprocessFallbackEnabled()) {
      throw serviceError
    }

    console.warn('[PDF Extraction] Using Python subprocess fallback')

    return extractViaSubprocess(pdfBytes)
  }
}

async function extractViaService(pdfBytes: Buffer): Promise<ExtractResult> {
  const form = new FormData()

  form.append(
    'file',
    new Blob([new Uint8Array(pdfBytes)], {
      type: 'application/pdf',
    }),
    'upload.pdf',
  )

  const controller = new AbortController()

  const timer = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS)

  try {
    let response: Response

    try {
      response = await fetch(`${EXTRACTION_SERVICE_URL}/extract/text`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Extraction service timed out after ${SERVICE_TIMEOUT_MS / 1000} seconds`,
        )
      }
      // DOMException AbortError in newer Node
      if (
        typeof DOMException !== 'undefined' &&
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        throw new Error(
          `Extraction service timed out after ${SERVICE_TIMEOUT_MS / 1000} seconds`,
        )
      }

      throw error
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')

      throw new Error(
        `Extraction service responded with HTTP ${response.status}${body ? `: ${body.slice(0, 500)}` : ''}`,
      )
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new Error('Extraction service returned invalid JSON')
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Extraction service returned invalid response')
    }

    const obj = data as {
      text?: unknown
      pageCount?: unknown
      detail?: unknown
      error?: unknown
    }

    if (typeof obj.detail === 'string' && obj.detail.trim()) {
      throw new Error(obj.detail)
    }

    if (typeof obj.error === 'string' && obj.error.trim()) {
      throw new Error(obj.error)
    }

    if (typeof obj.text !== 'string') {
      throw new Error('Extraction service returned an invalid text field')
    }

    if (
      typeof obj.pageCount !== 'number' ||
      !Number.isFinite(obj.pageCount)
    ) {
      throw new Error('Extraction service returned an invalid pageCount')
    }

    return {
      text: obj.text,
      pageCount: obj.pageCount,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function extractViaSubprocess(pdfBytes: Buffer): Promise<ExtractResult> {
  const pythonPath = getPythonExecutable()
  const modulePath = getPythonModulePath()

  const tempPdfPath = join(tmpdir(), `wp_pdf_${randomUUID()}.pdf`)

  try {
    await writeFile(tempPdfPath, pdfBytes)

    return await new Promise<ExtractResult>((resolve, reject) => {
      const pyProc = spawn(pythonPath, [modulePath, '--file', tempPdfPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''
      let settled = false

      const killTimer = setTimeout(() => {
        if (!settled) {
          settled = true
          try {
            pyProc.kill('SIGKILL')
          } catch {}
          reject(
            new Error(
              `Python extraction timed out after ${SUBPROCESS_TIMEOUT_MS / 1000} seconds`,
            ),
          )
        }
      }, SUBPROCESS_TIMEOUT_MS)

      // Prevent unhandled 'error' from leaking temp path — log server-side.
      const safeReject = (e: Error) => {
        if (settled) return
        settled = true
        clearTimeout(killTimer)
        reject(e)
      }

      pyProc.stdout.setEncoding('utf8')
      pyProc.stderr.setEncoding('utf8')

      pyProc.stdout.on('data', (chunk: string) => {
        stdout += chunk

        // Prevent unbounded stdout growth (e.g. corrupted PDF prints huge JSON).
        if (stdout.length > 20 * 1024 * 1024) {
          try {
            pyProc.kill('SIGKILL')
          } catch {}
          safeReject(new Error('Python extractor produced excessive output'))
        }
      })

      pyProc.stderr.on('data', (chunk: string) => {
        stderr += chunk

        // Keep only the useful tail to bound memory.
        if (stderr.length > 2 * 1024 * 1024) {
          stderr = stderr.slice(-2 * 1024 * 1024)
        }
      })

      pyProc.on('error', (err: Error) => {
        // Spawn failure (e.g. python not found) — don't leak pythonPath to client.
        console.error('[PDF Extraction] Failed to spawn Python:', err)
        safeReject(new Error('Failed to spawn Python process'))
      })

      pyProc.on('close', (code, signal) => {
        if (settled) return
        settled = true
        clearTimeout(killTimer)

        if (signal) {
          console.error(
            `[PDF Extraction] Python terminated with signal ${signal}:`,
            stderr.slice(0, 1000),
          )
          reject(
            new Error(
              `Python processing failed (signal ${signal})${stderr ? `: ${stderr.slice(0, 1000)}` : ''}`,
            ),
          )
          return
        }

        if (code !== 0) {
          console.error(
            `[PDF Extraction] Python exited with code ${code}:`,
            stderr.slice(0, 2000),
          )
          reject(
            new Error(
              `Python exited with code ${code}${signal ? ` (${signal})` : ''}${stderr ? `: ${stderr.slice(0, 1000)}` : ''}`,
            ),
          )
          return
        }

        try {
          if (!stdout.trim()) {
            throw new Error('Python returned empty output')
          }

          const result: unknown = JSON.parse(stdout)

          if (!result || typeof result !== 'object') {
            throw new Error('Python returned invalid JSON')
          }

          const data = result as {
            text?: unknown
            pageCount?: unknown
            error?: unknown
          }

          if (data.error) {
            throw new Error(String(data.error))
          }

          if (typeof data.text !== 'string') {
            throw new Error('Python response is missing a valid text field')
          }

          if (
            typeof data.pageCount !== 'number' ||
            !Number.isFinite(data.pageCount)
          ) {
            throw new Error('Python response is missing a valid pageCount')
          }

          resolve({
            text: data.text,
            pageCount: data.pageCount,
          })
        } catch (err) {
          console.error(
            '[PDF Extraction] Failed to parse Python output:',
            err,
            stderr.slice(0, 1000),
          )
          reject(
            new Error(
              `Failed to parse Python output: ${err instanceof Error ? err.message : String(err)}`,
            ),
          )
        }
      })
    })
  } finally {
    await cleanupTempFile(tempPdfPath)
  }
}

async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath)
  } catch {
    // File may already have been removed (timeout kill, etc.)
  }
}
