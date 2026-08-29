/** Debug representation — exposes every pipeline layer independently (spec 18).

GET /api/document/debug?fileId=xxx
  -> proxies to Python /inspect/documents/{id} when available,
     otherwise runs the local hierarchical TS pipeline on a mock cover page
     to demonstrate the layer toggle.

POST /api/document/debug
  body: { pages: RawPage[] } -> runs local atomic pipeline and returns layers.
*/

import { NextRequest, NextResponse } from 'next/server'
import { runDocumentUnderstanding, buildMockCoverPage } from '@/lib/document-understanding/pipeline'

export const runtime = 'nodejs'

const EXTRACTION_URL = (
  process.env.PYTHON_EXTRACTION_SERVICE_URL ??
  process.env.EXTRACTION_SERVICE_URL ??
  'http://127.0.0.1:8001'
).replace(/\/$/, '')

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get('fileId')
  const layer = searchParams.get('layer') // raw|atomic|classified|groups|exercises
  if (fileId) {
    try {
      const upstream = await fetch(`${EXTRACTION_URL}/inspect/documents/${encodeURIComponent(fileId)}`, { cache: 'no-store' })
      if (upstream.ok) {
        const data = await upstream.json()
        // Expose layered debug payload built by Python pipeline
        const debugLayers = (data as Record<string, unknown>)['debugLayers'] ?? (data as Record<string, unknown>)['debug_layers']
        const evaluation = (data as Record<string, unknown>)['evaluation']
        const atomicElements = (data as Record<string, unknown>)['atomicElements'] ?? (data as Record<string, unknown>)['atomic_elements']
        if (layer && debugLayers && typeof debugLayers === 'object') {
          const subset = (debugLayers as Record<string, unknown>)[layer]
          return NextResponse.json({ fileId, layer, data: subset, evaluation, atomicElements })
        }
        return NextResponse.json({ fileId, data, debugLayers, evaluation, atomicElements })
      }
    } catch (e) {
      console.warn('[debug] python proxy failed, falling back to local:', e)
    }
  }
  // Fallback: run local mock decomposition to prove atomic pipeline works without Python
  const mock = buildMockCoverPage()
  const result = await runDocumentUnderstanding([mock], { fileId: fileId ?? 'mock-cover', filename: 'Kontext-B2-Cover.pdf' })
  if (layer && layer in result.layers) {
    return NextResponse.json({ fileId: result.fileId, layer, data: (result.layers as Record<string, unknown>)[layer], evaluation: result.evaluation })
  }
  return NextResponse.json({
    fileId: result.fileId,
    filename: result.filename,
    layers: result.layers,
    atomicElements: result.atomicElements,
    semanticGroups: result.semanticGroups,
    evaluation: result.evaluation,
    quality: result.quality,
    telemetry: result.telemetry,
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { pages?: unknown[]; fileId?: string; filename?: string }
    if (!body.pages || !Array.isArray(body.pages)) {
      return NextResponse.json({ error: 'pages array required' }, { status: 400 })
    }
    // Minimal sanitization — caller already built RawPage[] with bboxes
    const pages = body.pages as Parameters<typeof runDocumentUnderstanding>[0]
    const result = await runDocumentUnderstanding(pages, {
      fileId: body.fileId ?? `upload-${Date.now()}`,
      filename: body.filename ?? 'document.pdf',
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
