'use client'

import { Clock, AlertTriangle, CheckCircle, XCircle, Pause, Play, Filter, X, Copy, Download, ArrowDownRight, Search } from 'lucide-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface EventStreamProps {
  events: Array<{
    timestamp: string
    stage: string
    status: 'started' | 'completed' | 'failed' | 'warning'
    message: string
    durationMs?: number
    metadata?: Record<string, unknown>
  }>
}

export function EventStream({ events }: EventStreamProps) {
  const [filter, setFilter] = useState<'all' | 'completed' | 'running' | 'failed' | 'warning'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [paused, setPaused] = useState(false)
  const [search, setSearch] = useState('')
  const eventsRef = useRef<HTMLDivElement>(null)

  const filteredEvents = useMemo(() => {
    return events
      .filter(e => filter === 'all' || e.status === filter)
      .filter(e => !search || e.message.toLowerCase().includes(search.toLowerCase()) || e.stage.toLowerCase().includes(search.toLowerCase()))
  }, [events, filter, search])

  useEffect(() => {
    if (eventsRef.current && autoScroll) {
      eventsRef.current.scrollTop = eventsRef.current.scrollHeight
    }
  }, [events, autoScroll])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} className="text-[#10B981]" />
      case 'running': return <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}><div className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" /></motion.div>
      case 'failed': return <XCircle size={14} className="text-[#EF4444]" />
      case 'warning': return <AlertTriangle size={14} className="text-[#F59E0B]" />
      default: return <Clock size={14} className="text-[#6B7280]" />
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-[#A8A29E]">Filter:</label>
          <div className="flex gap-1 bg-[rgba(250,248,245,0.03)] rounded-lg p-1">
            {(['all', 'completed', 'running', 'failed', 'warning'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${filter === f ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Filter messages..."
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused(!paused)}
              className={`p-2 rounded-lg transition-colors ${paused ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#10B981]/20 text-[#10B981]'}`}
              title={paused ? 'Resume' : 'Pause'}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-2 rounded-lg transition-colors ${autoScroll ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[rgba(250,248,245,0.03)] text-[#A8A29E]'}`}
              title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
            >
              <ArrowDownRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={eventsRef}
        className="bg-[#0C0C0C] rounded-xl border border-[rgba(250,248,245,0.06)] max-h-[400px] overflow-y-auto"
      >
        <AnimatePresence>
          {filteredEvents.map((event, index) => (
            <motion.div
              key={`${event.timestamp}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex gap-3 px-4 py-2.5 hover:bg-[rgba(250,248,245,0.02)] border-b border-[rgba(250,248,245,0.03)] last:border-b-0"
            >
              <div className="flex-shrink-0 w-32 text-right pr-3 text-xs text-[#6B7280] font-mono">
                {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
              </div>
              <div className="flex-shrink-0 w-8 flex items-center justify-center">
                <span className={getStatusColor(event.status)}>
                  {getStatusIcon(event.status)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-[#FAF8F5] text-sm">{event.stage}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getStatusColor(event.status)} bg-[rgba(250,248,245,0.03)]`}>
                    {event.status}
                  </span>
                  {event.durationMs && (
                    <span className="text-xs text-[#6B7280] flex items-center gap-1">
                      <Clock size={10} />
                      {event.durationMs}ms
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#A8A29E] truncate">{event.message}</p>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-1 text-xs text-[#6B7280] font-mono bg-[rgba(250,248,245,0.03)] p-2 rounded overflow-x-auto"
                  >
                    {JSON.stringify(event.metadata, null, 2)}
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredEvents.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[#6B7280]">
            <p className="text-sm">No events match the current filters</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[rgba(250,248,245,0.06)]">
        <span className="text-xs text-[#6B7280]">
          {filteredEvents.length} / {events.length} events
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(JSON.stringify(events, null, 2))}
            className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[#8B5CF6]/20 text-[#A8A29E] hover:text-[#8B5CF6] transition-colors"
            title="Copy all events"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'pipeline-events.json'
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[#8B5CF6]/20 text-[#A8A29E] hover:text-[#8B5CF6] transition-colors"
            title="Download events"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => setFilter('all')}
            className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[#EF4444]/20 text-[#A8A29E] hover:text-[#EF4444] transition-colors"
            title="Clear filters"
          >
            <Filter size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}