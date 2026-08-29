/**
 * Google Document AI Provider for TypeScript
 *
 * Supports both OCR and Layout processors:
 * - OCR Processor: text extraction from scanned/image PDFs
 * - Layout Processor: document structure detection (blocks, tables, forms, etc.)
 *
 * Uses google-cloud-documentai v12+ client library.
 * Processor IDs come from environment variables, never hardcoded.
 */

import type { CoarseRegion, BBox } from '../types'

export type DocAIProcessorType = 'ocr' | 'layout'

export interface DocAIConfig {
  projectId: string
  location: string
  ocrProcessorId: string
  layoutProcessorId: string
  credentialsPath?: string
}

export interface DocAIBlock {
  bbox: BBox
  type: string
  confidence: number
  text: string
  styleType?: string
}

let _docAIClient: any = null
let _config: DocAIConfig | null = null

export function getConfig(): DocAIConfig {
  if (!_config) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT
    const location = process.env.DOCAI_LOCATION || 'eu'
    const ocrProcessorId = process.env.DOCAI_OCR_PROCESSOR_ID
    const layoutProcessorId = process.env.DOCAI_LAYOUT_PROCESSOR_ID
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

    if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT not configured')
    if (!ocrProcessorId) throw new Error('DOCAI_OCR_PROCESSOR_ID not configured')
    if (!layoutProcessorId) throw new Error('DOCAI_LAYOUT_PROCESSOR_ID not configured')
    if (!credentialsPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS not configured')

    _config = { projectId, location, ocrProcessorId, layoutProcessorId, credentialsPath }
  }
  return _config
}

export function getClient(): any {
  if (!_docAIClient) {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai')
    const config = getConfig()
    const opts = {
      apiEndpoint: `${config.location}-documentai.googleapis.com`,
    }
    _docAIClient = new DocumentProcessorServiceClient(opts)
  }
  return _docAIClient
}

function getProcessorName(config: DocAIConfig, type: DocAIProcessorType): string {
  const processorId = type === 'ocr' ? config.ocrProcessorId : config.layoutProcessorId
  return `projects/${config.projectId}/locations/${config.location}/processors/${processorId}`
}

// DocAI style type -> block taxonomy mapping
const STYLE_MAP: Record<string, string> = {
  TITLE: 'heading',
  HEADING: 'subtitle',
  PARAGRAPH: 'paragraph',
  HEADER: 'header',
  FOOTER: 'footer',
  PAGE_NUMBER: 'page_number',
  CAPTION: 'caption',
  TABLE: 'table',
  FORM: 'answer_area',
  PICTURE: 'image',
  LIST: 'list',
  LIST_ITEM: 'list_item',
}

function clampBBox(bbox: BBox, width: number, height: number): BBox {
  const x0 = Math.max(0, Math.min(bbox[0], width - 1))
  const y0 = Math.max(0, Math.min(bbox[1], height - 1))
  const x1 = Math.max(x0 + 1, Math.min(bbox[2], width))
  const y1 = Math.max(y0 + 1, Math.min(bbox[3], height))
  return [x0, y0, x1, y1]
}

async function processDocumentWithDocAI(
  fileBuffer: Buffer,
  mimeType: string,
  processorType: DocAIProcessorType
): Promise<any> {
  const client = getClient()
  const config = getConfig()
  const processorName = getProcessorName(config, processorType)

  const rawDocument = {
    content: fileBuffer,
    mimeType,
  }

  const request = {
    name: processorName,
    rawDocument,
  }

  const [result] = await client.processDocument(request)
  return result.document
}

