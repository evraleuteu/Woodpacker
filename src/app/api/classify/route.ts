import { NextResponse } from 'next/server'
import { classifyAssetsWithAI, type ClassifyInput } from '@/lib/classify'
import { buildMaterialGraph } from '@/lib/lmre'
import type { UploadedAsset } from '@/lib/types'

export const runtime = 'nodejs'

const TEXT_LIMIT = 6000

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const raw = body?.assets
    if (!Array.isArray(raw) || !raw.length) {
      return NextResponse.json({ error: 'assets array required' }, { status: 400 })
    }

    const assets: ClassifyInput[] = []
    for (const a of raw as Record<string, unknown>[]) {
      if (!a || typeof a !== 'object') continue
      const { id, name, kind } = a as { id?: unknown; name?: unknown; kind?: unknown }
      if (typeof id !== 'string' || typeof name !== 'string' || typeof kind !== 'string') continue
      const text = typeof a.text === 'string' ? a.text : undefined
      assets.push({
        id,
        name,
        kind,
        path: typeof a.path === 'string' ? a.path : undefined,
        text: text ? text.slice(0, TEXT_LIMIT) : undefined,
        words: typeof a.words === 'number' ? a.words : undefined,
        pageCount: typeof a.pageCount === 'number' ? a.pageCount : undefined,
        durationSec: typeof a.durationSec === 'number' ? a.durationSec : undefined,
      })
    }

    if (!assets.length) {
      return NextResponse.json({ error: 'no valid assets' }, { status: 400 })
    }

    const classifications = await classifyAssetsWithAI(assets)

    const graph = buildMaterialGraph(
      assets.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind as UploadedAsset['kind'],
        mime: '',
        size: 0,
        path: a.path,
        text: a.text,
        durationSec: a.durationSec,
        objectKey: undefined,
        pageCount: a.pageCount,
        words: a.words,
      })) as UploadedAsset[],
      Object.fromEntries(classifications.map((c) => [c.id, c]))
    )

    return NextResponse.json({ classifications, graph })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Classification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}