/**
 * PDF-native extraction layer — prefer native PDF information over OCR for digital PDFs.
 *
 * Extracts: words, spans, lines, blocks, fonts, sizes, images, vector objects
 * Used as primary source for digitally generated PDFs.
 */
import type { BBox, FontInfo, TextSpan, TextLine, PageGeometry, CoarseBlock } from './types'

// pdfjs-dist is optional — we degrade gracefully if not available in current runtime.
// In Next.js Node we use dynamic import to avoid worker setup.
let pdfjsLib: any | null = null
async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib
  try {
    // Use legacy build for Node compatibility
    // @ts-ignore - pdfjs types not provided for mjs
    const mod = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjsLib = mod
    return pdfjsLib
  } catch {
    try {
      // @ts-ignore
      const mod2 = await import('pdfjs-dist/build/pdf.mjs')
      pdfjsLib = mod2
      return pdfjsLib
    } catch {
      return null
    }
  }
}

export interface PdfNativePage {
  pageNumber: number
  width: number
  height: number
  words: TextSpan[]
  lines: TextLine[]
  blocks: CoarseBlock[]
  images: Array<{ bbox: BBox; ext: string; id: string }>
  textDensity: number // 0..1 words per 1000pt^2
  isScanned: boolean
  fonts: Map<string, FontInfo>
}

/**
 * Extract native PDF geometry from a PDF buffer.
 * Returns per-page structured data. Falls back to empty if pdfjs unavailable.
 */
export async function extractPdfNative(buffer: Uint8Array | ArrayBuffer): Promise<PdfNativePage[]> {
  const lib = await getPdfjs()
  if (!lib) {
    console.warn('[pdf-native] pdfjs-dist not available, returning empty')
    return []
  }

  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const loadingTask = lib.getDocument({ data, verbosity: 0 })
  const pdf = await loadingTask.promise
  const pages: PdfNativePage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.0 })
    const width = viewport.width
    const height = viewport.height

    // Extract text content with detailed geometry
    const textContent: any = await page.getTextContent()

    const words: TextSpan[] = []
    const fonts = new Map<string, FontInfo>()

    // textContent.items have transform [a,b,c,d,e,f] and width,height,str,fontName
    for (const item of textContent.items as Array<any>) {
      if (!item.str || !item.str.trim()) continue
      const tx = item.transform as number[] // [a,b,c,d,e,f]
      // PDF coords: origin bottom-left, but pdfjs viewport already flips y
      // Use transform to compute bbox
      const x = tx[4]
      // pdfjs already accounts for viewport, but transform y is bottom
      // For simplicity use viewport conversion: y is from top in pdfjs viewport
      const y = viewport.height - tx[5] - (item.height ?? 10)
      const fontSize = Math.hypot(tx[0], tx[1]) // approx
      const w = item.width ?? (item.str.length * fontSize * 0.6)
      const h = item.height ?? fontSize
      const bbox: BBox = [x, y, x + w, y + h]

      const fontInfo: FontInfo = {
        name: item.fontName ?? 'unknown',
        family: (item.fontName ?? 'unknown').split('+').pop() ?? 'unknown',
        size: fontSize,
        weight: (item.fontName ?? '').toLowerCase().includes('bold') ? 'bold' : 'normal',
        style: (item.fontName ?? '').toLowerCase().includes('italic') ? 'italic' : 'normal',
        color: undefined,
      }
      fonts.set(fontInfo.name, fontInfo)

      words.push({
        text: item.str,
        bbox,
        font: fontInfo,
        confidence: 1.0,
      })
    }

    // Group words into lines via y-clustering (within 2pt) then x-sorted
    const lines = clusterWordsToLines(words, viewport.height)

    // Group lines into blocks via vertical gap clustering
    const blocks = clusterLinesToBlocks(lines, i, width, height)

    // Extract images via operatorList (optional, may be empty)
    const images: Array<{ bbox: BBox; ext: string; id: string }> = []
    try {
      const opList = await page.getOperatorList()
      // Scan for paintImage ops; approximate bbox not available without rendering — stub
      // For native geometry we rely on blocks above; images will be enriched via vision/layout provider
      if (opList && (opList as any).fnArray) {
        // no-op, placeholder for future image bbox extraction via canvas
      }
    } catch {
      // ignore
    }

    const textDensity = words.length / (width * height / 1000) // words per 1000pt²
    const isScanned = words.length < 10 && textDensity < 0.05 // heuristic: scanned pages have sparse native text

    pages.push({
      pageNumber: i,
      width,
      height,
      words,
      lines,
      blocks,
      images,
      textDensity,
      isScanned,
      fonts,
    })
  }

  await pdf.cleanup()
  return pages
}

