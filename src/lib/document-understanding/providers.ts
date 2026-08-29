/**
 * Provider Architecture — interchangeable detectors for:
 *   Layout Detection, OCR, Vision, Document Understanding
 *
 * Allows fallback based on document type and confidence.
 * Do not automatically run every provider on every page.
 */

export interface ProviderSpec {
  name: string
  envFlag?: string // env var that enables it, e.g. GOOGLE_APPLICATION_CREDENTIALS
  available: () => boolean
  priority: number // lower = higher priority
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

export const LAYOUT_PROVIDERS: ProviderSpec[] = [
  { name: 'google_docai_layout', envFlag: 'GOOGLE_APPLICATION_CREDENTIALS', available: isGoogleDocAILayoutAvailable, priority: 1 },
  { name: 'paddle_ppstructure', envFlag: 'PADDLE_AVAILABLE', available: () => false, priority: 2 },
  { name: 'surya_layout', envFlag: 'SURYA_AVAILABLE', available: () => false, priority: 3 },
  { name: 'pdf_native', envFlag: undefined, available: () => true, priority: 4 },
  { name: 'heuristic', envFlag: undefined, available: () => true, priority: 99 },
]

export const OCR_PROVIDERS: ProviderSpec[] = [
  { name: 'google_docai_ocr', envFlag: 'GOOGLE_APPLICATION_CREDENTIALS', available: isGoogleDocAIOCRAvailable, priority: 1 },
  { name: 'google_vision', envFlag: 'GOOGLE_VISION_KEY', available: () => Boolean(process.env.GOOGLE_VISION_KEY), priority: 2 },
  { name: 'paddle_ocr', envFlag: undefined, available: () => false, priority: 3 },
  { name: 'surya_ocr', envFlag: undefined, available: () => false, priority: 4 },
  { name: 'tesseract', envFlag: undefined, available: () => true, priority: 5 },
]

export function selectProvider(specs: ProviderSpec[]): ProviderSpec | null {
  const sorted = [...specs].sort((a, b) => a.priority - b.priority)
  for (const s of sorted) {
    if (s.available()) return s
  }
  return null
}

export function providerFallbackChain(specs: ProviderSpec[]): ProviderSpec[] {
  return [...specs].sort((a, b) => a.priority - b.priority).filter(s => s.available() || s.name === 'heuristic' || s.name === 'pdf_native' || s.name === 'tesseract')
}

export interface ProviderTelemetry {
  provider: string
  duration_ms: number
  confidence: number
  status: 'ok' | 'fallback' | 'failed'
  reason?: string
}
