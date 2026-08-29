/** Overlap resolution — type-pair aware deduplication.

Rules mirror Python atomic.py: never blindly NMS. Different pair types have
different semantics.

  text ↔ text        strong NMS (keep higher conf, or smaller if containment >0.85)
  text ↔ image       keep both when nesting (caption on image, badge)
  text ↔ design      nesting, not duplication
  image ↔ background background is parent layer
  QR ↔ image         QR wins when IoU>0.45
  table ↔ text       table wins when containment high, otherwise keep both (cell content)
*/

import type { AtomicElement, BBox } from './types'
import { bboxArea, bboxIou, containment } from './types'

function isTextType(t: string): boolean {
  return new Set(['paragraph','heading','subtitle','text','question','instruction','answer','label','caption','list_item','list','header','footer','page_number']).has(t)
}

export function resolveOverlaps(elements: AtomicElement[]): AtomicElement[] {
  if (elements.length <= 1) return elements
  const sorted = [...elements].sort((a, b) => b.confidence - a.confidence || bboxArea(a.bbox) - bboxArea(b.bbox))
  const keep: AtomicElement[] = []
  for (const cand of sorted) {
    let drop = false
    for (let k = 0; k < keep.length; k++) {
      const kept = keep[k]
      const iou = bboxIou(cand.bbox, kept.bbox)
      const containCandInKept = containment(cand.bbox, kept.bbox)
      const containKeptInCand = containment(kept.bbox, cand.bbox)
      const types = new Set([cand.type, kept.type])

      // background vs anything
      if (types.has('background')) {
        if (cand.type === 'background' && containKeptInCand < 0.05) continue
        if (kept.type === 'background' && containCandInKept > 0.5) {
          cand.meta = { ...(cand.meta ?? {}), parent_background: kept.id }
          continue
        }
        if (cand.type === 'background' && kept.type === 'background' && iou > 0.6) {
          if (bboxArea(cand.bbox) > bboxArea(kept.bbox)) { keep.splice(k, 1); break }
          else { drop = true; break }
        }
        continue
      }
      // QR ↔ image
      if ((types.has('qr_code') && types.has('image')) || (cand.type === 'qr_code' && kept.type === 'image') || (cand.type === 'image' && kept.type === 'qr_code')) {
        if (iou > 0.45) {
          if (cand.type === 'qr_code') { keep.splice(k, 1); break }
          else { drop = true; break }
        }
      }
      // design vs text nesting
      if ((cand.type === 'design_element' && isTextType(kept.type)) || (kept.type === 'design_element' && isTextType(cand.type))) {
        if (cand.type === 'design_element' && containKeptInCand > 0.85) {
          kept.meta = { ...(kept.meta ?? {}), parent_design: cand.id }
          continue
        }
        if (kept.type === 'design_element' && containCandInKept > 0.85) {
          cand.meta = { ...(cand.meta ?? {}), parent_design: kept.id }
          continue
        }
      }
      // text ↔ image nesting
      if (types.has('image') && (isTextType(cand.type) || isTextType(kept.type))) {
        if (iou > 0.35) {
          if (containCandInKept > 0.85 || containKeptInCand > 0.85) continue
          if (iou > 0.65 && cand.confidence < kept.confidence - 0.08) { drop = true; break }
        }
        continue
      }
      // table ↔ text
      if (types.has('table')) {
        if (containCandInKept > 0.8 || containKeptInCand > 0.8) continue
        if (iou > 0.5) {
          if (cand.type !== 'table' && kept.type === 'table') { drop = true; break }
          if (cand.type === 'table' && kept.type !== 'table') { keep.splice(k, 1); break }
        }
      }
      // text ↔ text strong dedup
      if (isTextType(cand.type) && isTextType(kept.type)) {
        if (iou > 0.5) { drop = true; break }
        if (containCandInKept > 0.92 || containKeptInCand > 0.92) {
          if (bboxArea(cand.bbox) < bboxArea(kept.bbox)) { keep.splice(k, 1); break }
          else { drop = true; break }
        }
        continue
      }
      if (cand.type === kept.type && iou > 0.6) { drop = true; break }
    }
    if (!drop) keep.push(cand)
  }
  return keep.sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0])
}
