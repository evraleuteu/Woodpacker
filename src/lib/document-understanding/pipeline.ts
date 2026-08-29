/** Hierarchical document-understanding orchestrator.

Implements the full required pipeline:

  PDF (words/spans/lines/blocks/fonts/images via pdfjs/provider)
   ├── OCR / Vision (per-block) — reused from python when available
   └── Layout Detection (coarse regions)
        ↓
   Candidate Regions
        ↓
   Atomic Element Extraction  (decompose large → lines/spans)
        ↓
   Visual Enrichment (background/design/QR/level_badge)
        ↓
   Element Classification (rules-first, type-pair aware)
        ↓
   Deduplication / Overlap Resolution
        ↓
   Reading Order (column/geometric)
        ↓
   Semantic Grouping (preserve atomicElements + groups)
        ↓
   Exercise-Extraction consumer uses (atomic + groups + order)

Provider architecture: layout/OCR/vision are swappable via options/layoutProviderOrder.
Debug output: every layer exposed for inspector toggling (section 18).
*/

import type { AtomicElement, CoarseRegion, DocumentUnderstandingResult, EvaluationMetrics, SemanticGroup } from './types'
import { decomposeRegionsToAtomic, enrichVisualBackground, regionsToAtomicElements } from './atomic'
import { resolveOverlaps } from './overlap'
import { classifyElements } from './classification'
import { orderPageElements, assignGlobalReadingOrder } from './readingOrder'
import { buildSemanticGroups } from './grouping'
import { computeMetrics, aggregateMetrics } from './metrics'

export interface RawPage {
  page: number
  width: number
  height: number
  hasTextLayer: boolean
  regions: CoarseRegion[]
}

export interface PipelineOptions {
  fileId: string
  filename: string
  enableVision?: boolean
}

function now() { return Date.now() }

export async function runDocumentUnderstanding(
  pages: RawPage[],
  opts: PipelineOptions,
): Promise<DocumentUnderstandingResult> {
  const telemetry: { node: string; durationMs: number; status: string }[] = []
  const t = (name: string, fn: () => unknown) => {
    const s = now()
    try { const r = fn(); telemetry.push({ node: name, durationMs: now()-s, status: 'ok' }); return r } catch (e) { telemetry.push({ node: name, durationMs: now()-s, status: 'error' }); throw e }
  }

  // 1. Raw detector already provided (pages[].regions) — store for debug
  const rawDetector: AtomicElement[] = []
  for (const p of pages) {
    rawDetector.push(...regionsToAtomicElements(p.regions, p.page, rawDetector.length))
  }

  // 2. Atomic decomposition + visual enrichment (per page)
  const atomicByPage = new Map<number, AtomicElement[]>()
  const atomicFlat: AtomicElement[] = []
  t('atomic_extraction', () => {
    for (const p of pages) {
      let regions = decomposeRegionsToAtomic(p.regions, p.width, p.height)
      regions = enrichVisualBackground(regions, p.width, p.height)
      const elems = regionsToAtomicElements(regions, p.page, atomicFlat.length)
      atomicByPage.set(p.page, elems)
      atomicFlat.push(...elems)
    }
  })
  const afterAtomic = [...atomicFlat]

  // 3. Classification (rules-first)
  let classified = afterAtomic
  t('classification', () => {
    const pageHeights = new Map(pages.map((p)=> [p.page, p.height]))
    classifyElements(classified, pageHeights)
    // keep classified as same objects mutated, but snapshot for debug
  })
  const classifiedSnapshot = classified.map((a)=> ({ ...a, meta: { ...(a.meta??{}) } }))

  // 4. Overlap resolution (type-pair aware)
  let resolved: AtomicElement[] = classified
  t('overlap_resolution', () => {
    const byPage = new Map<number, AtomicElement[]>()
    for (const el of classified) {
      if (!byPage.has(el.page)) byPage.set(el.page, [])
      byPage.get(el.page)!.push(el)
    }
    const outByPage = new Map<number, AtomicElement[]>()
    const flat: AtomicElement[] = []
    for (const [page, elems] of byPage) {
      const res = resolveOverlaps(elems)
      // re-apply per-page reading order as part of overlap output
      const pg = pages.find((p)=> p.page===page)
      const orderedPage = pg ? orderPageElements(res, pg.width) : res
      outByPage.set(page, orderedPage)
      flat.push(...orderedPage)
    }
    resolved = flat
    // overwrite atomicByPage for reading order stage
    for (const [k,v] of outByPage) atomicByPage.set(k, v)
  })

  // 5. Reading order (column-aware across pages, with backgrounds excluded from ordering interleaving)
  let readingOrderIds: string[] = []
  t('reading_order', () => {
    // orderPageElements already called per page in overlap; ensure global counter
    readingOrderIds = assignGlobalReadingOrder(atomicByPage)
    // reflect order onto resolved flat sorted by readingOrder
    resolved.sort((a,b)=> (a.readingOrder ?? 9999) - (b.readingOrder ?? 9999))
  })

  // 6. Semantic grouping (preserve atomic)
  let groups: SemanticGroup[] = []
  t('semantic_grouping', () => {
    groups = buildSemanticGroups(resolved, readingOrderIds, { fileId: opts.fileId })
  })

  // 7. Evaluation metrics
  let evaluation: EvaluationMetrics
  t('evaluation', () => {
    const perPageMetrics: EvaluationMetrics[] = []
    for (const p of pages) {
      const elems = resolved.filter((r)=> r.page===p.page)
      perPageMetrics.push(computeMetrics(elems, p.width, p.height))
    }
    evaluation = aggregateMetrics(perPageMetrics)
  })

  const quality: Record<string, unknown> = {
    blocks_detected: rawDetector.length,
    blocks_atomic: afterAtomic.length,
    blocks_resolved: resolved.length,
    oversized_region_rate: Number(evaluation!.oversizedRegionRate.toFixed(3)),
    background_excluded: evaluation!.backgroundCount,
    atomic_coverage: Number(evaluation!.atomicCoverage.toFixed(3)),
    page_count: pages.length,
  }

  return {
    fileId: opts.fileId,
    filename: opts.filename,
    pageCount: pages.length,
    atomicElements: resolved,
    semanticGroups: groups,
    readingOrder: readingOrderIds,
    evaluation: evaluation!,
    quality,
    telemetry,
    layers: {
      rawDetector,
      atomicElements: afterAtomic,
      classifiedElements: classifiedSnapshot,
      resolvedElements: resolved,
      semanticGroups: groups,
      exercises: groups.filter((g)=> g.type==='exercise'),
    },
  }
}

