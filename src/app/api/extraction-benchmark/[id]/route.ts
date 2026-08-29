import { NextResponse } from 'next/server'
import { getBenchmark } from '@/lib/benchmark/store'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const run = getBenchmark((await context.params).id)
  return run ? NextResponse.json(run) : NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
}
