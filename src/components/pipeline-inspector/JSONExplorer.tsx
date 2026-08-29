'use client'

import { Copy, Code, Download, Search, X, CheckCircle, FileJson, Image, Database, FileText, type LucideIcon } from 'lucide-react'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'

interface JSONExplorerProps {
  rawJson: Record<string, unknown>
}

type JsonKey = 'rawOcrJson' | 'parsedPageJson' | 'exerciseJson' | 'assetJson' | 'relationshipJson' | 'solutionJson' | 'finalDatabaseJson'

const JSON_KEYS: { key: JsonKey; label: string; icon: LucideIcon }[] = [
  { key: 'rawOcrJson', label: 'Raw OCR JSON', icon: Code },
  { key: 'parsedPageJson', label: 'Parsed Page JSON', icon: Code },
  { key: 'exerciseJson', label: 'Exercise JSON', icon: FileJson },
  { key: 'assetJson', label: 'Asset JSON', icon: Image },
  { key: 'relationshipJson', label: 'Relationship JSON', icon: Code },
  { key: 'solutionJson', label: 'Solution JSON', icon: FileText },
  { key: 'finalDatabaseJson', label: 'Final DB JSON', icon: Database },
]

export function JSONExplorer({ rawJson }: JSONExplorerProps) {
  const [activeTab, setActiveTab] = useState<JsonKey>('exerciseJson')
  const [viewMode, setViewMode] = useState<'tree' | 'code'>('tree')
  const [search, setSearch] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['root'])
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  const data = useMemo(() => rawJson[activeTab] || {}, [rawJson, activeTab])

  const filteredData = useMemo(() => {
    if (!search) return data
    const searchLower = search.toLowerCase()
    const filter = (obj: unknown, currentPath = ''): unknown => {
      if (typeof obj !== 'object' || obj === null) return obj
      if (Array.isArray(obj)) {
        return obj.map((v, i) => filter(v, `${currentPath}[${i}]`)).filter((v) => v !== undefined)
      }
      const filtered: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key
        const filteredValue = filter(value, newPath)
        if (filteredValue !== undefined && filteredValue !== null) {
          if (typeof filteredValue === 'object' && Object.keys(filteredValue).length === 0) continue
          if (JSON.stringify(filteredValue).toLowerCase().includes(searchLower) || key.toLowerCase().includes(searchLower) || newPath.toLowerCase().includes(searchLower)) {
            filtered[key] = filteredValue
          }
        }
      }
      return Object.keys(filtered).length > 0 ? filtered : undefined
    }
    return filter(data)
  }, [data, search])

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
          <label className="text-xs text-[#A8A29E]">Tab:</label>
          <div className="flex gap-1 bg-[rgba(250,248,245,0.03)] rounded-lg p-1">
            {JSON_KEYS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap ${activeTab === key ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
              >
                {label}
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
        <JSONTree
          data={viewMode === 'code' ? data : filteredData}
          path="root"
          expandedKeys={expandedKeys}
          onToggleExpand={setExpandedKeys}
        />
      </div>
    </div>
  )
}


export function JSONTree({ data, path, expandedKeys, onToggleExpand, level = 0 }: { data: unknown; path: string; expandedKeys: string[]; onToggleExpand: (keys: string[]) => void; level?: number }) {
  const isExpanded = expandedKeys.includes(path)
  const isObject = data !== null && typeof data === 'object'
  const isArray = Array.isArray(data)
  const isExpandable = isObject && (isArray ? (data as unknown[]).length > 0 : Object.keys(data as Record<string, unknown>).length > 0)
  const type = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data

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
    if (typeof v === 'string') return `"` + v + `"`
    return String(v)
  }

  if (!isExpandable) {
    return (
      <div className="flex items-center gap-2 py-1 px-4 hover:bg-[rgba(250,248,245,0.02)]">
        <span className="w-8" />
        {path !== 'root' && <span className="text-[#A8A29E] font-mono text-sm min-w-[120px]">{path.split('.').pop()}: </span>}
        <span className={getTypeColor(type)}>{formatValue(data)}</span>
      </div>
    )
  }

  const entries = isArray
    ? (data as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(data as object)

  return (
    <div>
      <div className="flex items-center gap-2 py-1 px-4 hover:bg-[rgba(250,248,245,0.02)]">
        <button
          onClick={() => onToggleExpand(expandedKeys.includes(path) ? expandedKeys.filter((k) => k !== path) : [...expandedKeys, path])}
          className="p-0.5 text-[#A8A29E] hover:text-[#FAF8F5] rounded transition-colors"
        >
          <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: `rotate(${isExpanded ? 90 : 0}deg)` }}>
            ▶
          </span>
        </button>
        {path !== 'root' && <span className="text-[#A8A29E] font-mono text-sm min-w-[120px]">{path.split('.').pop()}: </span>}
        <span className="text-[#6B7280] font-mono text-xs">
          {isArray ? `[${(data as unknown[]).length}]` : `{${Object.keys(data as object).length}`}
        </span>
        <span className="text-[#6B7280] font-mono text-xs">({type})</span>
      </div>
      {isExpanded && (
        <div className="ml-4 border-l border-[rgba(250,248,245,0.06)]">
          {entries.map(([k, v]) => (
            <div key={k}>
              <JSONTree
                data={v}
                path={`${path}.${k}`}
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

