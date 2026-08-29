'use client'

import { CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import type { PipelineEventDto, PipelineStageDto } from '@/lib/types/pipeline-inspector'

interface PipelineTimelineProps {
  events: PipelineEventDto[]
  stages: PipelineStageDto[]
}

export function PipelineTimeline({ events, stages }: PipelineTimelineProps) {
  const allItems = useMemo(() => {
    const stageItems = stages.map((s, i) => ({
      type: 'stage' as const,
      index: i,
      data: s,
      timestamp: s.startedAt || new Date().toISOString(),
    }))
    const eventItems = events.map((e, i) => ({
      type: 'event' as const,
      index: i,
      data: e,
      timestamp: e.timestamp,
    }))
    return [...stageItems, ...eventItems].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [events, stages])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} className="text-[#10B981]" />
      case 'running': return <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}><div className="w-3 h-3 rounded-full bg-[#8B5CF6]" /></motion.div>
      case 'failed': return <XCircle size={16} className="text-[#EF4444]" />
      case 'warning': return <AlertTriangle size={16} className="text-[#F59E0B]" />
      default: return <Clock size={16} className="text-[#6B7280]" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-[#10B981]'
      case 'running': return 'text-[#8B5CF6]'
      case 'failed': return 'text-[#EF4444]'
      case 'warning': return 'text-[#F59E0B]'
      default: return 'text-[#6B7280]'
    }
  }

  return (
    <div className="space-y-3">
      {allItems.map((item, index) => (
        <motion.div
          key={`${item.type}-${item.index}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="flex gap-4"
        >
          <div className="flex flex-col items-center relative">
            {index > 0 && (
              <div className="flex-1 w-0.5 bg-[rgba(250,248,245,0.1)]" />
            )}
            <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-[#0C0C0C] border border-[rgba(250,248,245,0.1)]">
              {getStatusIcon(item.data.status)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-[#FAF8F5]">
                {item.type === 'stage' ? item.data.name : item.data.stage}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(item.data.status)}`}>
                {item.data.status}
              </span>
              {item.type === 'stage' && item.data.durationMs && (
                <span className="text-xs text-[#6B7280] flex items-center gap-1">
                  <Clock size={10} />
                  {item.data.durationMs}ms
                </span>
              )}
            </div>
            {item.type === 'event' && <p className="text-sm text-[#A8A29E]">{item.data.message}</p>}
            {item.type === 'stage' && (
              <div className="mt-2 space-y-1 text-xs text-[#6B7280]">
                {item.data.input && (
                  <div className="flex items-center gap-1">
                    <span className="text-[#6B7280]">Input:</span>
                    <code className="text-[#6B7280] bg-[rgba(250,248,245,0.03)] px-1.5 py-0.5 rounded text-xs font-mono">
                      {JSON.stringify(item.data.input).slice(0, 100)}...
                    </code>
                  </div>
                )}
                {item.data.output && (
                  <div className="flex items-center gap-1">
                    <span className="text-[#6B7280]">Output:</span>
                    <code className="text-[#6B7280] bg-[rgba(250,248,245,0.03)] px-1.5 py-0.5 rounded text-xs font-mono">
                      {JSON.stringify(item.data.output).slice(0, 100)}...
                    </code>
                  </div>
                )}
                {item.data.tokenUsage && (
                  <div className="flex items-center gap-1 text-[#6B7280]">
                    Tokens: {item.data.tokenUsage.totalTokens} (prompt: {item.data.tokenUsage.promptTokens}, completion: {item.data.tokenUsage.completionTokens})
                  </div>
                )}
                {item.data.warnings && item.data.warnings.length > 0 && (
                  <div className="flex items-center gap-1 text-[#F59E0B]">
                    <span>Warnings:</span>
                    {item.data.warnings.map((w, i) => <span key={i} className="bg-[#F59E0B]/20 text-[#F59E0B] px-1.5 py-0.5 rounded text-xs">{w}</span>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}