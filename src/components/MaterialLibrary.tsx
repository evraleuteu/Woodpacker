'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'
import {
  Upload,
  BookOpen,
  Mic,
  FileText,
  Video,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  Loader2,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { groupFiles as groupFilesFn } from '@/lib/grouping'
import { roleLabel } from '@/lib/package'
import type { AssetKind, Course } from '@/lib/types'
import { deleteCourseMaterialFile } from '@/lib/storage'

const KIND_META: Record<AssetKind, { label: string; icon: typeof BookOpen; color: string }> = {
  pdf: { label: 'PDF', icon: BookOpen, color: '#1F7A4C' },
  docx: { label: 'DOCX', icon: FileText, color: '#1F7A4C' },
  epub: { label: 'EPUB', icon: BookOpen, color: '#1F7A4C' },
  pptx: { label: 'Slides', icon: FileText, color: '#1F7A4C' },
  text: { label: 'Text', icon: FileText, color: '#1F7A4C' },
  audio: { label: 'Audio', icon: Mic, color: '#1F7A4C' },
  video: { label: 'Video', icon: Video, color: '#1F7A4C' },
  image: { label: 'Image', icon: ImageIcon, color: '#1F7A4C' },
  unknown: { label: 'File', icon: FileText, color: '#1F7A4C' },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function MaterialLibrary({ course }: { course: Course | null }) {
  const allLessons = course?.modules.flatMap((m) => m.lessons) ?? []
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | AssetKind>('all')
  const statsFor = (fileIds: string[]) => {
    const lessons = allLessons.filter((l) => l.sourceAssets.some((id) => fileIds.includes(id)))
    const vocab = lessons.reduce((n, l) => n + l.vocabulary.length, 0)
    const grammar = lessons.reduce((n, l) => n + l.grammar.length, 0)
    const speaking = lessons.reduce(
      (n, l) => n + l.materials.speaking.drills.length + l.materials.speaking.roleplays.length + l.materials.speaking.recalls.length,
      0
    )
    return { lessons: lessons.length, vocab, grammar, speaking }
  }

  const groupFiles = () => {
    if (!course) return []
    return groupFilesFn(course.sourceFiles)
  }
  const TEXT_KINDS = ['pdf', 'docx', 'epub', 'pptx', 'text']
  const primaryOf = (files: Course['sourceFiles']) =>
    files.filter((f) => TEXT_KINDS.includes(f.kind)).sort((a, b) => b.words - a.words)[0] ?? files[0]
  const grouped = groupFiles().filter((group) => {
    const primary = primaryOf(group.files)
    const haystack = [group.display, ...group.files.map((file) => file.name)].join(' ').toLowerCase()
    return (kindFilter === 'all' || primary.kind === kindFilter) && haystack.includes(query.trim().toLowerCase())
  })

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!course) return
    if (!confirm(`Delete "${fileName}"? This will also remove it from MinIO storage and the database. This cannot be undone.`)) return
    setDeletingId(fileId)
    setError(null)
    try {
      await deleteCourseMaterialFile(course.id, fileId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete material')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Language Materials</h1>
          <p className="text-[#6B7280] text-sm mt-1">Browse your source files, open a preview, or jump straight into practice.</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold transition-all hover:bg-[#16643D] shadow-sm"
        >
          <Upload size={14} />
          Upload New
        </Link>
      </motion.div>

      {!course || !course.sourceFiles.length ? (
        <motion.div variants={itemVariants} className="rounded-[20px] border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-4">
            <Upload size={22} className="text-[#1F7A4C]" />
          </div>
          <h3 className="font-semibold mb-1">No materials yet</h3>
          <p className="text-sm text-[#6B7280] mb-4 max-w-md mx-auto">
            Upload a textbook, PDF, workbook, audio or notes — Woodpecker will reconstruct them into lessons, vocabulary and grammar automatically.
          </p>
          <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Upload size={14} />
            Upload your first materials
          </Link>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <motion.div variants={itemVariants} className="rounded-[20px] border border-[#E5E7EB] bg-white p-4 flex items-center gap-3 shadow-sm md:col-span-2 xl:col-span-3">
            <div className="w-9 h-9 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-[#1F7A4C]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{course.title}</div>
              <div className="text-xs text-[#6B7280]">
                {course.modules.length} module(s) · {course.stats.lessons} lessons · {course.stats.vocabulary} vocabulary · {course.stats.grammar} grammar · created{' '}
                {new Date(course.createdAt).toLocaleDateString()} ({course.mode === 'ai' ? 'AI-built' : 'built locally'})
              </div>
            </div>
            <Link href="/upload" className="ml-auto btn-secondary text-xs px-3 py-1.5 shrink-0">
              View Course
            </Link>
          </motion.div>

          <div className="flex flex-col sm:flex-row gap-2 mb-2 md:col-span-2 xl:col-span-3">
            <label className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search materials..." className="w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-3 text-sm text-[#111827] outline-none transition focus:border-[#1F7A4C] focus:ring-2 focus:ring-[#1F7A4C]/10" />
            </label>
            <label className="relative">
              <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as 'all' | AssetKind)} className="appearance-none rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-8 text-sm text-[#374151] outline-none focus:border-[#1F7A4C]">
                <option value="all">All file types</option>
                {Object.entries(KIND_META).filter(([kind]) => kind !== 'unknown').map(([kind, meta]) => <option key={kind} value={kind}>{meta.label}</option>)}
              </select>
            </label>
          </div>
          <div className="text-xs text-[#6B7280] mb-3 md:col-span-2 xl:col-span-3">{grouped.length} material{grouped.length === 1 ? '' : 's'} {query || kindFilter !== 'all' ? 'matching your filters' : 'in your library'}</div>
          {error && (
            <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#EF4444] text-xs px-3 py-2 md:col-span-2 xl:col-span-3">
              {error}
            </div>
          )}
          {grouped.length === 0 ? (
            <motion.div variants={itemVariants} className="rounded-[20px] border border-[#E5E7EB] bg-white p-10 text-center shadow-sm md:col-span-2 xl:col-span-3">
              <Search size={22} className="mx-auto mb-3 text-[#9CA3AF]" />
              <h3 className="font-semibold text-[#111827]">No matching materials</h3>
              <p className="text-sm text-[#6B7280] mt-1">Try a different search or clear the file type filter.</p>
              <button onClick={() => { setQuery(''); setKindFilter('all') }} className="btn-secondary text-xs mt-4">Clear filters</button>
            </motion.div>
          ) : grouped.map((group) => {
            const primary = primaryOf(group.files)
            const meta = KIND_META[primary.kind] ?? KIND_META.unknown
            const Icon = meta.icon
            const ids = group.files.map((f) => f.id)
            const stats = statsFor(ids)
            const totalWords = group.files.reduce((n, f) => n + (f.words ?? 0), 0)
            const hasText = totalWords > 0
            const coverage = course.stats.lessons ? Math.round((stats.lessons / course.stats.lessons) * 100) : 0
            return (
              <motion.div
                key={group.key}
                variants={itemVariants}
                className="min-w-0 overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
                style={{ backgroundColor: `${meta.color}0D`, borderColor: `${meta.color}35` }}
              >
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(31,122,76,0.12)] flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-[#1F7A4C]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-[#1F7A4C] truncate max-w-full">
                        <Link href={`/materials/${primary.id}`} className="text-[#1F7A4C] hover:text-[#16643D] transition-colors">
                          {group.display}
                        </Link>
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280] mt-0.5">
                        <span>{meta.label}</span>
                        <span>&middot;</span>
                        <span>{hasText ? `${totalWords.toLocaleString()} words` : 'Metadata only'}</span>
                        {group.files.length > 1 && (
                          <>
                            <span>&middot;</span>
                            <span>{group.files.length} files</span>
                          </>
                        )}
                        {[...new Set(group.files.map((f) => f.role).filter(Boolean))].map((role) => (
                          <span
                            key={role}
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: `${meta.color}12`, border: `1px solid ${meta.color}35`, color: meta.color }}
                          >
                            {roleLabel(role!)}
                          </span>
                        ))}
                      </div>
                      {group.files.length > 1 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {group.files.slice(0, 6).map((f) => (
                            <span key={f.id} className="inline-flex min-w-0 max-w-full items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#F9FAFB] border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827] hover:border-[rgba(16,185,129,0.3)] transition-all">
                                <Link href={`/materials/${f.id}`} className="min-w-0 max-w-full truncate hover:underline">{f.name} {f.words ? `(${f.words.toLocaleString()}w)` : ''}</Link>
                              <button
                                onClick={() => handleDeleteFile(f.id, f.name)}
                                disabled={deletingId === f.id}
                                title={`Delete ${f.name}`}
                                className="p-0.5 rounded hover:bg-[#FEE2E2] text-[#6B7280] hover:text-[#EF4444] disabled:opacity-50"
                              >
                                {deletingId === f.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                              </button>
                            </span>
                          ))}
                          {group.files.length > 6 && <span className="text-[10px] text-[#6B7280]">+{group.files.length - 6} more</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${meta.color}16`, color: meta.color, border: `1px solid ${meta.color}35` }}>
                      {hasText ? 'Active' : 'Context'}
                    </span>
                    <span className="text-sm font-semibold text-gradient">{coverage}%</span>
                    <button
                      onClick={() => handleDeleteFile(primary.id, primary.name)}
                      disabled={deletingId === primary.id}
                      title={`Delete ${primary.name} and remove from storage`}
                      className="p-1.5 rounded-lg border border-[#FECACA] bg-[rgba(239,68,68,0.06)] text-[#EF4444] hover:bg-[#FEE2E2] disabled:opacity-50 transition-colors"
                    >
                      {deletingId === primary.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>

                <div className="progress-bar mb-4">
                  <div className="progress-bar-fill" style={{ width: `${coverage}%` }} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: 'Lessons', value: stats.lessons },
                    { label: 'Vocabulary', value: stats.vocab },
                    { label: 'Grammar', value: stats.grammar },
                    { label: 'Speaking', value: stats.speaking },
                    { label: 'Exercises', value: course.stats.exercises },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center p-2.5 rounded-lg bg-[#FAFBFC] border border-[#E5E7EB]">
                      <div className="text-sm font-bold">{stat.value}</div>
                      <div className="text-xs text-[#6B7280]">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-[#E5E7EB]">
                  <Link
                    href="/speaking"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C] text-xs font-medium transition-all"
                  >
                    <Mic size={12} />
                    Start Speaking
                  </Link>
                  <Link
                    href="/cycles"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAFBFC] border border-[#E5E7EB] text-xs text-[#6B7280] hover:text-[#111827] transition-all"
                  >
                    Review Cycles
                  </Link>
                  <Link
                    href={`/materials/${primary.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAFBFC] border border-[#E5E7EB] text-xs text-[#6B7280] hover:text-[#111827] transition-all"
                  >
                    Details
                  </Link>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </>
  )
}