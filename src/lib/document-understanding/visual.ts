/**
 * Visual Element Detection — non-text objects independently.
 * Supports: image, illustration, photo, diagram, table, qr_code, barcode,
 * audio_marker, video_marker, icon, logo, design_element, background
 */
import type { AtomicElement, BBox, CoarseBlock } from './types'
import { area, coverage, iou } from './geometry'

let _visCounter = 0
function nextVisId(page: number, kind: string): string {
  return `vis_p${page}_${kind}_${++_visCounter}_${Math.random().toString(36).slice(2, 6)}`
}
export function resetVisualCounter() { _visCounter = 0 }

/**
 * Detect visual elements from coarse blocks + optional image list.
 * - QR codes should not become part of generic image region
 * - Photographs should not be merged into surrounding text
 */
export function detectVisualElements(
  blocks: CoarseBlock[],
  nativeImages: Array<{ bbox: BBox; ext: string; id: string }>,
  pageWidth: number,
  pageHeight: number,
  pageNum: number,
): AtomicElement[] {
  const out: AtomicElement[] = []

  // 1. Native images from PDF extraction (highest confidence)
  for (const img of nativeImages) {
    const cov = coverage(img.bbox, pageWidth, pageHeight)
    const isPhotoLike = area(img.bbox) > pageWidth * pageHeight * 0.04 && cov < 0.5
    out.push({
      id: nextVisId(pageNum, isPhotoLike ? 'photo' : 'image'),
      type: isPhotoLike ? 'photo' : 'image',
      subtype: isPhotoLike ? 'photo' : 'illustration',
      bbox: img.bbox,
      confidence: 0.97,
      source: 'pdf',
      detectors: ['pdf'],
      page: pageNum,
      isAtomic: true,
    })
  }

  // 2. Coarse blocks typed as image/table etc
  for (const b of blocks) {
    if (b.type === 'image') {
      // Avoid duplicate if native image already covers same bbox (IoU >0.7)
      const dup = nativeImages.some(img => iou(img.bbox, b.bbox) > 0.7)
      if (dup) continue

      const isIcon = Boolean(b.meta?.icon) || isIconHeuristic(b, pageWidth, pageHeight)
      const isQr = isQrHeuristic(b)
      const isLogo = isLogoHeuristic(b)

      let type: AtomicElement['type'] = 'image'
      let subtype: string | undefined
      let conf = b.confidence

      if (isQr) { type = 'qr_code'; subtype = 'qr_code'; conf = Math.max(conf, 0.92) }
      else if (isIcon) { type = 'icon'; subtype = 'icon'; conf = 0.88 }
      else if (isLogo) { type = 'logo'; subtype = 'logo'; conf = 0.85 }
      else if (b.type === 'image') { type = 'image'; subtype = 'photo' }

      out.push({
        id: nextVisId(pageNum, `${type}_${b.block_id}`),
        type,
        subtype,
        bbox: b.bbox,
        confidence: conf,
        source: (b.source as any) ?? 'layout',
        detectors: b.source ? [b.source, 'visual'] : ['visual'],
        page: pageNum,
        isAtomic: true,
        rawBbox: b.bbox,
      })
    } else if (b.type === 'table') {
      out.push({
        id: nextVisId(pageNum, `table_${b.block_id}`),
        type: 'table',
        bbox: b.bbox,
        confidence: b.confidence,
        source: (b.source as any) ?? 'layout',
        detectors: ['layout', 'visual'],
        page: pageNum,
        isAtomic: true,
        rawBbox: b.bbox,
      })
    }
  }

  // 3. QR / media markers that are textually referenced but lack bbox
  // We keep this stub for future extension where text like "QR" + icon proximity creates marker.
  // For now rely on b.meta.icon + isQrHeuristic

  return out
}

function isIconHeuristic(b: CoarseBlock, pageW: number, pageH: number): boolean {
  if (b.meta?.icon) return true
  const w = b.bbox[2] - b.bbox[0]
  const h = b.bbox[3] - b.bbox[1]
  const cov = coverage(b.bbox, pageW, pageH)
  // Icons are small, roughly square, small area
  if (w < 48 && h < 48 && Math.abs(w - h) < 10 && cov < 0.01) return true
  // Text minimal but labeled as image
  if ((b.text?.trim().length ?? 0) < 5 && area(b.bbox) < 2000) return true
  return false
}

function isQrHeuristic(b: CoarseBlock): boolean {
  const text = (b.text ?? '').toLowerCase()
  if (text.includes('qr') || text.includes('scan') || b.bbox[2] - b.bbox[0] < 80 && b.bbox[3] - b.bbox[1] < 80) {
    // Need more specific: QR often square ~50-90pt, dense
    const w = b.bbox[2] - b.bbox[0]
    const h = b.bbox[3] - b.bbox[1]
    if (Math.abs(w - h) < 12 && w > 30 && w < 110) {
      // Could be QR; require square + small
      // Check if block is in corner / near text "Audios und Videos"
      return true
    }
  }
  // Explicit icon with QR pattern would be tagged by provider; we treat any small square image as potential QR
  return false
}

function isLogoHeuristic(b: CoarseBlock): boolean {
  const w = b.bbox[2] - b.bbox[0]
  const h = b.bbox[3] - b.bbox[1]
  // Logos are typically top-of-page, small, horizontal
  if (b.bbox[1] < 60 && w > 80 && h < 50) return true
  return false
}