/** Convenience: build RawPage from a simple pdfjs extraction or mock for tests. */
export function buildMockCoverPage(): RawPage {
  // Simulates a textbook cover where a single coarse detection would wrongly
  // merge Kontext + Deutsch als Fremdsprache + Kursbuch mit Audios und Videos
  // into one bbox — atomic decomposition must split it.
  const W = 595, H = 842 // A4 points
  return {
    page: 1,
    width: W,
    height: H,
    hasTextLayer: true,
    regions: [
      // Coarse oversized text region that naive detector would emit
      {
        bbox: [80, 120, 500, 340],
        type: 'paragraph',
        confidence: 0.88,
        source: 'layout',
        text: 'Kontext\nDeutsch als Fremdsprache\nKursbuch mit Audios und Videos',
        spans: [],
        lines: [
          { bbox: [80, 120, 260, 160], text: 'Kontext', spanIndices: [0] },
          { bbox: [80, 175, 420, 210], text: 'Deutsch als Fremdsprache', spanIndices: [1] },
          { bbox: [80, 225, 500, 260], text: 'Kursbuch mit Audios und Videos', spanIndices: [2] },
        ],
      },
      // Level badge coarse region (B2 inside red panel) — should become design_element/level_badge
      { bbox: [420, 40, 520, 110], type: 'paragraph', confidence: 0.9, source: 'layout', text: 'B2', lines: [{ bbox: [432, 55, 508, 95], text: 'B2' }] },
      // QR area
      { bbox: [80, 520, 160, 600], type: 'image', confidence: 0.93, source: 'vision', text: 'QR Code', meta: { icon: false } },
      // Photo / illustration
      { bbox: [280, 380, 520, 620], type: 'image', confidence: 0.95, source: 'layout' },
      // Large background design
      { bbox: [0, 0, W, H], type: 'image', confidence: 0.6, source: 'layout', meta: { icon: false }, text: '' },
    ],
  }
}
