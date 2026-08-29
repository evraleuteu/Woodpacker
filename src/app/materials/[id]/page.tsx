'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  FileText,
  Mic,
  Video,
  Image as ImageIcon,
  BookOpen,
  Download,
  RotateCcw,
  Expand,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trash2,
  Loader2,
} from 'lucide-react'
import { useCourse } from '@/lib/useCourse'
import { mediaUrlFor } from '@/lib/media-url'
import { deleteCourseMaterialFile } from '@/lib/storage'
import type { AssetKind } from '@/lib/types'

const KIND_META: Record<AssetKind, { label: string; icon: typeof BookOpen; color: string }> = {
  pdf: { label: 'PDF', icon: BookOpen, color: '#059669' },
  docx: { label: 'DOCX', icon: FileText, color: '#3B82F6' },
  epub: { label: 'EPUB', icon: BookOpen, color: '#8B5CF6' },
  pptx: { label: 'Slides', icon: FileText, color: '#F59E0B' },
  text: { label: 'Text', icon: FileText, color: '#14B8A6' },
  audio: { label: 'Audio', icon: Mic, color: '#10B981' },
  video: { label: 'Video', icon: Video, color: '#EC4899' },
  image: { label: 'Image', icon: ImageIcon, color: '#F97316' },
  unknown: { label: 'File', icon: FileText, color: '#6B7280' },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function MaterialViewerPage() {
  const params = useParams()
  const router = useRouter()
  const assetId = params.id as string
  const course = useCourse()
  const [pdfPage, setPdfPage] = useState<number>(() => {
    if (typeof window === 'undefined') return 1
    const n = parseInt(new URLSearchParams(window.location.search).get('page') ?? '', 10)
    return Number.isFinite(n) && n >= 1 ? n : 1
  })
  const [zoom, setZoom] = useState(1)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const handleDelete = async () => {
    if (!course || !asset) return
    if (!confirm(`Delete "${asset.name}"? This will also remove it from MinIO storage and the database.`)) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteCourseMaterialFile(course.id, assetId)
      router.push('/materials')
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete material')
    } finally {
      setDeleting(false)
    }
  }

  const sourceFiles = course?.sourceFiles
  const asset = sourceFiles ? (sourceFiles.find((f) => f.id === assetId) ?? null) : null

  const pdfPages = asset?.kind === 'pdf' ? (asset.pageCount ?? 0) : 0
  const assetUrl = asset ? mediaUrlFor(asset) : null

  if (!course) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4 ai-glow">
            <Sparkles size={22} className="text-white" />
          </div>
          <h3 className="font-semibold mb-1">No course loaded</h3>
          <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm mt-4 mx-auto">
            Upload materials
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  if (!asset) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(250,248,245,0.03)] flex items-center justify-center mx-auto mb-4">
            <FileText size={22} className="text-[#6B7280]" />
          </div>
          <h3 className="font-semibold mb-1">Material not found</h3>
          <p className="text-sm text-[#A8A29E] mb-4">This material may have been removed or the course was rebuilt.</p>
          <Link href="/materials" className="btn-secondary inline-flex items-center gap-2 text-sm mt-4 mx-auto">
            <ArrowLeft size={14} />
            Back to Materials
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  const meta = KIND_META[asset.kind] ?? KIND_META.unknown

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
      {deleteError && (
        <motion.div variants={itemVariants} className="mb-4 rounded-lg border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] text-[#EF4444] text-sm px-3 py-2">
          {deleteError}
        </motion.div>
      )}
      <motion.div variants={itemVariants} className="flex items-center gap-4 mb-6">
        <Link href="/materials" className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors" aria-label="Back to library">
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">Library</span>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-1">
            <span className="px-2 py-0.5 rounded-full border" style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}1A`, color: meta.color }}>
              {meta.label}
            </span>
            {asset.size && <><span>&middot;</span><span>{(asset.size / 1024 / 1024).toFixed(1)} MB</span></>}
            {asset.durationSec && <><span>&middot;</span><span>{Math.round(asset.durationSec / 60)} min</span></>}
            {asset.words && <><span>&middot;</span><span>{asset.words.toLocaleString()} words</span></>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight truncate">{asset.name}</h1>
        </div>
        <div className="flex items-center gap-1">
          {assetUrl && (
            <a href={assetUrl} download={asset.name} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors" title="Download">
              <Download size={18} />
              <span className="hidden md:inline">Download</span>
            </a>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete material and remove from storage"
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm text-[#B91C1C] hover:bg-[#FEF2F2] border border-transparent hover:border-[#FECACA] disabled:opacity-50 transition-colors"
          >
            {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            <span className="hidden md:inline">Delete</span>
          </button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl overflow-hidden">
        {asset.kind === 'pdf' && assetUrl && (
          <div className="relative">
            <div className="p-3 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between bg-[rgba(250,248,245,0.02)]">
              <div className="flex items-center gap-2">
                <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="p-1.5 rounded text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] transition-colors">
                  <Minus size={16} />
                </button>
                <span className="text-sm font-medium w-16 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(Math.min(3, zoom + 0.25))} className="p-1.5 rounded text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] transition-colors">
                  <Plus size={16} />
                </button>
                <button onClick={() => setZoom(1)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors" title="Reset zoom">
                  <RotateCcw size={14} />
                  <span className="hidden sm:inline">Reset</span>
                </button>
                <button onClick={() => setZoom(1)} className="p-1.5 rounded text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors" title="Fit page">
                  <Expand size={16} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPdfPage(Math.max(1, pdfPage - 1))} disabled={pdfPage <= 1} className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-sm font-medium w-24 text-center">Page {pdfPage} / {pdfPages || '—'}</span>
                <button onClick={() => setPdfPage(Math.min(pdfPages || 999, pdfPage + 1))} disabled={pdfPages > 0 && pdfPage >= pdfPages} className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center min-h-[500px] bg-[#0C0C0C] p-4" style={{ zoom }}>
              <iframe
                src={`${assetUrl}#page=${pdfPages ? Math.min(pdfPage, pdfPages) : pdfPage}`}
                className="w-full h-[700px] rounded-lg shadow-xl"
                title={`${asset.name} - Page ${pdfPage}`}
                onLoad={() => {
                  // Can't easily get page count from iframe, but we could use pdfjs
                }}
              />
            </div>
          </div>
        )}

        {asset.kind === 'audio' && assetUrl && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center shrink-0">
                <Mic size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{asset.name}</div>
                <div className="text-xs text-[#6B7280]">
                  {asset.durationSec ? `${Math.round(asset.durationSec / 60)}:${String(Math.round(asset.durationSec) % 60).padStart(2, '0')}` : 'Unknown duration'}
                </div>
              </div>
            </div>
            <audio
              ref={audioRef}
              src={assetUrl}
              controls
              className="w-full"
              onPlay={() => {}}
              onPause={() => {}}
            />
          </div>
        )}

        {asset.kind === 'video' && assetUrl && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#EC4899] to-[#F97316] flex items-center justify-center shrink-0">
                <Video size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{asset.name}</div>
                <div className="text-xs text-[#6B7280]">
                  {asset.durationSec ? `${Math.round(asset.durationSec / 60)}:${String(Math.round(asset.durationSec) % 60).padStart(2, '0')}` : 'Unknown duration'}
                </div>
              </div>
            </div>
            <video
              ref={videoRef}
              src={assetUrl}
              controls
              className="w-full rounded-lg bg-black"
              onPlay={() => {}}
              onPause={() => {}}
            />
          </div>
        )}

        {asset.kind === 'image' && assetUrl && (
          <div className="p-6 flex items-center justify-center min-h-[400px] bg-[rgba(250,248,245,0.01)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl}
              alt={asset.name}
              className="max-w-full max-h-[70vh] rounded-lg shadow-xl"
            />
          </div>
        )}

        {(asset.kind === 'text' || asset.kind === 'docx' || asset.kind === 'epub' || asset.kind === 'pptx') && asset.text && (
          <div className="p-6 max-h-[70vh] overflow-y-auto font-mono text-sm leading-relaxed text-[#A8A29E] whitespace-pre-wrap">
            {asset.text}
          </div>
        )}

        {(!assetUrl && asset.kind !== 'text') && (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(250,248,245,0.03)] flex items-center justify-center mx-auto mb-4">
              <FileText size={22} className="text-[#6B7280]" />
            </div>
            <h3 className="font-semibold mb-1">Preview not available</h3>
            <p className="text-sm text-[#A8A29E] mb-4">This file type can only be viewed after re-uploading, or the binary content was not stored.</p>
            {asset.text && (
              <div className="p-4 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-left text-sm font-mono text-[#A8A29E] max-h-64 overflow-auto">
                {asset.text.slice(0, 3000)}{asset.text.length > 3000 ? '...' : ''}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {asset.kind === 'pdf' && asset.text && (
        <motion.div variants={itemVariants} className="mt-6 glass-card rounded-xl p-6">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <FileText size={14} className="text-[#10B981]" />
            Extracted Text
          </h3>
          <div className="p-4 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-sm font-mono text-[#A8A29E] max-h-96 overflow-auto whitespace-pre-wrap">
            {asset.text}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}