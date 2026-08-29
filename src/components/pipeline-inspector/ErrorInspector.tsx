'use client'

import { AlertTriangle, Copy, Download, ChevronDown, Search, X, Bug, AlertOctagon } from 'lucide-react'
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ErrorInspectorProps {
  errors: Array<{
    stage: string
    message: string
    stack?: string
    timestamp: string
  }>
}

export function ErrorInspector({ errors }: ErrorInspectorProps) {
  const [filter, setFilter] = useState<'all' | 'with-stack' | 'no-stack'>('all')
  const [search, setSearch] = useState('')
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  const filteredErrors = useMemo(() => {
    return errors
      .filter(e => {
        if (filter === 'with-stack' && !e.stack) return false
        if (filter === 'no-stack' && e.stack) return false
        return true
      })
      .filter(e => !search || e.message.toLowerCase().includes(search.toLowerCase()) || e.stage.toLowerCase().includes(search.toLowerCase()) || (e.stack && e.stack.toLowerCase().includes(search.toLowerCase())))
  }, [errors, filter, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-[#A8A29E]">Filter:</label>
          <div className="flex gap-1 bg-[rgba(250,248,245,0.03)] rounded-lg p-1">
            {(['all', 'with-stack', 'no-stack'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${filter === f ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
              >
                {f === 'all' ? 'All' : f === 'with-stack' ? 'With Stack' : 'No Stack'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Filter errors..."
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
            <AlertTriangle size={14} className="text-[#EF4444]" />
            <span>Total Errors: {errors.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-[#EF4444]/20 text-[#EF4444]">
              {errors.filter(e => e.stack).length} with stack
            </span>
          </div>
        </div>

        <AnimatePresence>
          {filteredErrors.map((error, index) => (
            <motion.div
              key={`${error.timestamp}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border-b border-[rgba(250,248,245,0.03)] last:border-b-0"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertOctagon size={16} className="text-[#EF4444]" />
                      <span className="font-medium text-[#FAF8F5]">{error.stage}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#EF4444]/20 text-[#EF4444] font-mono">Error</span>
                      <span className="text-xs text-[#6B7280] font-mono">{new Date(error.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-[#EF4444] font-mono break-all">{error.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedErrors(prev => {
                        const next = new Set(prev)
                        const key = `${error.timestamp}-${index}`
                        if (next.has(key)) next.delete(key)
                        else next.add(key)
                        return next
                      })}
                      className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[#8B5CF6]/20 text-[#A8A29E] hover:text-[#8B5CF6] transition-colors"
                      title="Toggle stack trace"
                    >
                      <ChevronDown size={14} className={expandedErrors.has(`${error.timestamp}-${index}`) ? 'rotate-180' : ''} />
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(error.stack || error.message)}
                      className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[#8B5CF6]/20 text-[#A8A29E] hover:text-[#8B5CF6] transition-colors"
                      title="Copy error"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([error.stack || error.message], { type: 'text/plain' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `error-${error.stage}-${Date.now()}.txt`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[#8B5CF6]/20 text-[#A8A29E] hover:text-[#8B5CF6] transition-colors"
                      title="Download error"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {expandedErrors.has(`${error.timestamp}-${index}`) && error.stack && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 p-3 bg-[#0C0C0C] rounded-lg border border-[rgba(250,248,245,0.06)] overflow-x-auto"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[#A8A29E] font-medium">Stack Trace</span>
                        <span className="text-xs text-[#6B7280] font-mono">Stack Trace</span>
                      </div>
                      <pre className="text-xs font-mono text-[#EF4444] overflow-x-auto max-h-96">
                        {error.stack}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredErrors.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[#6B7280]">
            <div className="text-center">
              <Bug size={32} className="mx-auto text-[#6B7280]/30 mb-2" />
              <p className="text-sm">No errors match the current filters</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[rgba(250,248,245,0.06)]">
        <span className="text-xs text-[#6B7280]">
          {filteredErrors.length} / {errors.length} errors
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(JSON.stringify(errors, null, 2))}
            className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[#8B5CF6]/20 text-[#A8A29E] hover:text-[#8B5CF6] transition-colors"
            title="Copy all errors"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(errors, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'pipeline-errors.json'
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[#8B5CF6]/20 text-[#A8A29E] hover:text-[#8B5CF6] transition-colors"
            title="Download errors"
          >
            <Download size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}