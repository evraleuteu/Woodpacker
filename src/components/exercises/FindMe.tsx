'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import {
  BookOpen,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Expand,
  ExternalLink,
  FileQuestion,
  FileText,
  Image as ImageIcon,
  Languages,
  ListChecks,
  MapPin,
  MessageSquare,
  Mic,
  Minus,
  Plus,
  Radar,
  Repeat,
  ScrollText,
  TextCursorInput,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { useCourse } from '@/lib/useCourse'
import { parsePageRefs } from '@/lib/exercise-validation'
import { mediaUrlFor } from '@/lib/media-url'
import PdfPageView from '@/components/exercises/PdfPageView'
import type { Course, Exercise, ExerciseType } from '@/lib/types'

const TYPE_META: Record<ExerciseType, { label: string; icon: typeof ClipboardCheck; color: string }> = {
  'fill-blank': { label: 'Fill Blank', icon: TextCursorInput, color: '#10B981' },
  'multiple-choice': { label: 'Multiple Choice', icon: ListChecks, color: '#3B82F6' },
  translation: { label: 'Translation', icon: Languages, color: '#F59E0B' },
  recall: { label: 'Recall', icon: Brain, color: '#8B5CF6' },
  'pattern-drill': { label: 'Pattern Drill', icon: Repeat, color: '#EC4899' },
  roleplay: { label: 'Roleplay', icon: MessageSquare, color: '#14B8A6' },
  comprehension: { label: 'Comprehension', icon: BookOpen, color: '#F97316' },
  assessment: { label: 'Assessment', icon: ClipboardCheck, color: '#EF4444' },
}

type MediaKind = 'pdf' | 'audio' | 'video' | 'image'

const KIND_ORDER: MediaKind[] = ['pdf', 'audio', 'video', 'image']

const KIND_META: Record<MediaKind, { label: string; icon: typeof BookOpen; color: string }> = {
  pdf: { label: 'PDF', icon: BookOpen, color: '#059669' },
  audio: { label: 'Audio', icon: Mic, color: '#10B981' },
  video: { label: 'Video', icon: Video, color: '#EC4899' },
  image: { label: 'Image', icon: ImageIcon, color: '#F97316' },
}

interface MediaRef {
  kind: MediaKind
  mediaId: string
  mediaName: string
  page?: number
  label: string
}

interface NavigableItem {
  exercise: Exercise
  lessonTitle: string
  moduleTitle: string
}

type ExpandView = 'pdf' | 'original' | 'transcript'

interface TranscriptSection {
  page: number | null
  content: string
}

function splitTranscript(text: string): TranscriptSection[] {
  const parts = text.split(/\[PAGE\s+(\d+)\]/i)
  const sections: TranscriptSection[] = []
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const page = Number(parts[i])
      const content = parts[i + 1]?.trim() ?? ''
      if (content) sections.push({ page, content })
      i++
    } else if (parts[i].trim()) {
      sections.push({ page: null, content: parts[i].trim() })
    }
  }
  return sections
}

function TranscriptView({
  text,
  currentPage,
  sectionRefs,
  className,
}: {
  text: string
  currentPage: number
  sectionRefs: { current: Record<number, HTMLDivElement | null> }
  className?: string
}) {
  return (
    <div className={`p-6 space-y-6 ${className ?? ''}`}>
      {splitTranscript(text).map((s, i) =>
        s.page ? (
          <div
            key={s.page}
            ref={(el) => {
              sectionRefs.current[s.page as number] = el
            }}
            className={`rounded-xl p-4 border ${
              s.page === currentPage
                ? 'bg-[rgba(16,185,129,0.06)] border-[rgba(16,185,129,0.25)]'
                : 'bg-[rgba(250,248,245,0.02)] border-[rgba(250,248,245,0.06)]'
            }`}
          >
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#059669] font-semibold mb-2">
              Page {s.page}
            </div>
            <p className="text-sm leading-relaxed text-[#FAF8F5] whitespace-pre-wrap">{s.content}</p>
          </div>
        ) : (
          <p key={i} className="text-sm leading-relaxed text-[#FAF8F5] whitespace-pre-wrap">
            {s.content}
          </p>
        )
      )}
    </div>
  )
}

