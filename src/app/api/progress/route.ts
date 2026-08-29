import { NextResponse } from 'next/server'
import { getLocalUserId, upsertProgress, listProgressByExercise } from '@/storage/storage.service'

export const runtime = 'nodejs'

interface ProgressEntry {
  exerciseId: string
  correct: boolean
  practice: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ProgressEntry
    const exerciseId = body.exerciseId
    const correct = body.correct
    const practice = body.practice ?? 'other'
    if (!exerciseId) {
      return NextResponse.json({ error: 'exerciseId is required' }, { status: 400 })
    }
    const userId = await getLocalUserId()
    // Score: 1 for correct, 0 for incorrect — stored in Progress.score.
    const score = correct ? 1 : 0
    const record = await upsertProgress(userId, exerciseId, { score })
    return NextResponse.json({ ok: true, progress: record, practice })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save progress' },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const exerciseId = url.searchParams.get('exerciseId')
    const userId = await getLocalUserId()
    if (exerciseId) {
      const rows = await listProgressByExercise(userId)
      const match = rows.find((r) => r.exercise_id === exerciseId)
      return NextResponse.json({ progress: match ?? null })
    }
    const rows = await listProgressByExercise(userId)
    return NextResponse.json({ progress: rows })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load progress' },
      { status: 500 }
    )
  }
}
