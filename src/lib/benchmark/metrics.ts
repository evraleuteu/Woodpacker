import { ENGINE_COST_CONFIG } from './config'
import type { BenchmarkMetrics, ExtractionEngine, NormalizedExtraction } from './types'

export function calculateMetrics(engine: ExtractionEngine, extraction: NormalizedExtraction, durationMs: number): BenchmarkMetrics {
  const pagesWithText = extraction.pages.filter((page) => Boolean(page.text?.trim())).length
  const confidenceValues = extraction.blocks.map((block) => block.confidence).filter((value): value is number => value !== undefined)
  const ordered = extraction.blocks.filter((block) => block.readingOrder !== undefined)
  const readingOrderScore = ordered.length > 1 ? ordered.reduce((score, block, index) => score + (index === 0 || (block.pageNumber > ordered[index - 1].pageNumber || (block.readingOrder ?? 0) >= (ordered[index - 1].readingOrder ?? 0)) ? 1 : 0), 0) / ordered.length : null
  const cost = ENGINE_COST_CONFIG[engine]
  return { durationMs, ocrCoverage: extraction.metadata.pageCount ? pagesWithText / extraction.metadata.pageCount : 0, textLength: extraction.text.length, blockCount: extraction.blocks.length, avgConfidence: confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : null, tablesFound: extraction.tables.length, imagesFound: extraction.images.length, exerciseRegions: extraction.exercises.length, readingOrderScore, estimatedCost: extraction.metadata.pageCount * (cost.apiPerPage + cost.computePerPage) }
}
