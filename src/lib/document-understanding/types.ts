/** Hierarchical document understanding types — atomic pipeline.

Covers the required stages:
  PDF-native extraction (words/spans/lines/blocks/fonts) →
  OCR/Vision → Layout → Atomic Elements → Classification →
  Deduplication/Overlap → Reading Order → Semantic Groups → Exercise Extraction

All coordinates are in PDF points (or rendered pixels when dpi=RENDER) — consumers must
keep bbox semantics consistent. The pipeline preserves every layer for debug.
*/

export type BBox = [number, number, number, number]

export type ElementType =
  | 'text' | 'heading' | 'subtitle' | 'paragraph' | 'label' | 'caption'
  | 'list' | 'list_item' | 'question' | 'instruction' | 'answer' | 'exercise'
  | 'table' | 'table_cell' | 'image' | 'illustration' | 'photo' | 'diagram'
  | 'qr_code' | 'barcode' | 'audio_marker' | 'video_marker' | 'icon' | 'logo'
  | 'design_element' | 'level_badge' | 'section_marker' | 'decorative_shape'
  | 'background' | 'page_decoration' | 'header' | 'footer' | 'page_number'
  | 'media_marker' | 'unknown'

export type ElementSubtype =
  | 'title' | 'subtitle' | 'level_badge' | 'section_marker' | 'background'
  | 'qr_code' | 'audio' | 'video' | 'icon' | 'logo' | 'decoration' | string

export interface FontInfo {
  name?: string
  family?: string
  size?: number
  bold?: boolean
  italic?: boolean
  color?: string
}

export interface TextSpan {
  text: string
  bbox: BBox
  fontInfo?: FontInfo
  confidence?: number
}

export interface AtomicElement {
  id: string
  parentId?: string
  children?: string[]
  type: ElementType
  subtype?: ElementSubtype
  bbox: BBox
  text?: string
  confidence: number
  page: number
  source: 'pdf' | 'ocr' | 'vision' | 'layout' | 'hybrid'
  detectors?: string[]
  provenance?: string[]
  fontInfo?: FontInfo
  spans?: TextSpan[]
  lines?: { bbox: BBox; text: string }[]
  readingOrder?: number
  meta?: Record<string, unknown>
}

export interface SemanticGroup {
  id: string
  type: 'exercise' | 'section' | 'column' | 'table' | 'lesson' | 'page' | string
  memberIds: string[]
  bbox: BBox
  confidence: number
  label?: string
}

export interface CoarseRegion {
  bbox: BBox
  type: ElementType
  confidence: number
  source: string
  text?: string
  spans?: TextSpan[]
  lines?: { bbox: BBox; text: string; spanIndices?: number[] }[]
  meta?: Record<string, unknown>
}

export interface PageGeometry {
  page: number
  width: number
  height: number
  hasTextLayer: boolean
  regions: CoarseRegion[]
}

export interface DocumentUnderstandingResult {
  fileId: string
  filename: string
  pageCount: number
  // Every layer for debug toggle — required by spec section 18
  layers: {
    rawDetector: AtomicElement[]
    atomicElements: AtomicElement[]
    classifiedElements: AtomicElement[]
    resolvedElements: AtomicElement[]
    semanticGroups: SemanticGroup[]
    exercises: unknown[]
  }
  // The two top-level arrays that downstream reasoning consumes
  atomicElements: AtomicElement[]
  semanticGroups: SemanticGroup[]
  readingOrder: string[]
  evaluation: EvaluationMetrics
  quality: Record<string, unknown>
  telemetry: { node: string; durationMs: number; status: string }[]
}

export interface EvaluationMetrics {
  totalElements: number
  oversizedRegions: number
  oversizedRegionRate: number
  duplicateRate: number
  avgBboxAreaRatio: number
  atomicCoverage: number
  backgroundCount: number
  designCount: number
  elementPrecision: number
  elementRecall: number
  bboxIou: number
  classificationAccuracy: number
  readingOrderAccuracy: number
}

export interface ProviderOptions {
  layoutProvider?: 'pymupdf' | 'surya' | 'paddle' | 'documentai' | 'auto'
  ocrProvider?: 'text_layer' | 'surya' | 'paddle' | 'vision' | 'auto'
  visionProvider?: 'vision' | 'fallback' | 'none'
}

export function bboxArea(b: BBox): number {
  return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1])
}
export function bboxIntersection(a: BBox, b: BBox): number {
  const x0 = Math.max(a[0], b[0])
  const y0 = Math.max(a[1], b[1])
  const x1 = Math.min(a[2], b[2])
  const y1 = Math.min(a[3], b[3])
  if (x1 <= x0 || y1 <= y0) return 0
  return (x1 - x0) * (y1 - y0)
}
export function bboxIou(a: BBox, b: BBox): number {
  const inter = bboxIntersection(a, b)
  if (!inter) return 0
  const denom = bboxArea(a) + bboxArea(b) - inter
  return denom ? inter / denom : 0
}
export function containment(inner: BBox, outer: BBox): number {
  const ai = bboxArea(inner)
  if (!ai) return 0
  return bboxIntersection(inner, outer) / ai
}
export function clampBBox(b: BBox, w: number, h: number): BBox {
  const x0 = Math.max(0, Math.min(b[0], w - 1))
  const y0 = Math.max(0, Math.min(b[1], h - 1))
  const x1 = Math.max(x0 + 1, Math.min(b[2], w))
  const y1 = Math.max(y0 + 1, Math.min(b[3], h))
  return [x0, y0, x1, y1]
}
