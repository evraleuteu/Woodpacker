export const EXTRACTION_ENGINES = [
  'LLM_VISION',
  'DOCLING',
  'PYMUPDF',
  'SURYA',
  'PP_STRUCTURE',
  'GOOGLE_DOC_AI',
] as const

export type ExtractionEngine = (typeof EXTRACTION_ENGINES)[number]
export type BenchmarkStatus = 'pending' | 'running' | 'completed' | 'failed'
export type ResultStatus = 'pending' | 'running' | 'completed' | 'failed'

export type BoundingBox = { x: number; y: number; width: number; height: number }
export type BlockType = 'title' | 'heading' | 'paragraph' | 'text' | 'list' | 'table' | 'image' | 'formula' | 'exercise' | 'answer' | 'caption' | 'header' | 'footer' | 'unknown'

export interface NormalizedBlock {
  id: string
  pageNumber: number
  type: BlockType
  text?: string
  bbox?: BoundingBox
  confidence?: number
  readingOrder?: number
}

export interface NormalizedExtraction {
  pages: Array<{ pageNumber: number; text?: string }>
  blocks: NormalizedBlock[]
  tables: NormalizedBlock[]
  images: NormalizedBlock[]
  exercises: NormalizedBlock[]
  text: string
  metadata: { pageCount: number; language?: string }
}

export interface BenchmarkMetrics {
  durationMs: number
  ocrCoverage: number
  textLength: number
  blockCount: number
  avgConfidence: number | null
  tablesFound: number
  imagesFound: number
  exerciseRegions: number
  readingOrderScore: number | null
  estimatedCost: number
}

export interface BenchmarkResult {
  engine: ExtractionEngine
  status: ResultStatus
  startedAt?: string
  completedAt?: string
  durationMs?: number
  error?: string
  rawOutput?: unknown
  normalizedOutput?: NormalizedExtraction
  metrics?: BenchmarkMetrics
}

export interface BenchmarkRun {
  id: string
  originalFileName: string
  fileSize: number
  pageCount: number
  createdAt: string
  status: BenchmarkStatus
  results: BenchmarkResult[]
}
