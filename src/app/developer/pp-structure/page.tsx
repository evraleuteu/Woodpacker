'use client'
import StatelessInspector, { type InspectorConfig } from '@/components/extraction-inspector/StatelessInspector'

const config: InspectorConfig = {
  id: 'pp-structure',
  title: 'PP-Structure Inspector',
  subtitle: 'Advanced document structure analysis',
  description: 'PaddleOCR PP-StructureV3 · region segmentation + table/form detection · advanced structure benchmark (optional heavy dep)',
  apiPrefix: 'pp-structure',
  port: 8005,
  accent: '#1F7A4C',
  tech: 'PaddleOCR · PP-StructureV3 · PPStructureV3()',
  philosophy: 'Structure-first segmentation with dedicated table engine',
  expectedProvider: 'paddle_structure',
  iconLabel: 'Paddle',
}

export default function PPStructurePage() {
  return <StatelessInspector config={config} />
}
