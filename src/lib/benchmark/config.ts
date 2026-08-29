import type { ExtractionEngine } from './types'

export const PROVIDER_CONFIG: Record<ExtractionEngine, { url: string; timeoutMs: number; label: string }> = {
  LLM_VISION: { url: process.env.LLM_VISION_URL ?? 'http://localhost:8001', timeoutMs: Number(process.env.LLM_VISION_TIMEOUT_MS ?? 300000), label: 'LLM + Vision' },
  DOCLING: { url: process.env.DOCLING_URL ?? 'http://localhost:8002', timeoutMs: Number(process.env.DOCLING_TIMEOUT_MS ?? 300000), label: 'Docling' },
  PYMUPDF: { url: process.env.PYMUPDF_URL ?? 'http://localhost:8003', timeoutMs: Number(process.env.PYMUPDF_TIMEOUT_MS ?? 120000), label: 'PyMuPDF' },
  SURYA: { url: process.env.SURYA_URL ?? 'http://localhost:8004', timeoutMs: Number(process.env.SURYA_TIMEOUT_MS ?? 300000), label: 'Surya' },
  PP_STRUCTURE: { url: process.env.PP_STRUCTURE_URL ?? 'http://localhost:8005', timeoutMs: Number(process.env.PP_STRUCTURE_TIMEOUT_MS ?? 300000), label: 'PP-Structure' },
  GOOGLE_DOC_AI: { url: process.env.GOOGLE_DOC_AI_URL ?? 'http://localhost:8006', timeoutMs: Number(process.env.GOOGLE_DOC_AI_TIMEOUT_MS ?? 300000), label: 'Google Document AI' },
}

export const ENGINE_COST_CONFIG: Record<ExtractionEngine, { apiPerPage: number; computePerPage: number }> = {
  LLM_VISION: { apiPerPage: 0.01, computePerPage: 0 },
  DOCLING: { apiPerPage: 0, computePerPage: 0.002 },
  PYMUPDF: { apiPerPage: 0, computePerPage: 0.001 },
  SURYA: { apiPerPage: 0, computePerPage: 0.003 },
  PP_STRUCTURE: { apiPerPage: 0, computePerPage: 0.003 },
  GOOGLE_DOC_AI: { apiPerPage: 0.01, computePerPage: 0 },
}
