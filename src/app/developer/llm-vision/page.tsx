'use client'
import StatelessInspector, { type InspectorConfig } from '@/components/extraction-inspector/StatelessInspector'

const config: InspectorConfig = {
  id: 'llm-vision',
  title: 'LLM+Vision Inspector',
  subtitle: 'Highest-quality extraction benchmark',
  description: 'Full layout-first pipeline + LLM (OpenRouter) + Vision (image description) · exercise grouping · relationships · knowledge graph · highest quality benchmark',
  apiPrefix: 'llm-vision',
  port: 8001,
  accent: '#F59E0B',
  tech: 'PyMuPDF + Surya/DocAI + LLM (deepseek) + Vision (gpt-4o-mini) · LangGraph',
  philosophy: 'Layout is primary, LLM only enriches — highest accuracy with cost/latency tradeoff',
  expectedProvider: 'layout+llm',
  iconLabel: 'LLM+Vision',
}

export default function LLMVisionPage() {
  return <StatelessInspector config={config} />
}