export async function detectLayoutWithDocAI(
  fileBuffer: Buffer,
  mimeType: string,
  pageWidth: number,
  pageHeight: number
): Promise<CoarseRegion[]> {
  const document = await processDocumentWithDocAI(fileBuffer, mimeType, 'layout')
  const regions: CoarseRegion[] = []

  const pages = document.pages || []
  const layoutBlocks = document.documentLayout?.blocks || document.document_layout?.blocks || []
  const blocksByPage = new Map<number, any[]>()
  for (const block of layoutBlocks) {
    const start = block.pageSpan?.pageStart || block.page_span?.page_start || 1
    const end = block.pageSpan?.pageEnd || block.page_span?.page_end || start
    for (let pageNumber = start; pageNumber <= end; pageNumber++) {
      const blocks = blocksByPage.get(pageNumber) || []
      blocks.push(block)
      blocksByPage.set(pageNumber, blocks)
    }
  }

  const responsePages = pages.length > 0
    ? pages.map((page: any) => ({ pageNumber: page.pageNumber || 1, blocks: page.blocks || blocksByPage.get(page.pageNumber || 1) || [] }))
    : [{ pageNumber: 1, blocks: layoutBlocks }]

  for (const page of responsePages) {
    const pageBlocks = page.blocks

    for (const block of pageBlocks) {
      const layout = block.layout
      const payload = block.textBlock || block.text_block || block.tableBlock || block.table_block || block.listBlock || block.list_block || block.imageBlock || block.image_block
      const boundingPoly = layout?.boundingPoly || layout?.bounding_poly || block.boundingBox || block.bounding_box
      if (!boundingPoly) continue

      const normalizedVertices = boundingPoly.normalizedVertices || boundingPoly.normalized_vertices || []
      const vertices = normalizedVertices.length > 0 ? normalizedVertices : (boundingPoly.vertices || [])
      if (vertices.length < 2) continue

      const scale = normalizedVertices.length > 0
      const xs = vertices.map((v: any) => v.x * (scale ? pageWidth : 1))
      const ys = vertices.map((v: any) => v.y * (scale ? pageHeight : 1))
      const bbox: BBox = clampBBox(
        [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        pageWidth,
        pageHeight
      )

      let styleType = ''
      try {
        styleType = layout?.type || layout?.type_ || payload?.type || payload?.type_ || ''
        if (!styleType && block.tableBlock) styleType = 'TABLE'
        if (!styleType && block.listBlock) styleType = 'LIST'
        if (!styleType && block.imageBlock) styleType = 'PICTURE'
      } catch {
        styleType = ''
      }

      let text = ''
      try {
        const segments = layout?.textAnchor?.textSegments || layout?.text_anchor?.text_segments || []
        if (segments.length > 0) {
          const start = segments[0].startIndex || 0
          const end = segments[segments.length - 1].endIndex || start
          text = (document.text || '').slice(start, end).trim()
        }
        if (!text && payload?.text) text = String(payload.text).trim()
        if (!text && payload?.caption) text = String(payload.caption).trim()
        if (!text && payload?.imageText) text = String(payload.imageText).trim()
        if (!text && payload?.image_text) text = String(payload.image_text).trim()
      } catch {
        text = ''
      }
      
      const conf = layout?.confidence || 0.9
      const styleKey = styleType.toUpperCase()
      const hint = STYLE_MAP[styleKey] || (styleKey.startsWith('HEADING') ? 'heading' : text ? 'paragraph' : 'unknown')

      if (hint === 'unknown' && !text) continue

      regions.push({
        bbox,
        type: hint as any,
        confidence: Math.max(0.3, Math.min(1.0, conf)),
        source: 'google_docai_layout',
        text,
        meta: { styleType, page: page.pageNumber },
      })
    }
  }

  return regions
}

export async function extractTextWithDocAI(
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ text: string; pages: Array<{ pageNumber: number; text: string }> }> {
  const document = await processDocumentWithDocAI(fileBuffer, mimeType, 'ocr')

  const pages: Array<{ pageNumber: number; text: string }> = []
  let fullText = ''

  for (const page of document.pages || []) {
    let pageText = ''
    for (const block of page.blocks || []) {
      const layout = block.layout
      if (!layout) continue

      try {
        const segments = layout.textAnchor?.textSegments || []
        if (segments.length > 0) {
          const start = segments[0].startIndex || 0
          const end = segments[segments.length - 1].endIndex || start
          const blockText = (document.text || '').slice(start, end).trim()
          if (blockText) {
            pageText += blockText + '\n'
          }
        }
      } catch {
        // continue
      }
    }
    if (pageText.trim()) {
      pages.push({ pageNumber: page.pageNumber || pages.length + 1, text: pageText.trim() })
      fullText += pageText + '\n\n'
    }
  }

  return { text: fullText.trim(), pages }
}

export function isGoogleDocAIAvailable(): boolean {
  try {
    const config = getConfig()
    require('@google-cloud/documentai')
    return true
  } catch {
    return false
  }
}

export function getDocAIStatus(): { available: boolean; reason?: string } {
  try {
    getConfig()
    require('@google-cloud/documentai')
    return { available: true }
  } catch (e: any) {
    return { available: false, reason: e.message }
  }
}

export function isGoogleDocAILayoutAvailable(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    process.env.GOOGLE_CLOUD_PROJECT &&
    process.env.DOCAI_LAYOUT_PROCESSOR_ID
  )
}

export function isGoogleDocAIOCRAvailable(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    process.env.GOOGLE_CLOUD_PROJECT &&
    process.env.DOCAI_OCR_PROCESSOR_ID
  )
}
