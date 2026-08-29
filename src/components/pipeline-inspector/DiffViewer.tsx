'use client'

import { Search, X, MinusCircle, PlusCircle } from 'lucide-react'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'

interface DiffData {
  removed: string[]
  added: string[]
  modified: Array<{ path: string; from: unknown; to: unknown }>
}

interface DiffViewerProps {
  diff: DiffData
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified')
  const [search, setSearch] = useState('')

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#A8A29E]">View:</label>
          <div className="flex bg-[rgba(250,248,245,0.03)] rounded-lg p-1">
            <button
              onClick={() => setViewMode('unified')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'unified' ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
            >
              Unified
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'split' ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
            >
              Split
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Filter diff..."
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

      <div className="bg-[#0C0C0C] rounded-xl border border-[rgba(250,248,245,0.06)] overflow-hidden">
        <div className="p-3 border-b border-[rgba(250,248,245,0.06)] flex items-center gap-4 text-sm text-[#A8A29E]">
          <div className="flex items-center gap-2">
            <MinusCircle size={14} className="text-[#EF4444]" />
            <span>Removed: {diff.removed.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <PlusCircle size={14} className="text-[#10B981]" />
            <span>Added: {diff.added.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#F59E0B]">~</span>
            <span>Modified: {diff.modified.length}</span>
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {viewMode === 'unified' ? (
            <UnifiedDiffView diff={diff} />
          ) : (
            <SplitDiffView diff={diff} />
          )}
        </div>
      </div>
    </div>
  )
}

function UnifiedDiffView({ diff }: { diff: DiffData }) {
  const lines = useMemo(() => {
    const allLines: Array<{ type: 'removed' | 'added' | 'modified' | 'context'; content: string; path?: string }> = []

    diff.removed.forEach((r) => allLines.push({ type: 'removed', content: r }))
    diff.added.forEach((a) => allLines.push({ type: 'added', content: a }))
    diff.modified.forEach((m) => {
      allLines.push({ type: 'removed', content: `  - ${m.path}: ${JSON.stringify(m.from)}`, path: m.path })
      allLines.push({ type: 'added', content: `  + ${m.path}: ${JSON.stringify(m.to)}`, path: m.path })
    })

    return allLines
  }, [diff])

  return (
    <div className="p-4 font-mono text-sm">
      {lines.map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.01 }}
          className={`py-1 px-3 font-mono text-sm ${line.type === 'removed' ? 'bg-[#EF4444]/10 text-[#EF4444]' : line.type === 'added' ? 'bg-[#10B981]/10 text-[#10B981]' : 'text-[#A8A29E]'}`}
        >
          {line.content}
        </motion.div>
      ))}
    </div>
  )
}

function SplitDiffView({ diff }: { diff: DiffData }) {
  return (
    <div className="grid grid-cols-2 h-[500px]">
      <div className="border-r border-[rgba(250,248,245,0.06)] overflow-y-auto p-4">
        <div className="text-center text-xs text-[#6B7280] mb-2 font-medium">Removed / Old</div>
        <div className="space-y-1 font-mono text-sm">
          {diff.removed.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="py-1 px-3 text-[#EF4444] bg-[#EF4444]/10 rounded"
            >
              - {r}
            </motion.div>
          ))}
          {diff.modified.map((m, i) => (
            <motion.div
              key={`mod-old-${i}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="py-1 px-3 text-[#EF4444] bg-[#EF4444]/10 rounded"
            >
              - {m.path}: {JSON.stringify(m.from)}
            </motion.div>
          ))}
        </div>
      </div>
      <div className="overflow-y-auto p-4">
        <div className="text-center text-xs text-[#6B7280] mb-2 font-medium">Added / New</div>
        <div className="space-y-1 font-mono text-sm">
          {diff.added.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="py-1 px-3 text-[#10B981] bg-[#10B981]/10 rounded"
            >
              + {a}
            </motion.div>
          ))}
          {diff.modified.map((m, i) => (
            <motion.div
              key={`mod-new-${i}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="py-1 px-3 text-[#10B981] bg-[#10B981]/10 rounded"
            >
              + {m.path}: {JSON.stringify(m.to)}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}