/**
 * Background Detection — prevent large visual backgrounds entering exercise pipeline.
 *
 * Backgrounds identified using:
 * - page coverage
 * - color/texture (placeholder)
 * - z-order when available
 * - overlap with meaningful content
 * - low textual density
 * - large-area geometry
 * - repeated page-template characteristics
 */
import type { AtomicElement, BBox, CoarseBlock } from './types'
import { area, coverage, intersectionArea } from './geometry'

let _bgCounter = 0
function nextBgId(page: number): string {
  return `bg_p${page}_${++_bgCounter}_${Math.random().toString(36).slice(2, 6)}`
}
export function resetBackgroundCounter() { _bgCounter = 0 }

export interface BackgroundCandidate {
  block: CoarseBlock
  score: number // 0..1 background likelihood
  reasons: string[]
}

export function scoreBackground(
  block: CoarseBlock,
  pageWidth: number,
  pageHeight: number,
  allBlocks: CoarseBlock[],
): BackgroundCandidate {
  const cov = coverage(block.bbox, pageWidth, pageHeight)
  const blockArea = area(block.bbox)
  const textLen = (block.text ?? '').trim().length
  const textDensity = textLen / (blockArea / 1000) // chars per 1000pt²
  const reasons: string[] = []
  let score = 0

  // Large area → background likely
  if (cov > 0.55) { score += 0.4; reasons.push(`large coverage ${ (cov*100).toFixed(1)}%`) }
  else if (cov > 0.35) { score += 0.2; reasons.push(`coverage ${ (cov*100).toFixed(1)}%`) }

  // Low textual density
  if (textDensity < 2) { score += 0.25; reasons.push(`low text density ${textDensity.toFixed(2)}`) }
  else if (textDensity < 8) { score += 0.1 }

  // Generic type + low confidence often indicates design background
  if (block.type === 'unknown' && cov > 0.3) { score += 0.15; reasons.push('unknown type large') }
  if (block.type === 'paragraph' && cov > 0.5 && textDensity < 5) { score += 0.2; reasons.push('paragraph huge sparse') }

  // Backgrounds often are behind many other blocks (high overlap count)
  let overlapCount = 0
  for (const other of allBlocks) {
    if (other.block_id === block.block_id) continue
    const inter = intersectionArea(block.bbox, other.bbox)
    if (inter / area(other.bbox) > 0.5) overlapCount++
  }
  if (overlapCount >= 3) { score += 0.25; reasons.push(`contains ${overlapCount} elements`) }
  else if (overlapCount >= 1) { score += 0.1 }

  // Area ratio from meta if available (rendered vs bbox)
  const metaAreaRatio = block.meta?.area_ratio as number | undefined
  if (metaAreaRatio !== undefined && metaAreaRatio > 0.8) { score += 0.1; reasons.push('area_ratio high') }

  return { block, score: Math.min(1, score), reasons }
}

export function detectBackgrounds(
  blocks: CoarseBlock[],
  pageWidth: number,
  pageHeight: number,
  _pageNum: number,
  threshold = 0.55,
): AtomicElement[] {
  const candidates = blocks.map(b => scoreBackground(b, pageWidth, pageHeight, blocks))
  // Only one background per page typically; take highest scoring >threshold
  const sorted = candidates.filter(c => c.score >= threshold).sort((a, b) => b.score - a.score)
  if (!sorted.length) return []

  // Take up to 2 backgrounds max (e.g., left/right page decoration)
  const selected = sorted.slice(0, 2)
  return selected.map(c => ({
    id: nextBgId(c.block.page),
    type: 'background' as const,
    bbox: c.block.bbox,
    confidence: c.score,
    source: 'hybrid' as const,
    detectors: ['background-detector', c.block.source ?? 'layout'],
    page: c.block.page,
    isAtomic: true,
    rawBbox: c.block.bbox,
    text: undefined,
    // Store provenance reasons in color field for debug (or metadata extension)
  }))
}

/**
 * Filter out background elements from entering exercise pipeline.
 * Returns partitioned { backgrounds, content }.
 */
export function partitionBackgrounds(elements: AtomicElement[]): { backgrounds: AtomicElement[]; content: AtomicElement[] } {
  const backgrounds = elements.filter(e => e.type === 'background')
  const content = elements.filter(e => e.type !== 'background')
  return { backgrounds, content }
}
