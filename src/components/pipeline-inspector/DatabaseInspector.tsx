'use client'

import { Copy, Download, Search, X, Database, Code, FileText, Link2, CheckCircle } from 'lucide-react'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'

interface DatabaseInspectorProps {
  records: {
    exercise: Record<string, unknown> | null
    assets: Record<string, unknown>[]
    relationships: Record<string, unknown>[]
    solutions: Record<string, unknown>[]
  }
}

export function DatabaseInspector({ records }: DatabaseInspectorProps) {
  const [activeTab, setActiveTab] = useState<'exercise' | 'assets' | 'relationships' | 'solutions'>('exercise')
  const [viewMode, setViewMode] = useState<'tree' | 'code'>('tree')
  const [search, setSearch] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['root'])
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  const tabs = [
    { key: 'exercise', label: 'Exercise', icon: FileText, count: records.exercise ? 1 : 0 },
    { key: 'assets', label: 'Assets', icon: Database, count: records.assets.length },
    { key: 'relationships', label: 'Relationships', icon: Link2, count: records.relationships.length },
    { key: 'solutions', label: 'Solutions', icon: FileText, count: records.solutions.length },
  ] as const

  const data = activeTab === 'exercise' ? (records.exercise || {}) : records[activeTab]

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopySuccess(activeTab)
    setTimeout(() => setCopySuccess(null), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeTab}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-[#A8A29E]">Table:</label>
          <div className="flex gap-1 bg-[rgba(250,248,245,0.03)] rounded-lg p-1">
            {tabs.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1 ${activeTab === key ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
              >
                <Icon size={12} />
                {label}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${activeTab === key ? 'bg-white/20 text-white' : 'bg-[rgba(250,248,245,0.06)] text-[#A8A29E]'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Filter keys/values/paths..."
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

          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${viewMode === 'tree' ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
            >
              <Code size={12} /> Tree
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${viewMode === 'code' ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
            >
              Code
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={handleCopy} className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[#8B5CF6]/20 text-[#A8A29E] hover:text-[#8B5CF6] transition-colors" title="Copy JSON">
              {copySuccess === activeTab ? (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><CheckCircle size={16} className="text-[#10B981]" /></motion.span>
              ) : (
                <Copy size={16} />
              )}
            </button>
            <button onClick={handleDownload} className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[#8B5CF6]/20 text-[#A8A29E] hover:text-[#8B5CF6] transition-colors" title="Download JSON">
              <Download size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#0C0C0C] rounded-lg border border-[rgba(250,248,245,0.06)] overflow-hidden min-h-[400px]">
        {activeTab === 'exercise' && data && (
          <ExerciseRecordView data={data as Record<string, unknown>} viewMode={viewMode} expandedKeys={expandedKeys} onToggleExpand={setExpandedKeys} search={search} />
        )}
        {activeTab !== 'exercise' && (
          <TableView data={data} search={search} />
        )}
      </div>
    </div>
  )
}

function ExerciseRecordView({ data, viewMode, expandedKeys, onToggleExpand, search }: { data: Record<string, unknown>; viewMode: 'tree' | 'code'; expandedKeys: string[]; onToggleExpand: (keys: string[]) => void; search: string }) {
  const filteredData = useMemo(() => {
    if (!search) return data
    const searchLower = search.toLowerCase()
    const filter = (obj: unknown): unknown => {
      if (typeof obj !== 'object' || obj === null) return obj
      if (Array.isArray(obj)) {
        return obj.map(filter).filter((v) => v !== undefined)
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
    return filter(data)
  }, [data, search])

  return (
    <div className="p-4 font-mono text-sm">
      <JSONTreeItem
        value={filteredData}
        path="exercise"
        viewMode={viewMode}
        expandedKeys={expandedKeys}
        onToggleExpand={onToggleExpand}
      />
    </div>
  )
}

function TableView({ data, search }: { data: Record<string, unknown> | Record<string, unknown>[]; search: string }) {
  const filteredData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return []
    if (!search) return data
    const searchLower = search.toLowerCase()
    return data.filter((row) =>
      JSON.stringify(row).toLowerCase().includes(searchLower)
    )
  }, [data, search])

  const columns = useMemo(() => {
    const allKeys = new Set<string>()
    filteredData.forEach((row) => Object.keys(row).forEach(k => allKeys.add(k)))
    return Array.from(allKeys)
  }, [filteredData])

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="p-8 text-center text-[#6B7280]">
        No records found
      </div>
    )
  }

  if (filteredData.length === 0) {
    return (
      <div className="p-8 text-center text-[#6B7280]">
        No matching records
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[rgba(250,248,245,0.06)]">
            {columns.map(col => (
              <th key={col} className="px-3 py-2 text-left text-xs text-[#6B7280] font-medium uppercase tracking-wider">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[rgba(250,248,245,0.03)] hover:bg-[rgba(250,248,245,0.02)]">
              {columns.map(col => (
                <td key={col} className="px-3 py-2 text-[#FAF8F5] font-mono text-xs">
                  {formatValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JSONTreeItem({ value, path, viewMode, expandedKeys, onToggleExpand, level = 0 }: { value: unknown; path: string; viewMode: 'tree' | 'code'; expandedKeys: string[]; onToggleExpand: (keys: string[]) => void; level?: number }) {
  const isObject = value !== null && typeof value === 'object'
  const isArray = Array.isArray(value)
  const isExpandable = isObject && (isArray ? (value as unknown[]).length > 0 : Object.keys(value as Record<string, unknown>).length > 0)
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value

  const getTypeColor = (t: string) => {
    switch (t) {
      case 'string': return 'text-[#10B981]'
      case 'number': return 'text-[#F59E0B]'
      case 'boolean': return 'text-[#8B5CF6]'
      case 'null': return 'text-[#6B7280]'
      default: return 'text-[#A8A29E]'
    }
  }

  const formatValue = (v: unknown) => {
    if (v === null) return 'null'
    if (typeof v === 'string') return `"${v}"`
    return String(v)
  }

  if (!isExpandable) {
    return (
      <div className="flex items-center gap-2 py-1 px-4 hover:bg-[rgba(250,248,245,0.02)]">
        <span className="w-8" />
        {path !== 'exercise' && <span className="text-[#A8A29E] font-mono text-sm min-w-[120px]">{path.split('.').pop()}: </span>}
        <span className={getTypeColor(type)}>{formatValue(value)}</span>
      </div>
    )
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as object)

  return (
    <div>
      <div className="flex items-center gap-2 py-1 px-4 hover:bg-[rgba(250,248,245,0.02)]">
        <button
          onClick={() => onToggleExpand(expandedKeys.includes(path) ? expandedKeys.filter((k: string) => k !== path) : [...expandedKeys, path])}
          className="p-0.5 text-[#A8A29E] hover:text-[#FAF8F5] rounded transition-colors"
        >
          <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: `rotate(${true ? 0 : -90}deg)` }}>
            ▶
          </span>
        </button>
        {path !== 'exercise' && <span className="text-[#A8A29E] font-mono text-sm min-w-[120px]">{path.split('.').pop()}: </span>}
        <span className="text-[#6B7280] font-mono text-xs">
          {isArray ? `[${(value as unknown[]).length}]` : `{${Object.keys(value as object).length}`}
        </span>
        <span className="text-[#6B7280] font-mono text-xs">({type})</span>
      </div>
      {true && (
        <div className="ml-4 border-l border-[rgba(250,248,245,0.06)]">
          {entries.map(([k, v]) => (
            <div key={k}>
              <JSONTreeItem
                key={k}
                value={v}
                path={`${path}.${k}`}
                viewMode={viewMode}
                expandedKeys={expandedKeys}
                onToggleExpand={onToggleExpand}
                level={level + 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatValue(v: unknown) {
  if (v === null) return 'null'
  if (typeof v === 'string') return v.length > 50 ? `"${v.slice(0, 50)}..."` : `"${v}"`
  if (typeof v === 'object') return v === null ? 'null' : Array.isArray(v) ? `[${v.length}]` : `{${Object.keys(v).length}}`
  return String(v)
}