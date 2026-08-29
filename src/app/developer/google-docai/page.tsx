'use client'
import StatelessInspector, { type InspectorConfig } from '@/components/extraction-inspector/StatelessInspector'

const config: InspectorConfig = {
  id: 'google-docai',
  title: 'Google Document AI Inspector',
  subtitle: 'Enterprise / commercial benchmark',
  description: 'Google Cloud Document AI · batch process_document API · requires GOOGLE_APPLICATION_CREDENTIALS + GOOGLE_CLOUD_PROJECT + DOCAI_LAYOUT_PROCESSOR_ID · no silent fallback',
  apiPrefix: 'google-docai',
  port: 8006,
  accent: '#2FBF71',
  tech: 'Google Cloud Document AI · OCR/Layout processors · normalized_vertices',
  philosophy: 'Enterprise OCR/layout — benchmark only valid when the selected engine is actually used',
  expectedProvider: 'documentai',
  iconLabel: 'Google DocAI',
}

export default function GoogleDocAIPage() {
  return <StatelessInspector config={config} />
}
