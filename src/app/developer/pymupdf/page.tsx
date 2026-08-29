'use client'
import StatelessInspector, { type InspectorConfig } from '@/components/extraction-inspector/StatelessInspector'

const config: InspectorConfig = {
  id: 'pymupdf',
  title: 'PyMuPDF Inspector',
  subtitle: 'Text extraction baseline (no OCR)',
  description: 'Pure PyMuPDF · digital text layer only · deterministic bbox from PDF dict · no VLM/LLM · fastest baseline for comparison',
  apiPrefix: 'pymupdf',
  port: 8003,
  accent: '#64748B',
  tech: 'PyMuPDF · PDF dict · find_tables',
  philosophy: 'If the PDF has a digital text layer, that IS ground truth — fastest & most deterministic',
  expectedProvider: 'pymupdf',
  iconLabel: 'PyMuPDF',
}

export default function PyMuPDFPage() {
  return <StatelessInspector config={config} />
}
