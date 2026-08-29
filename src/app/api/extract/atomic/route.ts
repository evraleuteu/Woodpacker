import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

// Document Inspector — atomic decomposition view
// Stateless: hits python-extraction-service:8001 /analyze (layout-first pipeline)
// Reuses the deterministic pipeline but surfaces atomic layers for deep inspection
// No fallback — valid benchmark requires the forced engine is actually used
const EXTRACTION_URL =
  process.env.PYTHON_EXTRACTION_SERVICE_URL ??
  process.env.EXTRACTION_SERVICE_URL ??
  'http://127.0.0.1:8001'

export async function POST(req: Request) {
  try {
    const form = req.formData ? await req.formData().catch(() => null) : null
    if (!form) {
      const buf = await req.arrayBuffer().catch(() => new ArrayBuffer(0))
      if (buf.byteLength === 0) {
        return NextResponse.json({ error: 'No form data' }, { status: 400 })
      }
      // fallback: treat body as file
      const fd = new FormData()
      fd.append('file', new Blob([buf], { type: 'application/pdf' }), 'upload.pdf')
      const upstream = await fetch(`${EXTRACTION_URL.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        body: fd,
        cache: 'no-store',
      })
      if (!upstream.ok) {
        const txt = await upstream.text().catch(() => '')
        return NextResponse.json({ error: `atomic service ${upstream.status}: ${txt.slice(0, 800)}` }, { status: upstream.status })
      }
      const json = await upstream.json()
      return NextResponse.json(mapBundleToPipelineOutput(json.bundle ?? json))
    }

    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file field missing' }, { status: 400 })

    const upstreamForm = new FormData()
    upstreamForm.append('file', file, (file as File).name || 'upload.pdf')

    const upstream = await fetch(`${EXTRACTION_URL.replace(/\/$/, '')}/analyze`, {
      method: 'POST',
      body: upstreamForm,
      cache: 'no-store',
    })

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => '')
      return NextResponse.json({ error: `atomic service ${upstream.status}: ${txt.slice(0, 1000)}` }, { status: upstream.status })
    }
    const json = await upstream.json()
    const bundle = json.bundle ?? json
    return NextResponse.json(mapBundleToPipelineOutput(bundle))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

function mapBundleToPipelineOutput(bundle: Record<string, unknown>): Record<string, unknown> {
  const pages = (bundle.pages as Array<Record<string, unknown>>) ?? []
  const allBlocks = pages.flatMap(p => (p.blocks as Array<Record<string, unknown>>) ?? [])
  const atomic = (bundle as Record<string, unknown>).atomicElements ?? (bundle as Record<string, unknown>).atomic_elements ?? []
  const telemetry = (bundle.telemetry as Array<Record<string, unknown>>) ?? []
  const quality = (bundle.quality as Record<string, unknown>) ?? {}
  const providers = (bundle.providers_used as Record<string, string>) ?? {}
  const exercises = (bundle.exercises as unknown[]) ?? []

  // Synthesize metrics from quality where possible
  const evalRate = (quality.evaluation as Record<string, unknown> | undefined)?.oversized_region_rate as number | undefined
  const oversizedRate = Number((quality as Record<string, unknown>).oversized_region_rate ?? (evalRate ?? 0))
  const duplicateRate = Number((quality as Record<string, unknown>).duplicate_rate ?? 0)
  const avgConf = allBlocks.length ? allBlocks.reduce((s, b) => s + Number((b as Record<string, unknown>).confidence ?? 0.85), 0) / allBlocks.length : 0.9

  return {
    file_id: bundle.file_id ?? `upload-${Date.now()}`,
    filename: bundle.filename ?? 'upload.pdf',
    page_count: bundle.page_count ?? pages.length,
    metrics: {
      oversizedRegionRate: Number.isFinite(oversizedRate) ? oversizedRate : 0,
      duplicateRate: Number.isFinite(duplicateRate) ? duplicateRate : 0,
      avgConfidence: Number.isFinite(avgConf) ? avgConf : 0.9,
      elementCount: allBlocks.length,
      backgroundCount: Number(quality.background_count ?? 0),
    },
    providersUsed: providers,
    telemetry: telemetry.map((t: Record<string, unknown>) => ({
      node: String(t.node ?? t.name ?? 'node'),
      duration_ms: Number(t.duration_ms ?? t.durationMs ?? 0),
      status: String(t.status ?? 'ok'),
    })),
    rawBlocks: allBlocks,
    atomicElements: Array.isArray(atomic) ? atomic : allBlocks.map(b => ({
      id: (b as Record<string, unknown>).block_id,
      type: (b as Record<string, unknown>).type,
      bbox: (b as Record<string, unknown>).bbox,
      confidence: (b as Record<string, unknown>).confidence,
      text: (b as Record<string, unknown>).text,
      page: (b as Record<string, unknown>).page,
      isAtomic: true,
      source: (b as Record<string, unknown>).source ?? 'pymupdf',
      detectors: [(b as Record<string, unknown>).source ?? 'pymupdf'],
    })),
    classifiedElements: allBlocks,
    semanticGroups: (bundle.semanticGroups as unknown[]) ?? (bundle.semantic_groups as unknown[]) ?? [],
    exercises: exercises,
    layerCounts: {
      raw: allBlocks.length,
      atomic: Array.isArray(atomic) ? atomic.length : allBlocks.length,
      classified: allBlocks.length,
      groups: ((bundle.semanticGroups as unknown[]) ?? (bundle.semantic_groups as unknown[]) ?? []).length,
      exercises: exercises.length,
    },
  }
}

export async function GET() {
  return NextResponse.json({
    description: 'POST a PDF to get hierarchical atomic elements (stateless)',
    pipeline: 'PDF -> Coarse Layout -> Atomic Elements -> Classification -> Overlap -> Reading Order -> Semantic Grouping -> Exercise Extraction',
    upstream: EXTRACTION_URL,
    method: 'POST /api/extract/atomic with FormData file -> {file_id, metrics, rawBlocks, atomicElements, ...}',
  })
}