export default function FindMe() {
  const course = useCourse()

  const items = useMemo<NavigableItem[]>(() => {
    if (!course) return []
    const list: NavigableItem[] = []
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        for (const exercise of lesson.exercises) {
          list.push({ exercise, lessonTitle: lesson.title, moduleTitle: mod.title })
        }
      }
      if (mod.review) {
        for (const exercise of mod.review.exercises) {
          list.push({ exercise, lessonTitle: mod.review.title, moduleTitle: mod.title })
        }
      }
    }
    return list
  }, [course])

  const refsByExercise = useMemo(() => {
    const map = new Map<string, MediaRef[]>()
    if (!course) return map
    const files = course.sourceFiles
    for (const { exercise } of items) {
      const linked = (exercise.sourceAssets ?? [])
        .map((id) => files.find((f) => f.id === id))
        .filter((f): f is Course['sourceFiles'][number] => !!f)
      const sources = exercise.sourceAssets?.length ? linked : files
      const refs: MediaRef[] = []
      const seenMedia = new Set<string>()
      const linkedIds = [...(exercise.requiredAudio ?? []), ...(exercise.requiredVideo ?? [])]
      for (const id of linkedIds) {
        const f = files.find((x) => x.id === id)
        if (!f || !mediaUrlFor(f) || seenMedia.has(f.id)) continue
        seenMedia.add(f.id)
        refs.push({ kind: f.kind === 'video' ? 'video' : 'audio', mediaId: f.id, mediaName: f.name, label: f.name })
      }
      for (const pdf of sources.filter((f) => f.kind === 'pdf' && mediaUrlFor(f) && !seenMedia.has(f.id))) {
        seenMedia.add(pdf.id)
        const pages = (exercise.page ? parsePageRefs(exercise.page) : []).filter((p) => p >= 1 && (!pdf.pageCount || p <= pdf.pageCount))
        if (pages.length) {
          for (const p of pages) refs.push({ kind: 'pdf', mediaId: pdf.id, mediaName: pdf.name, page: p, label: `${exercise.page} · ${pdf.name}` })
        } else {
          refs.push({ kind: 'pdf', mediaId: pdf.id, mediaName: pdf.name, page: 1, label: pdf.name })
        }
      }
      for (const a of sources.filter((f) => f.kind === 'audio' && mediaUrlFor(f) && !seenMedia.has(f.id))) {
        seenMedia.add(a.id)
        refs.push({ kind: 'audio', mediaId: a.id, mediaName: a.name, label: a.name })
      }
      for (const v of sources.filter((f) => f.kind === 'video' && mediaUrlFor(f) && !seenMedia.has(f.id))) {
        seenMedia.add(v.id)
        refs.push({ kind: 'video', mediaId: v.id, mediaName: v.name, label: v.name })
      }
      for (const im of sources.filter((f) => f.kind === 'image' && mediaUrlFor(f) && !seenMedia.has(f.id))) {
        seenMedia.add(im.id)
        refs.push({ kind: 'image', mediaId: im.id, mediaName: im.name, label: im.name })
      }
      map.set(exercise.id, refs)
    }
    return map
  }, [course, items])

  const navigable = useMemo(() => items.filter((i) => (refsByExercise.get(i.exercise.id)?.length ?? 0) > 0), [items, refsByExercise])

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [refIndex, setRefIndex] = useState(0)
  const [zoom, setZoom] = useState(3)
  const [docPages, setDocPages] = useState<Record<string, number>>({})
  const [expandOpen, setExpandOpen] = useState(false)
  const [expandView, setExpandView] = useState<ExpandView>('pdf')
  const [panelView, setPanelView] = useState<'pdf' | 'transcript'>('pdf')
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [media, setMedia] = useState<{ kind: MediaKind; id: string; page: number } | null>(() => {
    if (!course) return null
    const firstItem = navigable[0]
    const first = firstItem ? refsByExercise.get(firstItem.exercise.id)?.[0] : undefined
    return first ? { kind: first.kind, id: first.mediaId, page: first.page ?? 1 } : null
  })

  const filesOfKind = (kind: MediaKind) =>
    course
      ? course.sourceFiles.filter((f): f is Course['sourceFiles'][number] => f.kind === kind && mediaUrlFor(f) !== null)
      : []

  const jumpToRef = (ref: MediaRef) => {
    setMedia({ kind: ref.kind, id: ref.mediaId, page: ref.page ?? 1 })
  }

  const selectItem = (index: number, refIdx = 0) => {
    if (index < 0 || index >= navigable.length) return
    const refs = refsByExercise.get(navigable[index].exercise.id) ?? []
    const ri = Math.min(refIdx, Math.max(0, refs.length - 1))
    setSelectedIndex(index)
    setRefIndex(ri)
    if (refs[ri]) jumpToRef(refs[ri])
  }

  const matchAt = (loc: { kind: MediaKind; id: string; page?: number }) => {
    for (let i = 0; i < navigable.length; i++) {
      const refs = refsByExercise.get(navigable[i].exercise.id) ?? []
      const idx = refs.findIndex((r) => r.mediaId === loc.id && (loc.kind !== 'pdf' || r.page === loc.page))
      if (idx >= 0) {
        setSelectedIndex(i)
        setRefIndex(idx)
        return
      }
    }
  }

  const onPdfPage = (page: number) => {
    if (!media) return
    const max = activeFile?.pageCount ?? (media.kind === 'pdf' ? docPages[media.id] : undefined)
    const next = max ? Math.min(Math.max(1, page), max) : Math.max(1, page)
    setMedia((m) => (m ? { ...m, page: next } : m))
    matchAt({ kind: 'pdf', id: media.id, page: next })
  }

  const onKindChange = (kind: MediaKind) => {
    setPanelView('pdf')
    const current = navigable[selectedIndex]?.exercise
    const currentRefs = current ? (refsByExercise.get(current.id) ?? []) : []
    const ref = currentRefs.find((r) => r.kind === kind)
    if (ref) {
      setRefIndex(currentRefs.indexOf(ref))
      jumpToRef(ref)
    } else {
      const first = filesOfKind(kind)[0]
      if (first) setMedia({ kind, id: first.id, page: 1 })
      else setMedia(null)
    }
  }

  const onTranscriptTab = () => {
    if (!pdfRef) return
    setRefIndex(currentRefs.indexOf(pdfRef))
    jumpToRef(pdfRef)
    setPanelView('transcript')
  }

  const selectedItem = navigable[selectedIndex] ?? null
  const currentRefs = selectedItem ? (refsByExercise.get(selectedItem.exercise.id) ?? []) : []
  const activeRef = currentRefs[refIndex] ?? null
  const firstRef = currentRefs[0] ?? null

  const goToLocation = () => {
    if (!firstRef) return
    setRefIndex(0)
    jumpToRef(firstRef)
  }
  const activeFile = media ? (filesOfKind(media.kind).find((f) => f.id === media.id) ?? null) : null
  const maxPages = media?.kind === 'pdf' && activeFile ? (activeFile.pageCount ?? docPages[activeFile.id] ?? null) : null
  const refKinds = currentRefs.length ? KIND_ORDER.filter((k) => currentRefs.some((r) => r.kind === k)) : []
  const pdfRef = currentRefs.find((r) => r.kind === 'pdf') ?? null
  const transcriptAvailable =
    !!pdfRef && !!filesOfKind('pdf').find((f) => f.id === pdfRef.mediaId)?.text?.trim()
  const panelKinds = transcriptAvailable ? refKinds.filter((k) => k !== 'video') : refKinds
  const dedupedRefs = (() => {
    const seen = new Set<string>()
    return currentRefs.filter((r) => {
      if (seen.has(r.mediaId)) return false
      seen.add(r.mediaId)
      return true
    })
  })()

  const onRefFileSelect = (id: string) => {
    const idx = currentRefs.findIndex((r) => r.mediaId === id)
    if (idx < 0) return
    setRefIndex(idx)
    jumpToRef(currentRefs[idx])
  }
  const highlightQuery =
    media?.kind === 'pdf' &&
    selectedItem &&
    activeRef &&
    activeRef.mediaId === media.id &&
    activeRef.page === media.page
      ? { name: selectedItem.exercise.name ?? '', prompt: selectedItem.exercise.prompt }
      : null

  useEffect(() => {
    const view = expandOpen ? expandView : panelView
    if (view === 'transcript' && media?.page) {
      sectionRefs.current[media.page]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [expandView, panelView, expandOpen, media?.page])

  if (!course) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4 ai-glow">
          <Radar size={22} className="text-white" />
        </div>
        <h3 className="font-semibold mb-1">No course loaded</h3>
        <p className="text-sm text-[#A8A29E] mb-4 max-w-md mx-auto">
          Upload materials first and Woodpecker will extract every exercise from them.
        </p>
        <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm mx-auto w-fit">
          <Upload size={14} />
          Upload materials
        </Link>
      </motion.div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      <div className="glass-card rounded-xl p-5 flex flex-col gap-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[rgba(250,248,245,0.3)] font-semibold">Question</span>
          {activeRef && (
            <span className="text-[11px] font-medium text-[#6B7280] whitespace-nowrap">
              {activeRef.kind === 'pdf' && activeRef.page ? `Seite ${activeRef.page}` : ''}
            </span>
          )}
        </div>

        {navigable.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => selectItem(selectedIndex - 1)}
              disabled={selectedIndex <= 0}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A8A29E] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
              aria-label="Previous question"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="flex-1 min-w-0 text-center">
              <div className="text-[11px] font-medium">
                Question {selectedIndex + 1} of {navigable.length}
              </div>
              <div className="text-[10px] text-[#6B7280] truncate">
                {selectedItem ? `${selectedItem.moduleTitle} · ${selectedItem.lessonTitle}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => selectItem(selectedIndex + 1)}
              disabled={selectedIndex >= navigable.length - 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A8A29E] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
              aria-label="Next question"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {!selectedItem ? (
          <div className="text-center py-12">
            <FileQuestion size={20} className="mx-auto mb-2 text-[#6B7280]" />
            <p className="text-sm text-[#A8A29E]">No exercises are linked to any media file.</p>
          </div>
        ) : (
          <motion.div
            key={selectedItem.exercise.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const meta = TYPE_META[selectedItem.exercise.type]
                return (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}>
                    {meta.label}
                  </span>
                )
              })()}
              {selectedItem.exercise.name && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(139,92,246,0.1)] text-[#A78BFA] border border-[rgba(139,92,246,0.2)]">
                  {selectedItem.exercise.name}
                </span>
              )}
              {selectedItem.exercise.page && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(250,248,245,0.03)] text-[#6B7280] border border-[rgba(250,248,245,0.08)]">
                  {selectedItem.exercise.page.replace(/^S\.\s*/i, 'Seite ')}
                </span>
              )}
              {refKinds.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-[10px] text-[#6B7280] mr-0.5">Refs:</span>
                  {refKinds.map((k) => {
                    const meta = KIND_META[k]
                    return (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${meta.color}1A`, color: meta.color, border: `1px solid ${meta.color}33` }}
                      >
                        <meta.icon size={10} />
                        {meta.label}
                      </span>
                    )
                  })}
                </span>
              )}
              {firstRef ? (
                <button
                  type="button"
                  onClick={goToLocation}
                  className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.08)] text-[#10B981] hover:bg-[rgba(16,185,129,0.18)] hover:border-[rgba(16,185,129,0.4)] transition-all focus:ring-2 focus:ring-[rgba(16,185,129,0.3)] cursor-pointer"
                  title="Show this question's location in the media"
                >
                  <MapPin size={12} />
                  Go to location
                </button>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] text-[#6B7280]"
                  title="This question has no media reference"
                >
                  <MapPin size={12} />
                  No location
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-[#FAF8F5] whitespace-pre-wrap">{selectedItem.exercise.prompt}</p>
            {selectedItem.exercise.options && selectedItem.exercise.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedItem.exercise.options.map((option, j) => (
                  <span key={j} className="text-[11px] px-2 py-0.5 rounded bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)] text-[#A8A29E]">
                    {String.fromCharCode(97 + j)}) {option}
                  </span>
                ))}
              </div>
            )}
            {selectedItem.exercise.answer && (
              <p className="text-[11px] text-[#10B981]">
                Answer: <span className="text-[#A8A29E]">{selectedItem.exercise.answer}</span>
              </p>
            )}
            {selectedItem.exercise.solutions && selectedItem.exercise.solutions.length > 0 && (
              <div className="rounded-lg border border-[rgba(250,248,245,0.08)] bg-[rgba(250,248,245,0.02)] p-3">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#6B7280] font-semibold mb-1.5">
                  Solution (handbook)
                </div>
                <p className="text-[11px] leading-relaxed text-[#A8A29E] whitespace-pre-wrap">
                  {selectedItem.exercise.solutions[0]}
                </p>
              </div>
            )}
            <p className="flex items-center gap-1.5 text-[11px] text-[#6B7280] pt-2 border-t border-[rgba(250,248,245,0.06)]">
              <ExternalLink size={11} />
              <span className="truncate">{activeRef?.label ?? selectedItem.exercise.name ?? 'Media'}</span>
            </p>
          </motion.div>
        )}
      </div>

      <div className="glass-card rounded-xl overflow-hidden flex flex-col lg:col-span-3">
        <div className="p-3 border-b border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-lg p-1 bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)]">
              {panelKinds.map((k) => {
                const meta = KIND_META[k]
                const active = media?.kind === k && !(k === 'pdf' && panelView === 'transcript')
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onKindChange(k)}
                    className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#059669] to-[#10B981] text-white'
                        : 'text-[#6B7280] hover:text-[#FAF8F5]'
                    }`}
                  >
                    <meta.icon size={12} />
                    {meta.label}
                  </button>
                )
              })}
              {transcriptAvailable && (
                <button
                  type="button"
                  onClick={onTranscriptTab}
                  className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                    panelView === 'transcript'
                      ? 'bg-gradient-to-r from-[#059669] to-[#10B981] text-white'
                      : 'text-[#6B7280] hover:text-[#FAF8F5]'
                  }`}
                >
                  <ScrollText size={12} />
                  Transcription
                </button>
              )}
            </div>
            {activeFile && activeFile.kind === 'pdf' && (
              <button
                type="button"
                onClick={() => {
                  setExpandOpen(true)
                  setExpandView('pdf')
                }}
                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] transition-colors shrink-0 cursor-pointer"
                title="Expand the current PDF page"
              >
                <Expand size={12} />
                Expand
              </button>
            )}
          </div>
          {dedupedRefs.length > 1 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="relative flex-1 min-w-[160px]">
                <select
                  value={media!.id}
                  onChange={(e) => onRefFileSelect(e.target.value)}
                  className="w-full appearance-none bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.08)] rounded-lg pl-3 pr-8 py-1.5 text-[11px] text-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[rgba(16,185,129,0.4)] focus:border-transparent transition-colors cursor-pointer truncate"
                >
                  {dedupedRefs.map((r) => (
                    <option key={r.mediaId} value={r.mediaId} className="bg-[#12100E] text-[#FAF8F5]">
                      {KIND_META[r.kind].label} · {r.mediaName}
                      {r.page ? ` · Seite ${r.page}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
              </div>
              <span className="text-[11px] text-[#6B7280] shrink-0">{dedupedRefs.length} refs</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0">
          {!activeFile ? (
            <div className="p-12 text-center">
              <FileQuestion size={20} className="mx-auto mb-2 text-[#6B7280]" />
              <p className="text-sm text-[#A8A29E]">No viewable media of this type.</p>
            </div>
          ) : activeFile.kind === 'pdf' ? (
            <>
              <div className="px-3 py-2 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between gap-3">
                <span className="text-xs text-[#6B7280] truncate">{activeFile.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {panelView === 'pdf' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] transition-colors cursor-pointer"
                        aria-label="Zoom out"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="text-[11px] font-medium w-10 text-center">{Math.round(zoom * 100)}%</span>
                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] transition-colors cursor-pointer"
                        aria-label="Zoom in"
                      >
                        <Plus size={13} />
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] font-medium text-[#6B7280]">Transcript</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onPdfPage(media!.page - 1)}
                    disabled={media!.page <= 1}
                    className="px-2 py-1 rounded-md text-[11px] font-medium text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="text-[11px] font-medium w-20 text-center">
                    Page {media!.page} / {maxPages ?? '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onPdfPage(media!.page + 1)}
                    disabled={!!maxPages && media!.page >= maxPages}
                    className="px-2 py-1 rounded-md text-[11px] font-medium text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
              {panelView === 'pdf' ? (
                <PdfPageView
                  url={mediaUrlFor(activeFile)!}
                  page={media!.page}
                  zoom={zoom}
                  highlight={highlightQuery}
                  onPageChange={onPdfPage}
                  onPagesReady={(count) =>
                    setDocPages((m) => (m[media!.id] === count ? m : { ...m, [media!.id]: count ?? 0 }))
                  }
                />
              ) : (
                <TranscriptView
                  text={activeFile.text ?? ''}
                  currentPage={media!.page}
                  sectionRefs={sectionRefs}
                  className="max-h-[62vh] overflow-auto"
                />
              )}
            </>
          ) : activeFile.kind === 'audio' ? (
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center shrink-0">
                  <Mic size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{activeFile.name}</div>
                  {activeFile.durationSec ? (
                    <div className="text-xs text-[#6B7280]">
                      {Math.round(activeFile.durationSec / 60)}:{String(Math.round(activeFile.durationSec) % 60).padStart(2, '0')}
                    </div>
                  ) : (
                    <div className="text-xs text-[#6B7280]">Audio file</div>
                  )}
                </div>
              </div>
              <audio src={mediaUrlFor(activeFile) ?? undefined} controls className="w-full" />
            </div>
          ) : activeFile.kind === 'video' ? (
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#EC4899] to-[#F97316] flex items-center justify-center shrink-0">
                  <Video size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{activeFile.name}</div>
                  {activeFile.durationSec ? (
                    <div className="text-xs text-[#6B7280]">
                      {Math.round(activeFile.durationSec / 60)}:{String(Math.round(activeFile.durationSec) % 60).padStart(2, '0')}
                    </div>
                  ) : (
                    <div className="text-xs text-[#6B7280]">Video file</div>
                  )}
                </div>
              </div>
              <video src={mediaUrlFor(activeFile) ?? undefined} controls className="w-full rounded-lg bg-black max-h-[55vh]" />
            </div>
          ) : (
            <div className="p-6 flex items-center justify-center min-h-[400px] bg-[rgba(250,248,245,0.01)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrlFor(activeFile) ?? ''}
                alt={activeFile.name}
                className="max-w-full max-h-[62vh] rounded-lg shadow-xl"
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expandOpen && media && activeFile && activeFile.kind === 'pdf' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 sm:p-8"
            onClick={() => setExpandOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-[92vw] max-h-[90vh] overflow-hidden rounded-2xl bg-[#0C0C0C] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-[rgba(250,248,245,0.08)] bg-[rgba(250,248,245,0.02)]">
                <span className="text-xs text-[#6B7280] truncate">
                  {activeFile.name} — Page {media.page}
                </span>
                <div className="flex items-center gap-1 rounded-lg p-1 bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)] shrink-0">
                  <button
                    type="button"
                    onClick={() => setExpandView('pdf')}
                    className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      expandView === 'pdf'
                        ? 'bg-gradient-to-r from-[#059669] to-[#10B981] text-white'
                        : 'text-[#6B7280] hover:text-[#FAF8F5]'
                    }`}
                  >
                    <BookOpen size={11} />
                    Page
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandView('original')}
                    className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      expandView === 'original'
                        ? 'bg-gradient-to-r from-[#059669] to-[#10B981] text-white'
                        : 'text-[#6B7280] hover:text-[#FAF8F5]'
                    }`}
                  >
                    <FileText size={11} />
                    Original
                  </button>
                  {activeFile.text?.trim() && (
                    <button
                      type="button"
                      onClick={() => setExpandView('transcript')}
                      className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                        expandView === 'transcript'
                          ? 'bg-gradient-to-r from-[#059669] to-[#10B981] text-white'
                          : 'text-[#6B7280] hover:text-[#FAF8F5]'
                      }`}
                    >
                      <ScrollText size={11} />
                      Transcript
                    </button>
                  )}
                </div>
                {expandView !== 'pdf' && maxPages && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onPdfPage(media.page - 1)}
                      disabled={media.page <= 1}
                      className="p-1 rounded-md text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <span className="text-[11px] font-medium w-14 text-center">
                      Page {media.page} / {maxPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => onPdfPage(media.page + 1)}
                      disabled={media.page >= maxPages}
                      className="p-1 rounded-md text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
                      aria-label="Next page"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setExpandOpen(false)}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] transition-colors cursor-pointer shrink-0"
                  aria-label="Close expanded view"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[calc(90vh-41px)] overflow-auto">
                {expandView === 'pdf' ? (
                  <PdfPageView
                    url={mediaUrlFor(activeFile)!}
                    page={media.page}
                    zoom={zoom}
                    highlight={highlightQuery}
                    onPageChange={onPdfPage}
                    onPagesReady={(count) =>
                      setDocPages((m) => (m[media!.id] === count ? m : { ...m, [media!.id]: count ?? 0 }))
                    }
                  />
                ) : expandView === 'original' ? (
                  <div className="bg-[#0C0C0C] p-4">
                    <iframe
                      src={`${mediaUrlFor(activeFile)}#page=${media.page}`}
                      className="w-full h-[calc(90vh-120px)] rounded-lg shadow-xl bg-white"
                      title={`${activeFile.name} - Page ${media.page}`}
                    />
                  </div>
                ) : (
                  <TranscriptView
                    text={activeFile.text ?? ''}
                    currentPage={media.page}
                    sectionRefs={sectionRefs}
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}