import type { BBox } from './types'

export function area(b: BBox): number {
  const w = Math.max(0, b[2] - b[0])
  const h = Math.max(0, b[3] - b[1])
  return w * h
}

export function intersect(a: BBox, b: BBox): BBox | null {
  const x0 = Math.max(a[0], b[0])
  const y0 = Math.max(a[1], b[1])
  const x1 = Math.min(a[2], b[2])
  const y1 = Math.min(a[3], b[3])
  if (x1 <= x0 || y1 <= y0) return null
  return [x0, y0, x1, y1]
}

export function intersectionArea(a: BBox, b: BBox): number {
  const inter = intersect(a, b)
  return inter ? area(inter) : 0
}

export function iou(a: BBox, b: BBox): number {
  const inter = intersectionArea(a, b)
  if (inter === 0) return 0
  const union = area(a) + area(b) - inter
  return union === 0 ? 0 : inter / union
}

export function containment(inner: BBox, outer: BBox): number {
  const inter = intersectionArea(inner, outer)
  const innerArea = area(inner)
  return innerArea === 0 ? 0 : inter / innerArea
}

export function containsPoint(b: BBox, x: number, y: number): boolean {
  return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]
}

export function center(b: BBox): [number, number] {
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]
}

export function distance(a: BBox, b: BBox): number {
  const [ax, ay] = center(a)
  const [bx, by] = center(b)
  return Math.hypot(ax - bx, ay - by)
}

export function expand(b: BBox, pad: number): BBox {
  return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad]
}

export function mergeBoxes(boxes: BBox[]): BBox | null {
  if (!boxes.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const b of boxes) {
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3])
  }
  return [x0, y0, x1, y1]
}

export function normalizeToPage(b: BBox, pageWidth: number, pageHeight: number): BBox {
  return [
    Math.max(0, Math.min(pageWidth, b[0])),
    Math.max(0, Math.min(pageHeight, b[1])),
    Math.max(0, Math.min(pageWidth, b[2])),
    Math.max(0, Math.min(pageHeight, b[3])),
  ]
}

/**
 * Page coverage ratio 0..1
 */
export function coverage(b: BBox, pageWidth: number, pageHeight: number): number {
  const pageArea = pageWidth * pageHeight
  return pageArea === 0 ? 0 : area(b) / pageArea
}

/**
 * Classify overlap relationship
 */
export type OverlapRelation = 'disjoint' | 'intersect' | 'contains' | 'contained' | 'duplicate' | 'identical'

export function overlapRelation(a: BBox, b: BBox, opts?: { iouThreshold?: number; containmentThreshold?: number }): OverlapRelation {
  const iouThresh = opts?.iouThreshold ?? 0.9
  const containThresh = opts?.containmentThreshold ?? 0.95
  const i = iou(a, b)
  if (i > iouThresh) return 'duplicate'
  if (JSON.stringify(a) === JSON.stringify(b)) return 'identical'
  const cA = containment(a, b)
  const cB = containment(b, a)
  if (cA > containThresh) return 'contained' // a inside b
  if (cB > containThresh) return 'contains' // a contains b
  if (i > 0.01) return 'intersect'
  return 'disjoint'
}
