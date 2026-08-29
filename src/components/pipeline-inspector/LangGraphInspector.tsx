'use client'

import { useState } from 'react'
import { ChevronDown, Clock, Zap, Server, CheckCircle, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface LangGraphInspectorProps {
  execution: {
    nodes: Array<{
      id: string
      name: string
      type: string
      status: string
      durationMs: number
      input?: Record<string, unknown>
      output?: Record<string, unknown>
      tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number }
      error?: string
    }>
    edges: Array<{ source: string; target: string }>
    totalDurationMs: number
  }
}

export function LangGraphInspector({ execution }: LangGraphInspectorProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} className="text-[#10B981]" />
      case 'running': return <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}><div className="w-3 h-3 rounded-full bg-[#8B5CF6]" /></motion.div>
      case 'failed': return <XCircle size={16} className="text-[#EF4444]" />
      default: return <Clock size={16} className="text-[#6B7280]" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-[#10B981]'
      case 'running': return 'text-[#8B5CF6]'
      case 'failed': return 'text-[#EF4444]'
      default: return 'text-[#6B7280]'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-[#FAF8F5] flex items-center gap-2">
          <Server size={16} className="text-[#8B5CF6]" />
          LangGraph Execution
        </h4>
        <div className="flex items-center gap-4 text-sm text-[#A8A29E]">
          <span className="flex items-center gap-1">
            <Clock size={14} />
            Total: {execution.totalDurationMs}ms
          </span>
          <span className="flex items-center gap-1">
            <Zap size={14} />
            {execution.nodes.length} nodes
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {execution.nodes.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group"
          >
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] hover:bg-[rgba(250,248,245,0.04)] transition-colors"
              whileHover={{ x: 4 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${getNodeColor(node.type)}20, ${getNodeColor(node.type)}40)`, border: `1px solid ${getNodeColor(node.type)}60` }}
              >
                {getNodeIcon(node.type)}
              </motion.div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-[#FAF8F5]">{node.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(250,248,245,0.03)] text-[#A8A29E] font-mono">{node.type}</span>
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(node.status)}`}
                  >
                    {getStatusIcon(node.status)} {node.status}
                  </motion.span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#A8A29E]">
                  <span className="flex items-center gap-1"><Clock size={10} /> {node.durationMs}ms</span>
                  {node.tokenUsage && (
                    <span className="flex items-center gap-1"><Zap size={10} /> {node.tokenUsage.totalTokens} tokens</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                  className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[#8B5CF6]/20 text-[#A8A29E] hover:text-[#8B5CF6] transition-colors"
                  title="Toggle details"
                >
                  <ChevronDown size={16} className={selectedNode === node.id ? 'rotate-180' : ''} />
                </button>
              </div>
            </motion.div>

            <AnimatePresence>
              {selectedNode === node.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 ml-12 border-l border-[rgba(250,248,245,0.06)] pl-4 space-y-3"
                >
                  {node.input && (
                    <DetailPanel title="Input" data={node.input} />
                  )}
                  {node.output && (
                    <DetailPanel title="Output" data={node.output} />
                  )}
                  {node.tokenUsage && (
                    <DetailPanel title="Token Usage" data={node.tokenUsage} />
                  )}
                  {node.error && (
                    <DetailPanel title="Error" data={{ message: node.error }} error={true} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-[rgba(250,248,245,0.02)] rounded-xl border border-[rgba(250,248,245,0.06)]">
        <h4 className="font-medium text-[#FAF8F5] mb-3 flex items-center gap-2">
          <Zap size={16} className="text-[#8B5CF6]" />
          Execution Flow
        </h4>
        <div className="space-y-2 text-sm">
          {execution.edges.map((edge, i) => (
            <div key={i} className="flex items-center gap-2 text-[#A8A29E] font-mono text-xs">
              <span className="w-8 text-center">{i + 1}</span>
              <span>→</span>
              <span className="text-[#FAF8F5] font-medium">{execution.nodes.find(n => n.id === edge.source)?.name || edge.source}</span>
              <span className="text-[#6B7280]">→</span>
              <span className="text-[#FAF8F5] font-medium">{execution.nodes.find(n => n.id === edge.target)?.name || edge.target}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DetailPanel({ title, data, error = false }: { title: string; data: unknown; error?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#A8A29E] font-medium">{title}</span>
        <span className="text-xs text-[#6B7280] font-mono">JSON</span>
      </div>
      <pre className={`text-xs font-mono overflow-x-auto max-h-48 ${error ? 'text-[#EF4444]' : 'text-[#A8A29E]'}`}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

function getNodeColor(type: string) {
  const colors: Record<string, string> = {
    loader: '#3B82F6',
    ocr: '#10B981',
    analyzer: '#8B5CF6',
    extractor: '#F59E0B',
    classifier: '#EC4899',
    mapper: '#6366F1',
    writer: '#10B981',
  }
  return colors[type] || '#6B7280'
}

function getNodeIcon(type: string) {
  const icons: Record<string, string> = {
    loader: '📥',
    ocr: '👁',
    analyzer: '🔍',
    extractor: '✂️',
    classifier: '🏷️',
    mapper: '🔗',
    writer: '💾',
  }
  return icons[type] || '⚙️'
}
