/** Atomic element extraction — TypeScript port of the Python atomic.py stage.

Large layout regions must be recursively decomposed:

  region → paragraphs → lines → spans/words

The PDF-native path (pdfjs-dist + canvas) supplies font/size/span geometry;
the OCR fallback estimates slices when precise line bboxes are unavailable.
*/

import type { AtomicElement, BBox, CoarseRegion, TextSpan } from './types'
import { bboxArea } from './types'

const LEVEL_BADGE_RE = /^\s*[A-C][12]\s*$/i

function isLevelBadge(text: string): boolean {
  const t = text.trim()
  if (LEVEL_BADGE_RE.test(t)) return true
  return /^[A-C]\s*[12]\s*\+?\s*$/i.test(t)
}

function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function isOversized(bbox: BBox, pageW: number, pageH: number, lineCount: number): boolean {
  const area = bboxArea(bbox)
  const pageArea = pageW * pageH
  if (area / pageArea > 0.08 && lineCount >= 3) return true
  if ((bbox[3] - bbox[1]) / pageH > 0.22 && (bbox[2] - bbox[0]) / pageW > 0.55) return true
  return false
}

function fontInfoOfSpans(spans: TextSpan[]): { size?: number; family?: string; bold?: boolean; italic?: boolean } {
  if (!spans.length) return {}
  const sizes = spans.map((s) => s.fontInfo?.size ?? 0).filter(Boolean) as number[]
  const families = spans.map((s) => s.fontInfo?.family ?? s.fontInfo?.name ?? '').filter(Boolean)
  const bold = families.some((n) => /bold|black/i.test(n))
  const italic = families.some((n) => /italic|oblique/i.test(n))
  return { size: sizes.length ? median(sizes) : undefined, family: families[0], bold, italic }
}

function classifyLine(opts: {
  text: string
  bbox: BBox
  pageH: number
  spans: TextSpan[]
  parentHint: string
  pageW: number
}): string {
  const t = opts.text.trim()
  if (!t) return opts.parentHint
  if (isLevelBadge(t) && t.length <= 6) return 'level_badge'
  const lower = t.toLowerCase()
  if (/\b(qr|audio|video|track|cd\s*\d|hören sie)\b/i.test(lower) && t.length < 100) {
    if (lower.includes('qr')) return 'qr_code'
    if (lower.includes('video')) return 'video_marker'
    return 'audio_marker'
  }
  if (/^(?:kreuzen|ergänzen|ordnen|lesen|hören|schreiben|sprechen)\s+sie\b/i.test(t)) return 'instruction'
  if (/^\s*(\d+[a-z]?[.)]|[a-h][.)])\s+\S/i.test(t)) return 'question'
  const fontSize = fontInfoOfSpans(opts.spans).size
  if (fontSize) {
    if (fontSize >= 18) return 'heading'
    if (fontSize >= 14) return 'subtitle'
  }
  const relY = opts.bbox[1] / Math.max(opts.pageH, 1)
  const shortSingle = t.length <= 60 && !t.includes('\n')
  if (relY < 0.33 && shortSingle && t.length < 25 && !/[.!?]$/.test(t) && t[0] === t[0].toUpperCase()) {
    return 'heading'
  }
  if ((['heading', 'subtitle', 'paragraph'] as string[]).includes(opts.parentHint)) {
    if (opts.parentHint === 'heading' && t.length > 80) return 'paragraph'
    return opts.parentHint
  }
  if (['exercise', 'instruction', 'question', 'answer'].includes(opts.parentHint)) return opts.parentHint
  return 'paragraph'
}

