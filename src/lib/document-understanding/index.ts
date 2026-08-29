/** Public entry point for the hierarchical document-understanding pipeline.
 *
 * Usage:
 *   import { runDocumentUnderstanding, buildMockCoverPage } from '@/lib/document-understanding'
 *   const result = await runDocumentUnderstanding(pages, { fileId, filename })
 *
 * The pipeline is provider-agnostic. Pass RawPage[] built from either:
 *   - pdfjs-dist + PostScript font analysis (PDF-native, preferred)
 *   - Surya / Paddle OCR fallback (scanned PDFs)
 *   - or mocked pages for tests (buildMockCoverPage)
 *
 * Consumers must read atomicElements + semanticGroups (not raw coarse boxes).
 */

export * from './types'
export * from './atomic'
export * from './overlap'
export * from './classification'
export * from './readingOrder'
export * from './grouping'
export * from './metrics'
export * from './pipeline'
