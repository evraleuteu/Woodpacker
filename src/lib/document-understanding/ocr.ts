/**
 * OCR fallback layer — only where PDF-native fails.
 * Converts page/large-region OCR boxes into atomic text elements.
 */
import type { BBox, TextSpan, TextLine } from './types'

export interface OcrBlock {
  block_id: string
  page: number
  bbox: BBox
  text: string
  confidence: number
  paragraphs?: Array<{
    bbox: BBox
    lines: Array<{ bbox: BBox; words: Array<{ text: string; bbox: BBox; confidence: number }> }>
  }>
}

export interface OcrPageResult {
  page: number
  width: number
  height: number
  blocks: OcrBlock[]
  lines: TextLine[]
  words: TextSpan[]
  engine: string
}

/**
 * Stub OCR provider — in production this would call:
 * - Google Document AI
 * - PaddleOCR / PP-Structure
 * - Surya OCR
 * - Tesseract.js (fallback)
 *
 * For now, we expose the *interface* and provide a deterministic
 * decomposition helper that converts coarse OCR blocks into lines/words.
 */

/**
 * Decompose a coarse OCR block that contains merged lines into atomic lines.
 * Uses newline split + proportional bbox slicing when word geometry unavailable.
 */
export function decomposeOcrBlock(block: OcrBlock): TextLine[] {
  if (block.paragraphs?.length) {
    // Already hierarchical — flatten
    const out: TextLine[] = []
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        const text = line.words.map(w => w.text).join(' ')
        const words: TextSpan[] = line.words.map(w => ({
          text: w.text,
          bbox: w.bbox,
          font: { name: 'ocr', family: 'sans', size: 10, weight: 'normal', style: 'normal' },
          confidence: w.confidence,
        }))
        const bbox = line.bbox
        out.push({ text, bbox, spans: words, confidence: average(line.words.map(w => w.confidence)) })
      }
    }
    return out
  }

  // Fallback: split by newline and estimate bboxes proportionally
  const rawLines = block.text.split('\n').map(s => s.trim()).filter(Boolean)
  if (rawLines.length <= 1) {
    // Single line — treat whole block as one line, split into words proportionally
    const words = block.text.split(/\s+/).filter(Boolean)
    if (!words.length) return []
    const charCount = block.text.length || 1
    const totalW = block.bbox[2] - block.bbox[0]
    let x = block.bbox[0]
    const wordSpans: TextSpan[] = words.map(w => {
      const wW = (w.length / charCount) * totalW
      const bbox: BBox = [x, block.bbox[1], x + wW, block.bbox[3]]
      x += wW + (totalW - words.reduce((a, ww) => a + (ww.length / charCount) * totalW, 0)) / Math.max(1, words.length - 1)
      return {
        text: w,
        bbox,
        font: { name: 'ocr', family: 'sans', size: 10, weight: 'normal', style: 'normal' },
        confidence: block.confidence,
      }
    })
    return [{
      text: block.text,
      bbox: block.bbox,
      spans: wordSpans,
      confidence: block.confidence,
    }]
  }

  // Multi-line block — slice vertically
  const lineH = (block.bbox[3] - block.bbox[1]) / rawLines.length
  return rawLines.map((lineText, idx) => {
    const y0 = block.bbox[1] + idx * lineH
    const y1 = y0 + lineH
    const bbox: BBox = [block.bbox[0], y0, block.bbox[2], y1]
    const words = lineText.split(/\s+/).filter(Boolean)
    const charCount = lineText.length || 1
    const totalW = block.bbox[2] - block.bbox[0]
    let x = block.bbox[0]
    const spans: TextSpan[] = words.map(w => {
      const wW = (w.length / charCount) * totalW
      const wb: BBox = [x, y0, x + wW, y1]
      x += wW + 2 // small gap
      return {
        text: w,
        bbox: wb,
        font: { name: 'ocr', family: 'sans', size: 10, weight: 'normal', style: 'normal' },
        confidence: block.confidence,
      }
    })
    return { text: lineText, bbox, spans, confidence: block.confidence }
  })
}

function average(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

/**
 * Decide whether OCR is needed for a page based on native extraction.
 */
export function needsOcr(nativeWordCount: number, pageArea: number, threshold = 0.03): boolean {
  const density = nativeWordCount / (pageArea / 1000) // words per 1000pt²
  return density < threshold
}