export function decomposeRegionsToAtomic(
  regions: CoarseRegion[],
  pageW: number,
  pageH: number,
): CoarseRegion[] {
  const atomic: CoarseRegion[] = []
  for (const region of regions) {
    if (region.type === 'image' || region.type === 'table') {
      atomic.push({ ...region, meta: { ...(region.meta ?? {}), atomic_level: 'visual_object' as unknown as string } as Record<string, unknown> })
      continue
    }
    const lines = region.lines
    const spans = region.spans ?? []
    if (lines && lines.length >= 2) {
      const heights = lines
        .map((l) => l.bbox[3] - l.bbox[1])
        .filter((h) => h > 0)
      const medianH = median(heights)
      const blockH = region.bbox[3] - region.bbox[1]
      let shouldSplit =
        lines.length >= 2 &&
        medianH > 0 &&
        blockH > medianH * 1.45 &&
        lines.some((l) => l.text?.trim())

      if (!shouldSplit && region.text && region.text.split('\n').filter(Boolean).length >= 3) {
        shouldSplit = (region.bbox[2] - region.bbox[0]) / pageW > 0.35 && blockH > medianH * 1.3
      }
      if (shouldSplit) {
        const parentId = (region.meta as Record<string, unknown>)?.['block_id'] as string | undefined
        lines.forEach((ln, idx) => {
          const txt = (ln.text || '').trim()
          if (!txt) return
          const lineSpans: TextSpan[] = []
          if (spans.length && ln.spanIndices?.length) {
            for (const si of ln.spanIndices) if (spans[si]) lineSpans.push(spans[si])
          }
          const lineType = classifyLine({ text: txt, bbox: ln.bbox, pageH, spans: lineSpans, parentHint: region.type, pageW })
          atomic.push({
            bbox: ln.bbox,
            type: lineType as CoarseRegion['type'],
            confidence: Math.max(0.5, region.confidence * 0.96),
            source: region.source,
            text: txt,
            spans: lineSpans,
            meta: {
              atomic_level: 'line',
              parent_id: (parentId ?? `coarse_${idx}`) as unknown as string,
              parent_type: region.type,
              line_index: idx,
              parent_bbox: region.bbox,
              provenance: [region.source, 'atomic_decomposition'],
            } as Record<string, unknown>,
          })
        })
        continue
      }
    }
    // Fallback estimated slicing when line geometry missing but text clearly multi-line
    if (region.text && region.text.split('\n').filter((s) => s.trim()).length >= 3) {
      const linesText = region.text.split('\n').map((s) => s.trim()).filter(Boolean)
      if (linesText.length >= 3 && isOversized(region.bbox, pageW, pageH, linesText.length)) {
        const [x0, y0, x1, y1] = region.bbox
        const h = (y1 - y0) / linesText.length
        linesText.forEach((lt, idx) => {
          const est: BBox = [x0, y0 + idx * h, x1, y0 + (idx + 1) * h]
          const t = classifyLine({ text: lt, bbox: est, pageH, spans: [], parentHint: region.type, pageW })
          atomic.push({
            bbox: est,
            type: t as CoarseRegion['type'],
            confidence: Math.max(0.5, region.confidence * 0.92),
            source: region.source,
            text: lt,
            meta: {
              atomic_level: 'line_estimated',
              parent_id: `est_${idx}`,
              parent_type: region.type,
              line_index: idx,
              parent_bbox: region.bbox,
              provenance: [region.source, 'atomic_estimated_split'],
            } as Record<string, unknown>,
          })
        })
        continue
      }
    }
    atomic.push({
      ...region,
      meta: { ...(region.meta ?? {}), atomic_level: 'block', font_info: fontInfoOfSpans(region.spans ?? []) } as Record<string, unknown>,
    })
  }
  return atomic
}

