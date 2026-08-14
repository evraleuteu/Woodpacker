import { NextResponse } from 'next/server'
import { createJob, getJob } from '@/lib/pipeline'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const assets = body?.assets
    if (!Array.isArray(assets)) {
      return NextResponse.json({ error: 'assets array required' }, { status: 400 })
    }
    const job = createJob(assets)
    return NextResponse.json({ id: job.id })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid request' }, { status: 400 })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }
  const job = getJob(id)
  if (!job) {
    return NextResponse.json({ error: 'job not found' }, { status: 404 })
  }
  return NextResponse.json({
    id: job.id,
    status: job.status,
    phase: job.phase,
    progress: job.progress,
    message: job.message,
    detail: job.detail,
    mode: job.mode,
    error: job.error,
    result: job.result,
  })
}
