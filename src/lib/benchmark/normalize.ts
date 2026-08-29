import type { BlockType, BoundingBox, ExtractionEngine, NormalizedBlock, NormalizedExtraction } from './types'

type JsonObject = Record<string, unknown>

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function objectOf(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {}
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toBbox(value: unknown): BoundingBox | undefined {
  const box = arrayOf(value)
  if (box.length < 4) return undefined
  const [x1, y1, x2, y2] = box.map((item) => number(item, Number.NaN))
  if (![x1, y1, x2, y2].every(Number.isFinite)) return undefined
  return { x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) }
}

export function normalizeConfidence(_engine: ExtractionEngine, raw: unknown): number | undefined {
  const value = number(raw, -1)
  if (value < 0) return undefined
  return value > 1 ? Math.max(0, Math.min(1, value / 100)) : value
}

export function normalizeExtraction(raw: unknown, engine: ExtractionEngine): NormalizedExtraction {
  const source = objectOf(raw)
  // Woodpacker Extraction Service wraps the payload in { result: {...} }
  const layout = objectOf(source.result)
  // Docling service wraps the payload in { success, document: {...} }
  const docling = objectOf(source.document)

  const blocks: NormalizedBlock[] = []

  const addBlocks = (items: unknown[], typeFallback: BlockType) => {
    items.forEach((item, index) => {
      const value = objectOf(item)
      const pageNumber = Math.max(
        1,
        Math.floor(number(value.pageNumber ?? value.page ?? value.page_num, 1)),
      )
      const type = (textOf(value.type).toLowerCase() || typeFallback) as BlockType
      const confidence = normalizeConfidence(engine, value.confidence)
      const block: NormalizedBlock = {
        id:
          textOf(value.id ?? value.image_id ?? value.block_id) ||
          `${engine.toLowerCase()}-${index + 1}`,
        pageNumber,
        type,
        readingOrder: number(value.readingOrder ?? value.order, index),
      }
      const text = textOf(value.text ?? value.content)
      if (text) block.text = text
      const bbox = toBbox(value.bbox)
      if (bbox) block.bbox = bbox
      if (confidence !== undefined) block.confidence = confidence
      blocks.push(block)
    })
  }

  addBlocks(arrayOf(layout.layout_blocks), 'text')
  addBlocks(arrayOf(docling.blocks), 'text')
  addBlocks(arrayOf(source.blocks), 'text')
  addBlocks(arrayOf(source.elements), 'text')
  addBlocks(arrayOf(layout.images), 'image')
  addBlocks(arrayOf(layout.exercises), 'exercise')

  const pageCountCandidate = Math.max(
    1,
    ...blocks.map((block) => block.pageNumber),
    ...arrayOf(docling.pages).map((page) => Math.floor(number(objectOf(page).page, 1))),
  )
  const pageCount = Math.max(
    1,
    Math.floor(number(source.pageCount ?? source.page_count, pageCountCandidate)),
  )

  const blockText = blocks
    .map((block) => block.text ?? '')
    .filter(Boolean)
    .join('\n')
  const text = textOf(source.text ?? source.content) || textOf(docling.markdown) || blockText

  const pages = Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1
    return {
      pageNumber,
      text: blocks
        .filter((block) => block.pageNumber === pageNumber)
        .map((block) => block.text ?? '')
        .filter(Boolean)
        .join('\n'),
    }
  })

  return {
    pages,
    blocks,
    tables: blocks.filter((block) => block.type === 'table'),
    images: blocks.filter((block) => block.type === 'image'),
    exercises: blocks.filter((block) => block.type === 'exercise'),
    text,
    metadata: {
      pageCount,
      language: textOf(source.language) || textOf(objectOf(docling.metadata).language) || undefined,
    },
  }
}
