/**
 * Tests for Provider Selection and Fallback Chain
 */

import { LAYOUT_PROVIDERS, OCR_PROVIDERS, selectProvider, providerFallbackChain } from '../providers'

describe('Provider Selection', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_APPLICATION_CREDENTIALS: '/fake/credentials.json',
      GOOGLE_CLOUD_PROJECT: 'test-project',
      DOCAI_LAYOUT_PROCESSOR_ID: 'layout-processor-id',
      DOCAI_OCR_PROCESSOR_ID: 'ocr-processor-id',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('Layout Providers', () => {
    it('should select google_docai_layout as first priority when configured', () => {
      const selected = selectProvider(LAYOUT_PROVIDERS)
      expect(selected?.name).toBe('google_docai_layout')
    })

    it('should fall back to pdf_native when google docai not configured', () => {
      delete process.env.DOCAI_LAYOUT_PROCESSOR_ID
      const selected = selectProvider(LAYOUT_PROVIDERS)
      expect(selected?.name).toBe('pdf_native')
    })

    it('should include all providers in fallback chain', () => {
      const chain = providerFallbackChain(LAYOUT_PROVIDERS)
      expect(chain.length).toBeGreaterThan(1)
      expect(chain.map(c => c.name)).toContain('google_docai_layout')
      expect(chain.map(c => c.name)).toContain('pdf_native')
      expect(chain.map(c => c.name)).toContain('heuristic')
    })
  })

  describe('OCR Providers', () => {
    it('should select google_docai_ocr as first priority when configured', () => {
      const selected = selectProvider(OCR_PROVIDERS)
      expect(selected?.name).toBe('google_docai_ocr')
    })

    it('should fall back to google_vision when configured', () => {
      delete process.env.DOCAI_OCR_PROCESSOR_ID
      process.env.GOOGLE_VISION_KEY = 'test-key'
      const selected = selectProvider(OCR_PROVIDERS)
      expect(selected?.name).toBe('google_vision')
    })

    it('should fall back to tesseract as last resort', () => {
      delete process.env.DOCAI_OCR_PROCESSOR_ID
      delete process.env.GOOGLE_VISION_KEY
      const selected = selectProvider(OCR_PROVIDERS)
      expect(selected?.name).toBe('tesseract')
    })

    it('should include all providers in fallback chain', () => {
      const chain = providerFallbackChain(OCR_PROVIDERS)
      expect(chain.length).toBeGreaterThan(1)
      expect(chain.map(c => c.name)).toContain('google_docai_ocr')
      expect(chain.map(c => c.name)).toContain('tesseract')
    })
  })

  describe('Priority Ordering', () => {
    it('should sort providers by priority', () => {
      const sorted = [...LAYOUT_PROVIDERS].sort((a, b) => a.priority - b.priority)
      expect(sorted[0].priority).toBeLessThanOrEqual(sorted[1].priority)
    })

    it('should have google_docai_layout at priority 1', () => {
      const googleProvider = LAYOUT_PROVIDERS.find(p => p.name === 'google_docai_layout')
      expect(googleProvider?.priority).toBe(1)
    })

    it('should have google_docai_ocr at priority 1', () => {
      const googleProvider = OCR_PROVIDERS.find(p => p.name === 'google_docai_ocr')
      expect(googleProvider?.priority).toBe(1)
    })
  })
})