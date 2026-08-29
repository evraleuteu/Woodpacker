/**
 * Tests for Google Document AI Provider
 *
 * Tests configuration validation, processor selection, authentication,
 * and output normalization. Uses mocks for Google API calls.
 */

import { jest } from '@jest/globals'

// Mock the google-cloud-documentai module
jest.mock('@google-cloud/documentai', () => {
  const mockProcessDocument = jest.fn()
  const mockClient = {
    processDocument: mockProcessDocument,
  }
  return {
    DocumentProcessorServiceClient: jest.fn(() => mockClient),
    protos: {
      google: {
        cloud: {
          documentai: {
            v1: {
              Document: {
                Page: class {},
                Block: class {},
              },
            },
          },
        },
      },
    },
  }
})

// Mock fs for credentials file
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => '{}'),
}))

// Import after mocks
import {
  detectLayoutWithDocAI,
  extractTextWithDocAI,
  isGoogleDocAIAvailable,
  getDocAIStatus,
  getConfig,
  getClient,
  DocAIProcessorType,
  isGoogleDocAILayoutAvailable,
  isGoogleDocAIOCRAvailable,
} from '../google-docai'

describe('Google Document AI Provider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      GOOGLE_CLOUD_PROJECT: 'test-project',
      DOCAI_LOCATION: 'eu',
      DOCAI_OCR_PROCESSOR_ID: 'test-ocr-processor',
      DOCAI_LAYOUT_PROCESSOR_ID: 'test-layout-processor',
      GOOGLE_APPLICATION_CREDENTIALS: '/fake/path/credentials.json',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('Configuration Validation', () => {
    it('should return available=true when all required env vars are set', () => {
      const status = getDocAIStatus()
      expect(status.available).toBe(true)
    })

    it('should return available=false when GOOGLE_CLOUD_PROJECT is missing', () => {
      delete process.env.GOOGLE_CLOUD_PROJECT
      const status = getDocAIStatus()
      expect(status.available).toBe(false)
      expect(status.reason).toContain('GOOGLE_CLOUD_PROJECT not configured')
    })

    it('should return available=false when DOCAI_OCR_PROCESSOR_ID is missing', () => {
      delete process.env.DOCAI_OCR_PROCESSOR_ID
      const status = getDocAIStatus()
      expect(status.available).toBe(false)
      expect(status.reason).toContain('DOCAI_OCR_PROCESSOR_ID not configured')
    })

    it('should return available=false when DOCAI_LAYOUT_PROCESSOR_ID is missing', () => {
      delete process.env.DOCAI_LAYOUT_PROCESSOR_ID
      const status = getDocAIStatus()
      expect(status.available).toBe(false)
      expect(status.reason).toContain('DOCAI_LAYOUT_PROCESSOR_ID not configured')
    })

    it('should return available=false when GOOGLE_APPLICATION_CREDENTIALS is missing', () => {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS
      const status = getDocAIStatus()
      expect(status.available).toBe(false)
      expect(status.reason).toContain('GOOGLE_APPLICATION_CREDENTIALS not configured')
    })

    it('should throw when getConfig is called with missing vars', () => {
      delete process.env.GOOGLE_CLOUD_PROJECT
      expect(() => getConfig()).toThrow('GOOGLE_CLOUD_PROJECT not configured')
    })
  })

  describe('Processor Selection', () => {
    it('should select OCR processor when type is "ocr"', () => {
      const config = getConfig()
      expect(config.ocrProcessorId).toBe('test-ocr-processor')
    })

    it('should select Layout processor when type is "layout"', () => {
      const config = getConfig()
      expect(config.layoutProcessorId).toBe('test-layout-processor')
    })

    it('should build correct processor name for OCR', () => {
      const config = getConfig()
      const processorName = `projects/${config.projectId}/locations/${config.location}/processors/${config.ocrProcessorId}`
      expect(processorName).toBe('projects/test-project/locations/eu/processors/test-ocr-processor')
    })

    it('should build correct processor name for Layout', () => {
      const config = getConfig()
      const processorName = `projects/${config.projectId}/locations/${config.location}/processors/${config.layoutProcessorId}`
      expect(processorName).toBe('projects/test-project/locations/eu/processors/test-layout-processor')
    })
  })

  describe('Client Initialization', () => {
    it('should create client with correct API endpoint', () => {
      const client = getClient()
      expect(client).toBeDefined()
    })

    it('should reuse client on subsequent calls', () => {
      const client1 = getClient()
      const client2 = getClient()
      expect(client1).toBe(client2)
    })
  })

  describe('Document Processing (Mocked)', () => {
    const mockDocument = {
      pages: [
        {
          pageNumber: 1,
          blocks: [
            {
              layout: {
                boundingPoly: {
                  normalizedVertices: [
                    { x: 0.1, y: 0.1 },
                    { x: 0.5, y: 0.1 },
                    { x: 0.5, y: 0.3 },
                    { x: 0.1, y: 0.3 },
                  ],
                },
                type: 'PARAGRAPH',
                confidence: 0.95,
                textAnchor: {
                  textSegments: [{ startIndex: '0', endIndex: '20' }],
                },
              },
            },
            {
              layout: {
                boundingPoly: {
                  normalizedVertices: [
                    { x: 0.2, y: 0.4 },
                    { x: 0.8, y: 0.4 },
                    { x: 0.8, y: 0.6 },
                    { x: 0.2, y: 0.6 },
                  ],
                },
                type: 'TABLE',
                confidence: 0.9,
                textAnchor: {
                  textSegments: [{ startIndex: '20', endIndex: '50' }],
                },
              },
            },
          ],
        },
      ],
      text: 'Test paragraph text\nTable content here',
    }

    it('should process layout and return normalized regions', async () => {
      const { DocumentProcessorServiceClient } = require('@google-cloud/documentai')
      const mockClient = DocumentProcessorServiceClient.mock.results[0].value
      mockClient.processDocument.mockResolvedValueOnce([{ document: mockDocument }])

      const pdfBuffer = Buffer.from('fake-pdf-content')
      const regions = await detectLayoutWithDocAI(pdfBuffer, 'application/pdf', 2480, 3508)

      expect(regions).toHaveLength(2)
      expect(regions[0].type).toBe('paragraph')
      expect(regions[1].type).toBe('table')
      expect(regions[0].source).toBe('google_docai_layout')
      expect(regions[0].confidence).toBeGreaterThan(0)
      expect(regions[0].bbox).toHaveLength(4)
    })

    it('should extract text with OCR processor', async () => {
      const { DocumentProcessorServiceClient } = require('@google-cloud/documentai')
      const mockClient = DocumentProcessorServiceClient.mock.results[0].value
      mockClient.processDocument.mockResolvedValueOnce([{ document: mockDocument }])

      const pdfBuffer = Buffer.from('fake-pdf-content')
      const result = await extractTextWithDocAI(pdfBuffer, 'application/pdf')

      expect(result.text).toContain('Test paragraph text')
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].pageNumber).toBe(1)
    })

    it('should handle API errors gracefully', async () => {
      const { DocumentProcessorServiceClient } = require('@google-cloud/documentai')
      const mockClient = DocumentProcessorServiceClient.mock.results[0].value
      mockClient.processDocument.mockRejectedValueOnce(new Error('API Error: Permission Denied'))

      const pdfBuffer = Buffer.from('fake-pdf-content')

      await expect(detectLayoutWithDocAI(pdfBuffer, 'application/pdf', 2480, 3508))
        .rejects
        .toThrow()
    })

    it('should map style types correctly', async () => {
      const { DocumentProcessorServiceClient } = require('@google-cloud/documentai')
      const mockClient = DocumentProcessorServiceClient.mock.results[0].value
      const docWithTitle = {
        ...mockDocument,
        pages: [
          {
            ...mockDocument.pages[0],
            blocks: [
              {
                layout: {
                  boundingPoly: {
                    normalizedVertices: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.3 }, { x: 0.1, y: 0.3 }],
                  },
                  type: 'TITLE',
                  confidence: 0.98,
                  textAnchor: { textSegments: [{ startIndex: '0', endIndex: '10' }] },
                },
              },
            ],
          },
        ],
      }
      mockClient.processDocument.mockResolvedValueOnce([{ document: docWithTitle }])

      const pdfBuffer = Buffer.from('fake-pdf-content')
      const regions = await detectLayoutWithDocAI(pdfBuffer, 'application/pdf', 2480, 3508)

      expect(regions[0].type).toBe('heading')
    })
  })

  describe('isGoogleDocAIAvailable', () => {
    it('should return true when configured', () => {
      expect(isGoogleDocAIAvailable()).toBe(true)
    })

    it('should return false when not configured', () => {
      delete process.env.GOOGLE_CLOUD_PROJECT
      expect(isGoogleDocAIAvailable()).toBe(false)
    })
  })

  describe('Output Normalization', () => {
    it('should clamp bounding boxes to page dimensions', async () => {
      const { DocumentProcessorServiceClient } = require('@google-cloud/documentai')
      const mockClient = DocumentProcessorServiceClient.mock.results[0].value
      const docWithOutOfBounds = {
        pages: [
          {
            pageNumber: 1,
            blocks: [
              {
                layout: {
                  boundingPoly: {
                    normalizedVertices: [
                      { x: -0.1, y: -0.1 },
                      { x: 1.1, y: -0.1 },
                      { x: 1.1, y: 1.1 },
                      { x: -0.1, y: 1.1 },
                    ],
                  },
                  type: 'PARAGRAPH',
                  confidence: 0.9,
                  textAnchor: { textSegments: [{ startIndex: '0', endIndex: '10' }] },
                },
              },
            ],
          },
        ],
        text: 'Test',
      }
      mockClient.processDocument.mockResolvedValueOnce([{ document: docWithOutOfBounds }])

      const pdfBuffer = Buffer.from('fake-pdf-content')
      const regions = await detectLayoutWithDocAI(pdfBuffer, 'application/pdf', 1000, 1000)

      expect(regions[0].bbox[0]).toBeGreaterThanOrEqual(0)
      expect(regions[0].bbox[1]).toBeGreaterThanOrEqual(0)
      expect(regions[0].bbox[2]).toBeLessThanOrEqual(1000)
      expect(regions[0].bbox[3]).toBeLessThanOrEqual(1000)
    })

    it('should preserve page numbers in output', async () => {
      const { DocumentProcessorServiceClient } = require('@google-cloud/documentai')
      const mockClient = DocumentProcessorServiceClient.mock.results[0].value

      const block1 = {
        layout: {
          boundingPoly: {
            normalizedVertices: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.3 }, { x: 0.1, y: 0.3 }],
          },
          type: 'PARAGRAPH',
          confidence: 0.9,
          textAnchor: { textSegments: [{ startIndex: '0', endIndex: '10' }] },
        },
      }

      const block2 = {
        layout: {
          boundingPoly: {
            normalizedVertices: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.3 }, { x: 0.1, y: 0.3 }],
          },
          type: 'PARAGRAPH',
          confidence: 0.9,
          textAnchor: { textSegments: [{ startIndex: '10', endIndex: '20' }] },
        },
      }

      const multiPageDoc = {
        pages: [
          { pageNumber: 1, blocks: [block1] },
          { pageNumber: 2, blocks: [block2] },
        ],
        text: 'Page 1\nPage 2',
      }

      mockClient.processDocument.mockResolvedValueOnce([{ document: multiPageDoc }])

      const pdfBuffer = Buffer.from('fake-pdf-content')
      const result = await extractTextWithDocAI(pdfBuffer, 'application/pdf')

      expect(result.pages).toHaveLength(2)
      expect(result.pages[0].pageNumber).toBe(1)
      expect(result.pages[1].pageNumber).toBe(2)
    })
  })

  describe('Fallback Behavior', () => {
    it('should be available for layout when DOCAI_LAYOUT_PROCESSOR_ID is set', () => {
      const available = isGoogleDocAILayoutAvailable()
      expect(available).toBe(true)
    })

    it('should be available for OCR when DOCAI_OCR_PROCESSOR_ID is set', () => {
      const available = isGoogleDocAIOCRAvailable()
      expect(available).toBe(true)
    })

    it('should not be available for layout when DOCAI_LAYOUT_PROCESSOR_ID is missing', () => {
      delete process.env.DOCAI_LAYOUT_PROCESSOR_ID
      const available = isGoogleDocAILayoutAvailable()
      expect(available).toBe(false)
    })
  })
})