'use client'

import { Code, Search, X, MessageSquare, Zap, Clock } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'

interface LangChainInspectorProps {
  chains: Array<{
    name: string
    prompt: string
    output: string
    intermediateSteps?: Array<{ action: string; observation: string }>
    durationMs: number
  }>
}

export function LangChainInspector({ chains }: LangChainInspectorProps) {
  const [selectedChain, setSelectedChain] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'tree' | 'code'>('code')
  const [search, setSearch] = useState('')

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#A8A29E]">Chain:</label>
          <select
            value={selectedChain || chains[0]?.name || ''}
            onChange={(e) => setSelectedChain(e.target.value)}
            className="bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)] rounded-lg px-3 py-1.5 text-sm text-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
          >
            {chains.map((c, i) => (
              <option key={c.name} value={c.name}>
                {i + 1}. {c.name} ({c.durationMs}ms)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Search in prompt/output..."
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
              onClick={() => setViewMode('code')}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${viewMode === 'code' ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}
            >
              <Code size={12} /> Code
            </button>
          </div>
        </div>
      </div>

      {chains.length === 0 ? (
        <div className="text-center py-8 text-[#A8A29E]">No LangChain chains recorded</div>
      ) : (
        <motion.div
          key={selectedChain || chains[0]?.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {(() => {
            const chain = chains.find(c => c.name === selectedChain) || chains[0]
            if (!chain) return null

            const searchLower = search.toLowerCase()
            const promptMatch = chain.prompt.toLowerCase().includes(searchLower)
            const outputMatch = chain.output.toLowerCase().includes(searchLower)

            return (
              <div className="space-y-4">
                <div className="p-4 bg-[rgba(250,248,245,0.02)] rounded-xl border border-[rgba(250,248,245,0.06)]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-[#FAF8F5] flex items-center gap-2">
                      <Zap size={16} className="text-[#8B5CF6]" />
                      {chain.name}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-[#A8A29E]">
                      <span className="flex items-center gap-1"><Clock size={12} /> {chain.durationMs}ms</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-[#0C0C0C] rounded-xl border border-[rgba(250,248,245,0.06)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#A8A29E] font-medium">Prompt</span>
                      <span className="text-xs text-[#6B7280] font-mono">{chain.prompt.length} chars</span>
                    </div>
                    {search && searchLower && promptMatch ? (
                      <pre
                        className="text-xs font-mono text-[#A8A29E] whitespace-pre-wrap max-h-96 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: highlightSearch(chain.prompt, searchLower) }}
                      />
                    ) : (
                      <pre className="text-xs font-mono text-[#A8A29E] whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {chain.prompt}
                      </pre>
                    )}
                  </div>

                  <div className="p-4 bg-[#0C0C0C] rounded-xl border border-[rgba(250,248,245,0.06)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#A8A29E] font-medium">Output</span>
                      <span className="text-xs text-[#6B7280] font-mono">{chain.output.length} chars</span>
                    </div>
                    {search && searchLower && outputMatch ? (
                      <pre
                        className="text-xs font-mono text-[#10B981] whitespace-pre-wrap max-h-96 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: highlightSearch(chain.output, searchLower) }}
                      />
                    ) : (
                      <pre className="text-xs font-mono text-[#10B981] whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {chain.output}
                      </pre>
                    )}
                  </div>

                  {chain.intermediateSteps && chain.intermediateSteps.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="font-medium text-[#FAF8F5] flex items-center gap-2">
                        <MessageSquare size={14} className="text-[#8B5CF6]" />
                        Intermediate Steps ({chain.intermediateSteps.length})
                      </h5>
                      <div className="space-y-2">
                        {chain.intermediateSteps.map((step, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-3 rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-[#6B7280] font-mono bg-[rgba(250,248,245,0.03)] px-2 py-0.5 rounded">Step {i + 1}</span>
                              <span className="font-medium text-[#FAF8F5]">{step.action}</span>
                            </div>
                            <pre className="text-xs font-mono text-[#A8A29E] whitespace-pre-wrap ml-4">
                              {step.observation}
                            </pre>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
      </motion.div>
    )}
  </div>
)
}

function highlightSearch(text: string, search: string) {
  if (!search) return text
  const regex = new RegExp(`(${search})`, 'gi')
  return text.replace(regex, '<mark class="bg-[#F59E0B]/30 text-[#F59E0B] px-0.5 rounded">$1</mark>')
}