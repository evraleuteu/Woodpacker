'use client'

import { Code, Search } from 'lucide-react'
import { useState, useMemo } from 'react'
import { JSONTree } from './JSONExplorer'

interface RawDataViewerProps {
  rawData: Record<string, unknown>
}

export function RawDataViewer({ rawData }: RawDataViewerProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'code'>('tree')
  const [search, setSearch] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['root'])

  const filteredData = useMemo(() => {
    if (!search) return rawData
    const searchLower = search.toLowerCase()
    const filter = (obj: unknown): unknown => {
      if (typeof obj !== 'object' || obj === null) return obj
      if (Array.isArray(obj)) {
        return obj.map(filter).filter((v) => v !== undefined && v !== null)
      }
      const filtered: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        const filteredValue = filter(value)
        if (filteredValue !== undefined && filteredValue !== null) {
          if (typeof filteredValue === 'object' && Object.keys(filteredValue).length === 0) continue
          if (JSON.stringify(filteredValue).toLowerCase().includes(searchLower) || key.toLowerCase().includes(searchLower)) {
            filtered[key] = filteredValue
          }
        }
      }
      return Object.keys(filtered).length > 0 ? filtered : undefined
    }
    return filter(rawData)
  }, [rawData, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#A8A29E]">View:</label>
          <div className="flex bg-[rgba(250,248,245,0.03)] rounded-lg p-1">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'tree' ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
            >
              <Code size={14} /> Tree
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'code' ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
            >
              Code
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Filter keys/values..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)] rounded-lg px-10 py-2 pl-10 text-sm text-[#FAF8F5] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#0C0C0C] rounded-lg border border-[rgba(250,248,245,0.06)] overflow-hidden">
        {viewMode === 'code' ? (
          <pre className="p-4 text-xs font-mono text-[#A8A29E] overflow-x-auto max-h-[600px]">
            {JSON.stringify(filteredData, null, 2)}
          </pre>
        ) : (
          <JSONTree
            data={filteredData}
            path="root"
            expandedKeys={expandedKeys}
            onToggleExpand={setExpandedKeys}
          />
        )}
      </div>
    </div>
  )
}