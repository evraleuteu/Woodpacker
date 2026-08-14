'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Upload,
  BookOpen,
  Mic,
  FileText,
  Video,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react'
import { loadCourse } from '@/lib/storage'
import { groupFiles as groupFilesFn } from '@/lib/grouping'
import { roleLabel } from '@/lib/package'
import type { AssetKind, Course } from '@/lib/types'

const KIND_META: Record<AssetKind, { label: string; icon: typeof BookOpen }> = {
  pdf: { label: 'PDF', icon: BookOpen },
  docx: { label: 'DOCX', icon: FileText },
  epub: { label: 'EPUB', icon: BookOpen },
  pptx: { label: 'Slides', icon: FileText },
  text: { label: 'Text', icon: FileText },
  audio: { label: 'Audio', icon: Mic },
  video: { label: 'Video', icon: Video },
  image: { label: 'Image', icon: ImageIcon },
  unknown: { label: 'File', icon: FileText },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function MaterialsPage() {
  const [course] = useState<Course | null>(() => loadCourse())

  const allLessons = course?.modules.flatMap((m) => m.lessons) ?? []
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
  const grouped = groupFiles()
  const TEXT_KINDS = ['pdf', 'docx', 'epub', 'pptx', 'text']
  const primaryOf = (files: Course['sourceFiles']) =>
    files.filter((f) => TEXT_KINDS.includes(f.kind)).sort((a, b) => b.words - a.words)[0] ?? files[0]

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Language Materials</h1>
          <p className="text-[#A8A29E] text-sm mt-1">The files Woodpecker turned into your learning system.</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#059669] to-[#10B981] text-white text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.97]"
        >
          <Upload size={14} />
          Upload New
        </Link>
      </motion.div>

      {!course || !course.sourceFiles.length ? (
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4 ai-glow">
            <Upload size={22} className="text-white" />
          </div>
          <h3 className="font-semibold mb-1">No materials yet</h3>
          <p className="text-sm text-[#A8A29E] mb-4 max-w-md mx-auto">
            Upload a textbook, PDF, workbook, audio or notes — Woodpecker will reconstruct them into lessons, vocabulary and grammar automatically.
          </p>
          <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Upload size={14} />
            Upload your first materials
          </Link>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="glass-card rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-white" />
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
          </div>

          {grouped.map((group) => {
            const primary = primaryOf(group.files)
            const meta = KIND_META[primary.kind] ?? KIND_META.unknown
            const Icon = meta.icon
            const ids = group.files.map((f) => f.id)
            const stats = statsFor(ids)
            const totalWords = group.files.reduce((n, f) => n + (f.words ?? 0), 0)
            const hasText = totalWords > 0
            const coverage = course.stats.lessons ? Math.round((stats.lessons / course.stats.lessons) * 100) : 0
            return (
              <div key={group.key} className="glass-card rounded-xl p-6 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(250,248,245,0.03)] flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-[#10B981]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{group.display}</h3>
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
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] text-[#10B981]"
                          >
                            {roleLabel(role!)}
                          </span>
                        ))}
                      </div>
                      {group.files.length > 1 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {group.files.slice(0, 6).map((f) => (
                            <span key={f.id} className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)] text-[#6B7280]">
                              {f.name} {f.words ? `(${f.words.toLocaleString()}w)` : ''}
                            </span>
                          ))}
                          {group.files.length > 6 && <span className="text-[10px] text-[#6B7280]">+{group.files.length - 6} more</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]">
                      {hasText ? 'Active' : 'Context'}
                    </span>
                    <span className="text-sm font-semibold text-gradient">{coverage}%</span>
                  </div>
                </div>

                <div className="progress-bar mb-4">
                  <div className="progress-bar-fill" style={{ width: `${coverage}%` }} />
                </div>

                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: 'Lessons', value: stats.lessons },
                    { label: 'Vocabulary', value: stats.vocab },
                    { label: 'Grammar', value: stats.grammar },
                    { label: 'Speaking', value: stats.speaking },
                    { label: 'Exercises', value: course.stats.exercises },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center p-2.5 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                      <div className="text-sm font-bold">{stat.value}</div>
                      <div className="text-xs text-[#6B7280]">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-[rgba(250,248,245,0.06)]">
                  <Link
                    href="/speaking"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[rgba(16,185,129,0.1)] to-[rgba(5,150,105,0.08)] border border-[rgba(16,185,129,0.2)] text-[#10B981] text-xs font-medium hover:border-[rgba(16,185,129,0.35)] transition-all"
                  >
                    <Mic size={12} />
                    Start Speaking
                  </Link>
                  <Link
                    href="/cycles"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-xs text-[#6B7280] hover:text-[#FAF8F5] transition-all"
                  >
                    Review Cycles
                  </Link>
                  <Link
                    href="/upload"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-xs text-[#6B7280] hover:text-[#FAF8F5] transition-all"
                  >
                    Details
                  </Link>
                </div>
              </div>
            )
          })}
        </motion.div>
      )}
    </motion.div>
  )
}
