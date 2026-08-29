/** OCR / Vision provider contracts — fallback hierarchy.

Spec 14 requires providers to be interchangeable and not run on every page.
Selection strategy:

  digital PDF with text layer → PDF-native (pdfjs) only, no OCR
  scanned/image PDF           → OCR per-block (Surya/Paddle/Vision)
  visual regions              → Vision on image crops only

This file codifies the fallback order and cheap-provenance logic.
*/

export type OcrProvider = 'text_layer' | 'surya' | 'paddle' | 'google_vision' | 'hybrid'
export type VisionProvider = 'vision' | 'fallback' | 'none'

export function ocrProviderOrder(): OcrProvider[] {
  const raw = process.env.OCR_PROVIDER_ORDER ?? 'text_layer,surya,paddle'
  return raw.split(',').map((s)=> s.trim() as OcrProvider).filter(Boolean)
}

export function shouldOcr(hasTextLayer: boolean, blockType: string): boolean {
  if (hasTextLayer && blockType !== 'image') return false // prefer PDF-native
  if (blockType === 'image') return false // vision, not OCR
  return true
}

export function visionBudget(): number {
  return Number(process.env.IMAGE_VISION_MAX_PER_DOC ?? 12)
}
