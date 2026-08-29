'use client'

import { Search, X, Image as ImageIcon } from 'lucide-react'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'

interface OCRInspectorProps {
  ocrData: {
    text: string
    blocks: Array<{
      type: string
      text: string
      bbox: number[]
      page: number
      confidence: number
      spans?: Array<{ text: string; bbox: number[]; fontName: string; fontSize: number }>
    }>
    confidenceScores: Array<{ blockIndex: number; confidence: number }>
    engine: string
    durationMs: number
  }
}

export function OCRInspector({ ocrData }: OCRInspectorProps) {
  const [viewMode, setViewMode] = useState<'blocks' | 'text' | 'confidence'>('blocks')
  const [search, setSearch] = useState('')
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null)

  const filteredBlocks = useMemo(() => {
    if (!search) return ocrData.blocks
    const searchLower = search.toLowerCase()
    return ocrData.blocks.filter(b => b.text.toLowerCase().includes(searchLower))
  }, [ocrData.blocks, search])

  const avgConfidence = useMemo(() => {
    if (ocrData.confidenceScores.length === 0) return 0
    return ocrData.confidenceScores.reduce((sum, s) => sum + s.confidence, 0) / ocrData.confidenceScores.length
  }, [ocrData.confidenceScores])

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'text-[#10B981]'
    if (conf >= 0.7) return 'text-[#F59E0B]'
    return 'text-[#EF4444]'
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'heading':
      case 'title': return '📋'
      case 'exercise': return '📝'
      case 'text':
      case 'paragraph': return '📄'
      case 'image': return '🖼️'
      case 'audio_ref': return '🔊'
      case 'video_ref': return '🎬'
      case 'blank': return '⬜'
      case 'media_ref': return '🔊'
      case 'solution_ref': return '📚'
      default: return '📄'
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon size={16} className="text-[#8B5CF6]" />
            <span className="text-xs text-[#A8A29E]">Engine</span>
          </div>
          <p className="font-bold text-xl text-[#FAF8F5] capitalize">{ocrData.engine}</p>
        </div>
        <div className="p-4 rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[#8B5CF6]">⏱</span>
            <span className="text-xs text-[#A8A29E]">Duration</span>
          </div>
          <p className="font-bold text-2xl text-[#FAF8F5]">{ocrData.durationMs}ms</p>
        </div>
        <div className={`p-4 rounded-xl border ${avgConfidence >= 0.9 ? 'bg-[#10B981]/20 border-[#10B981]/30' : avgConfidence >= 0.7 ? 'bg-[#F59E0B]/20 border-[#F59E0B]/30' : 'bg-[#EF4444]/20 border-[#EF4444]/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[#8B5CF6]">📊</span>
            <span className="text-xs text-[#A8A29E]">Avg Confidence</span>
          </div>
          <p className={`font-bold text-2xl ${getConfidenceColor(avgConfidence)}`}>{(avgConfidence * 100).toFixed(1)}%</p>
        </div>
        <div className="p-4 rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[#8B5CF6]">⏱</span>
            <span className="text-xs text-[#A8A29E]">Duration</span>
          </div>
          <p className="font-bold text-2xl text-[#FAF8F5]">{ocrData.durationMs}ms</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-[#A8A29E]">View:</label>
          <div className="flex bg-[rgba(250,248,245,0.03)] rounded-lg p-1">
            {(['blocks', 'text', 'confidence'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === mode ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Filter blocks by text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)] rounded-lg px-10 py-2 pl-10 text-sm text-[#FAF8F5] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#FAF8F5]">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {viewMode === 'blocks' && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredBlocks.map((block, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => setSelectedBlock(selectedBlock === i ? null : i)}
              className={`p-3 rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] hover:bg-[rgba(250,248,245,0.04)] transition-colors cursor-pointer ${selectedBlock === i ? 'border-[#8B5CF6]/30 bg-[#8B5CF6]/10' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getTypeIcon(block.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#FAF8F5] capitalize">{block.type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceColor(block.confidence)}`}>
                      {(block.confidence * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs text-[#6B7280] font-mono">Page {block.page}</span>
                    <span className="text-xs text-[#6B7280] font-mono">BBox: [{block.bbox.join(', ')}]</span>
                  </div>
                  <p className="text-[#FAF8F5] text-sm truncate">{block.text}</p>
                </div>
                <div className={`text-xs font-mono ${getConfidenceColor(block.confidence)}`}>
                  {(block.confidence * 100).toFixed(1)}%
                </div>
              </div>
              {selectedBlock === i && block.spans && block.spans.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 ml-4 border-l border-[rgba(250,248,245,0.06)] pl-4 space-y-1"
                >
                  <p className="text-xs text-[#A8A29E] font-medium">Spans:</p>
                  {block.spans.map((span, si) => (
                    <div key={si} className="text-xs text-[#A8A29E] font-mono px-2 py-0.5 bg-[rgba(250,248,245,0.02)] rounded">
                      &quot;{span.text}&quot; (font: {span.fontName}, size: {span.fontSize})
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {viewMode === 'text' && (
        <div className="bg-[#0C0C0C] rounded-xl border border-[rgba(250,248,245,0.06)] p-4 max-h-[400px] overflow-y-auto">
          <pre className="text-sm font-mono text-[#FAF8F5] whitespace-pre-wrap">{ocrData.text}</pre>
        </div>
      )}

      {viewMode === 'confidence' && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {ocrData.confidenceScores.map((score, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="p-3 rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#6B7280] font-mono bg-[rgba(250,248,245,0.03)] px-2 py-0.5 rounded">Block {score.blockIndex}</span>
                  <div className="w-48 h-2 bg-[rgba(250,248,245,0.06)] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${score.confidence * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, #EF4444, #F59E0B, #10B981)` }}
                    />
                  </div>
                </div>
                <span className={`text-xs font-mono ${getConfidenceColor(score.confidence)}`}>
                  {(score.confidence * 100).toFixed(1)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