export function enrichVisualBackground(
  regions: CoarseRegion[],
  pageW: number,
  pageH: number,
): CoarseRegion[] {
  const pageArea = pageW * pageH
  return regions.map((r) => {
    const meta = { ...(r.meta ?? {}) } as Record<string, unknown>
    const area = bboxArea(r.bbox)
    const ratio = area / pageArea
    const text = (r.text ?? '').trim()
    const textualDensity = text ? text.split(/\s+/).length / Math.max(area / 10000, 1) : 0
    const coversFull = (r.bbox[2] - r.bbox[0]) / pageW > 0.92 && (r.bbox[3] - r.bbox[1]) / pageH > 0.88

    // Background: large area + low density
    if ((r.type === 'image' || r.type === 'unknown' || r.type === 'paragraph') && (ratio > 0.45 || coversFull)) {
      if (textualDensity < 0.08 && (ratio > 0.35 || textualDensity < 0.02) && !(meta as Record<string, unknown>)['icon']) {
        if (ratio > 0.70 || (ratio > 0.55 && !text)) {
          return { ...r, type: 'background', meta: { ...meta, subtype: 'background', z_order: 'back' } as Record<string, unknown> }
        }
        if (ratio > 0.5 && textualDensity < 0.04) {
          return { ...r, type: 'background', meta: { ...meta, subtype: 'background' } as Record<string, unknown> }
        }
      }
    }
    if (r.type === 'level_badge' || (isLevelBadge(text) && ratio < 0.08)) {
      return { ...r, type: 'design_element', meta: { ...meta, subtype: 'level_badge', level: text.trim() } as Record<string, unknown> }
    }
    if ((r.type === 'image' || r.type === 'unknown') && ratio < 0.09 && !text) {
      const cx = (r.bbox[0] + r.bbox[2]) / 2 / pageW
      const cy = (r.bbox[1] + r.bbox[3]) / 2 / pageH
      if ((cx < 0.22 || cx > 0.78) && cy < 0.22) {
        return { ...r, type: 'design_element', meta: { ...meta, subtype: ratio < 0.015 ? 'section_marker' : 'level_badge' } as Record<string, unknown> }
      }
      const w = r.bbox[2] - r.bbox[0], h = r.bbox[3] - r.bbox[1]
      if (Math.max(w, h) / Math.max(1, Math.min(w, h)) < 2.6 && ratio < 0.008) {
        return { ...r, meta: { ...meta, subtype: 'icon' } as Record<string, unknown> }
      }
    }
    if (r.type === 'image' && ratio < 0.06 && ratio > 0.002) {
      const w = r.bbox[2] - r.bbox[0], h = r.bbox[3] - r.bbox[1]
      const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h))
      const isSquare = aspect < 1.35
      const lower = text.toLowerCase()
      if (isSquare && /qr\s*code|scan\s*me|scannen/i.test(lower)) {
        return { ...r, type: 'qr_code', meta: { ...meta, subtype: 'qr_code' } as Record<string, unknown> }
      }
      if (lower.includes('audio') || lower.includes('track')) return { ...r, type: 'audio_marker', meta: { ...meta, subtype: 'audio_marker' } as Record<string, unknown> }
      if (lower.includes('video')) return { ...r, type: 'video_marker', meta: { ...meta, subtype: 'video_marker' } as Record<string, unknown> }
    }
    return { ...r, meta }
  })
}

export function regionsToAtomicElements(
  regions: CoarseRegion[],
  page: number,
  startIdx: number,
): AtomicElement[] {
  return regions.map((r, idx) => {
    const meta = (r.meta ?? {}) as Record<string, unknown>
    const atomicLevel = meta['atomic_level'] as string | undefined
    const parentId = meta['parent_id'] as string | undefined
    const subtype = (meta['subtype'] as string | undefined) ?? (r.type === 'design_element' ? (meta['level'] ? 'level_badge' : undefined) : undefined)
    const blockId =
      atomicLevel?.startsWith('line') && parentId
        ? `${parentId}_L${String(meta['line_index'] ?? idx).padStart(2, '0')}`
        : `page_${String(page).padStart(3, '0')}_block_${String(startIdx + idx).padStart(3, '0')}`
    return {
      id: blockId,
      parentId: atomicLevel?.startsWith('line') ? parentId : undefined,
      type: r.type,
      subtype,
      bbox: r.bbox,
      text: r.text,
      confidence: r.confidence,
      page,
      source: r.source as AtomicElement['source'],
      detectors: (meta['provenance'] as string[] | undefined) ?? [r.source],
      provenance: (meta['provenance'] as string[] | undefined) ?? [r.source],
      spans: r.spans,
      meta: meta as Record<string, unknown>,
    }
  })
}