function clusterWordsToLines(words: TextSpan[], _pageHeight: number): TextLine[] {
  if (!words.length) return []
  // Sort by y (top) then x
  const sorted = [...words].sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0])
  const lines: TextSpan[][] = []
  let current: TextSpan[] = [sorted[0]]
  let currentY = sorted[0].bbox[1]
  let currentH = sorted[0].bbox[3] - sorted[0].bbox[1]

  for (let i = 1; i < sorted.length; i++) {
    const w = sorted[i]
    const y = w.bbox[1]
    const h = w.bbox[3] - w.bbox[1]
    // If y within ~40% of line height, same line
    const avgH = (currentH + h) / 2
    if (Math.abs(y - currentY) < avgH * 0.4) {
      current.push(w)
      currentY = Math.min(currentY, y)
      currentH = Math.max(currentH, h)
    } else {
      lines.push(current)
      current = [w]
      currentY = y
      currentH = h
    }
  }
  if (current.length) lines.push(current)

  return lines.map((ws, idx) => {
    ws.sort((a, b) => a.bbox[0] - b.bbox[0])
    const text = ws.map(w => w.text).join(' ')
    const x0 = Math.min(...ws.map(w => w.bbox[0]))
    const y0 = Math.min(...ws.map(w => w.bbox[1]))
    const x1 = Math.max(...ws.map(w => w.bbox[2]))
    const y1 = Math.max(...ws.map(w => w.bbox[3]))
    const bbox: BBox = [x0, y0, x1, y1]
    return {
      text,
      bbox,
      spans: ws,
      confidence: 1.0,
    }
  })
}

function clusterLinesToBlocks(lines: TextLine[], pageNum: number, width: number, height: number): CoarseBlock[] {
  if (!lines.length) return []
  // Sort lines top->bottom, left->right
  const sorted = [...lines].sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0])
  const blocks: TextLine[][] = []
  let current: TextLine[] = [sorted[0]]
  let lastY1 = sorted[0].bbox[3]
  let lastX0 = sorted[0].bbox[0]

  for (let i = 1; i < sorted.length; i++) {
    const ln = sorted[i]
    const gapY = ln.bbox[1] - lastY1
    const deltaX = Math.abs(ln.bbox[0] - lastX0)
    // Heuristic: large vertical gap or significant x shift => new block
    const avgH = (ln.bbox[3] - ln.bbox[1] + (current[current.length - 1].bbox[3] - current[current.length - 1].bbox[1])) / 2
    if (gapY > avgH * 1.2 || gapY > 18) {
      blocks.push(current)
      current = [ln]
    } else if (deltaX > width * 0.3 && gapY < 5) {
      // Column break? keep same block but note - for now new block
      blocks.push(current)
      current = [ln]
    } else {
      current.push(ln)
    }
    lastY1 = ln.bbox[3]
    lastX0 = ln.bbox[0]
  }
  if (current.length) blocks.push(current)

  return blocks.map((ls, idx) => {
    const text = ls.map(l => l.text).join('\n')
    const x0 = Math.min(...ls.map(l => l.bbox[0]))
    const y0 = Math.min(...ls.map(l => l.bbox[1]))
    const x1 = Math.max(...ls.map(l => l.bbox[2]))
    const y1 = Math.max(...ls.map(l => l.bbox[3]))
    const bbox: BBox = [x0, y0, x1, y1]
    const spans = ls.flatMap(l => l.spans.map(s => ({
      text: s.text,
      bbox: s.bbox,
      font_name: s.font.name,
      font_size: s.font.size,
    })))
    const fontSizes = spans.map(s => s.font_size)
    const avgSize = fontSizes.length ? fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length : 12
    return {
      block_id: `pdf_block_p${pageNum}_${idx}`,
      page: pageNum,
      type: inferBlockTypeFromFonts(ls, avgSize),
      bbox,
      confidence: 0.98,
      text,
      spans,
      source: 'pdf',
      meta: {
        lines: ls.map(l => ({ bbox: l.bbox, text: l.text, span_indices: [] })),
        area_ratio: (x1 - x0) * (y1 - y0) / (width * height),
      },
    }
  })
}

function inferBlockTypeFromFonts(lines: TextLine[], avgSize: number): string {
  // Large font => heading
  if (avgSize > 16 && lines.length <= 2) return 'title'
  if (avgSize > 13 && lines.length <= 3) return 'subtitle'
  return 'paragraph'
}

/**
 * Quick check if pdf buffer is digitally generated (has extractable text)
 */
export function isDigitalPdf(pages: PdfNativePage[]): boolean {
  if (!pages.length) return false
  const scannedCount = pages.filter(p => p.isScanned).length
  return scannedCount < pages.length / 2
}
