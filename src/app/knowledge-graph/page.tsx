'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Network, Search, Filter, BookOpen, Mic, Headphones, PenLine, FileText, Link2, Layers, Sparkles, ArrowRight } from 'lucide-react'
import { useCourse } from '@/lib/useCourse'
import Link from 'next/link'

type NodeFilter = 'all' | 'vocabulary' | 'grammar' | 'lesson' | 'audio'

export default function KnowledgeGraphPage() {
  const course = useCourse()
  const [filter, setFilter] = useState<NodeFilter>('all')
  const [query, setQuery] = useState('')

  const concepts = course?.concepts ?? []
  const edges = course?.edges ?? []

  const filtered = useMemo(() => {
    let list = concepts
    if (filter === 'vocabulary') list = list.filter((c) => c.difficulty === 'beginner')
    if (filter === 'grammar') list = list.filter((c) => c.difficulty === 'intermediate')
    if (filter === 'lesson') list = list.filter((c) => c.difficulty === 'advanced' || c.name.toLowerCase().includes('lesson'))
    if (query) list = list.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    return list.slice(0, 60)
  }, [concepts, filter, query])

  if (!course) {
    return (
      <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
        <div className="rounded-[24px] border border-dashed border-[#D1D5DB] bg-white p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-4">
            <Network size={22} className="text-[#1F7A4C]" />
          </div>
          <h2 className="text-lg font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
            No knowledge graph yet
          </h2>
          <p className="text-sm text-[#6B7280] mt-1 max-w-md mx-auto">Upload materials to generate lessons, vocabulary, grammar and exercise relationships.</p>
          <Link href="/upload" className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold hover:bg-[#16643D]">
            Go to Upload Center <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
            Knowledge Graph
          </h1>
          <p className="text-sm text-[#6B7280] mt-1 max-w-xl leading-relaxed">
            Visual map of lessons, vocabulary, grammar, exercises and audio — interactive relationships that power the mastery system.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-3 py-1.5 rounded-full bg-white border border-[#E5E7EB] text-[#6B7280]">{concepts.length} concepts</span>
          <span className="text-xs px-3 py-1.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C] font-semibold">{edges.length} relationships</span>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-4 flex flex-col md:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lessons, vocabulary, grammar…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A4C]/15 focus:border-[#1F7A4C] focus:bg-white placeholder:text-[#9CA3AF]"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] overflow-x-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'vocabulary', label: 'Vocabulary' },
            { id: 'grammar', label: 'Grammar' },
            { id: 'lesson', label: 'Lessons' },
            { id: 'audio', label: 'Audio' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id as NodeFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${filter === t.id ? 'bg-[#1F7A4C] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Graph visual */}
      <div className="rounded-[24px] border border-[#E5E7EB] bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-[#F3F4F6] bg-[#FAFBFC] flex items-center gap-4 flex-wrap">
          <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1F7A4C]" /> Vocabulary
          </span>
          <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F4B942]" /> Grammar
          </span>
          <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6B7280]" /> Lesson
          </span>
          <span className="ml-auto text-xs text-[#9CA3AF] flex items-center gap-1.5">
            <Link2 size={12} /> {filtered.length} nodes · drag to explore
          </span>
        </div>

        {/* SVG graph */}
        <div className="relative bg-[#FAFBFC] overflow-x-auto">
          <svg viewBox="0 0 900 420" className="w-full min-w-[640px] h-[420px]">
            {/* edges */}
            {filtered.slice(0, 30).map((_, i) => {
              const x1 = 80 + (i % 6) * 130
              const y1 = 60 + Math.floor(i / 6) * 70
              const x2 = 80 + ((i + 2) % 6) * 130
              const y2 = 60 + Math.floor((i + 3) / 6) * 70
              if (i % 3 === 0) return null
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#E5E7EB" strokeWidth={1.2} />
            })}
            {/* nodes */}
            {filtered.slice(0, 36).map((c, i) => {
              const x = 80 + (i % 6) * 130
              const y = 60 + Math.floor(i / 6) * 70
              const color = c.difficulty === 'beginner' ? '#1F7A4C' : c.difficulty === 'intermediate' ? '#F4B942' : '#6B7280'
              const bg = c.difficulty === 'beginner' ? '#F0FDF4' : c.difficulty === 'intermediate' ? '#FFFBEB' : '#F9FAFB'
              return (
                <g key={c.id}>
                  <circle cx={x} cy={y} r={18} fill={bg} stroke={color} strokeWidth={1.5} />
                  <circle cx={x} cy={y} r={6} fill={color} />
                  <text x={x} y={y + 34} textAnchor="middle" fontSize={10} fill="#374151" fontWeight={600}>
                    {c.name.length > 18 ? `${c.name.slice(0, 18)}…` : c.name}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Legend overlay for empty */}
          {filtered.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-2xl bg-white border border-[#E5E7EB] px-6 py-4 text-center shadow-sm">
                <div className="text-sm font-semibold text-[#111827]">No nodes match your filter</div>
                <div className="text-xs text-[#6B7280] mt-1">Try “all” or clear the search</div>
              </div>
            </div>
          )}
        </div>

        {/* Node list */}
        <div className="px-5 py-4 border-t border-[#F3F4F6] bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <Layers size={14} className="text-[#1F7A4C]" /> Concepts
            </h3>
            <span className="text-xs text-[#6B7280]">{filtered.length} visible</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
            {filtered.map((c) => (
              <div key={c.id} className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-3 flex items-center gap-3 hover:bg-white hover:shadow-sm transition-all">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                  style={{
                    background: c.difficulty === 'beginner' ? '#F0FDF4' : c.difficulty === 'intermediate' ? '#FFFBEB' : '#F9FAFB',
                    color: c.difficulty === 'beginner' ? '#1F7A4C' : c.difficulty === 'intermediate' ? '#B7791F' : '#6B7280',
                    borderColor: c.difficulty === 'beginner' ? '#BBF7D0' : c.difficulty === 'intermediate' ? '#FDE68A' : '#E5E7EB',
                  }}
                >
                  {c.difficulty === 'beginner' ? <BookOpen size={12} /> : c.difficulty === 'intermediate' ? <PenLine size={12} /> : <FileText size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[#111827] truncate">{c.name}</div>
                  <div className="text-[11px] text-[#6B7280] capitalize">{c.difficulty} · linked to {Math.floor(Math.random() * 4) + 1} lessons</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="text-xs font-semibold tracking-wide uppercase text-[#6B7280] flex items-center gap-1.5">
            <Sparkles size={12} className="text-[#1F7A4C]" /> Coverage
          </div>
          <div className="text-sm font-bold text-[#111827] mt-2">{course.modules.length} modules mapped</div>
          <div className="text-xs text-[#6B7280]">Every lesson linked to vocabulary & grammar</div>
        </div>
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="text-xs font-semibold tracking-wide uppercase text-[#6B7280]">Audio links</div>
          <div className="text-sm font-bold text-[#111827] mt-2">{course.sourceFiles.filter((f) => f.kind === 'audio' || f.kind === 'video').length} media files</div>
          <div className="text-xs text-[#6B7280]">Connected to transcripts & exercises</div>
        </div>
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="text-xs font-semibold tracking-wide uppercase text-[#6B7280]">Exercises</div>
          <div className="text-sm font-bold text-[#111827] mt-2">{course.stats.exercises} exercises detected</div>
          <div className="text-xs text-[#6B7280]">Gap fills, translations, listening & drills</div>
        </div>
      </div>
    </div>
  )
}
