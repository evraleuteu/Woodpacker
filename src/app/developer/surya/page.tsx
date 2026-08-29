'use client'
import StatelessInspector, { type InspectorConfig } from '@/components/extraction-inspector/StatelessInspector'

const config: InspectorConfig = {
  id: 'surya',
  title: 'Surya Inspector',
  subtitle: 'OCR + layout detection baseline',
  description: 'Surya LayoutPredictor + RecognitionPredictor · VLM-based layout for scanned PDFs · forced even on digital pages for fair benchmark',
  apiPrefix: 'surya',
  port: 8004,
  accent: '#F4B942',
  tech: 'Surya 0.22 · LayoutPredictor · RecognitionPredictor · VLM',
  philosophy: 'Offline VLM OCR/layout — no cloud, no LLM enrichment',
  expectedProvider: 'surya',
  iconLabel: 'Surya',
}

export default function SuryaPage() {
  return <StatelessInspector config={config} />
}
