'use client'

import StatelessInspector, { type InspectorConfig } from '@/components/extraction-inspector/StatelessInspector'

const config: InspectorConfig = {
  id: 'docling',
  title: 'Docling Inspector',
  subtitle: 'Document conversion and layout baseline',
  description: 'Docling conversion with OCR, reading order, headings, lists, tables, figures, captions, and page-level bounding boxes.',
  apiPrefix: 'docling',
  port: 8001,
  accent: '#22C55E',
  tech: 'Docling DocumentConverter · layout · OCR',
  philosophy: 'Deterministic document analysis with synchronized PDF overlays and extracted content.',
  expectedProvider: 'docling',
  iconLabel: 'Docling',
}

export default function DoclingPage() {
  return <StatelessInspector config={config} />
}
