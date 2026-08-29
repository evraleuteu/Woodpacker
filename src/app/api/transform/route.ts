import { NextResponse } from 'next/server'
import { enqueueTransform, getTransformJob, toTransformJobStatus } from '@/lib/transform-queue'
import { ensureTransformWorker } from '@/lib/transform-worker'
import type { FileRole } from '@/lib/heuristics'

export const runtime = 'nodejs'

const VALID_ROLES = new Set<FileRole>(['textbook', 'workbook', 'handbook', 'reference', 'audio', 'video', 'image', 'other'])

function sanitizeRoles(raw: unknown): Record<string, FileRole> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, FileRole> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key === 'string' && typeof value === 'string' && VALID_ROLES.has(value as FileRole)) {
      out[key] = value as FileRole
    }
  }
  return Object.keys(out).length ? out : undefined
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const assets = body?.assets
    if (!Array.isArray(assets)) {
      return NextResponse.json({ error: 'assets array required' }, { status: 400 })
    }
    ensureTransformWorker()
    const id = await enqueueTransform(assets, sanitizeRoles(body?.roles))
    return NextResponse.json({ id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request'
    const redisDown = /ECONNREFUSED|connect/i.test(message)
    return NextResponse.json(
      { error: redisDown ? 'Redis is not reachable — start it with `docker compose up -d redis`.' : message },
      { status: redisDown ? 503 : 400 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }
    const job = await getTransformJob(id)
    if (!job) {
      return NextResponse.json({ error: 'job not found' }, { status: 404 })
    }
    return NextResponse.json(await toTransformJobStatus(job))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load job'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}