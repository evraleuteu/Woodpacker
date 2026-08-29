'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, FileText, ExternalLink } from 'lucide-react'
import { modalVariants } from '@/lib/animations'
import { useCourse } from '@/lib/useCourse'
import { mediaUrlFor } from '@/lib/media-url'
import type { Exercise } from '@/lib/types'

interface ScreenshotModalProps {
  exercise: Exercise
  pdfUrl: string
  pdfName: string
  pdfId: string
  initialPage: number
  onClose: () => void
}

export function SeeScreenshotButton({ exercise, className = '' }: { exercise: Exercise; className?: string }) {
  const course = useCourse()
  const [open, setOpen] = useState(false)

  const pageNumber = extractPageNumber(exercise.page)
  const pdf = findPdfForExercise(exercise, course)
  const available = pageNumber !== null && pdf !== null
  if (!available) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Show page ${exercise.page} from ${pdf!.name}`}
        className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.08)] text-[#10B981] hover:bg-[rgba(16,185,129,0.18)] hover:border-[rgba(16,185,129,0.4)] transition-all focus:ring-2 focus:ring-[var(--color-accent-lime)] cursor-pointer shrink-0 ${className}`}
      >
        <ImageIcon size={12} />
        See screenshot
      </button>
      {open && (
        <ScreenshotModal
          exercise={exercise}
          pdfUrl={mediaUrlFor(pdf)!}
          pdfName={pdf!.name}
          pdfId={pdf!.id}
          initialPage={pageNumber!}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function ScreenshotModal({ exercise, pdfUrl, pdfName, pdfId, initialPage, onClose }: ScreenshotModalProps) {
  const [page, setPage] = useState(initialPage)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full max-w-4xl max-h-[90vh] bg-[rgba(12,12,12,0.95)] border border-[rgba(250,248,245,0.12)] rounded-[22px] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 pb-4 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-[#FAF8F5] text-sm truncate">
                {exercise.name ? `${exercise.name} — ` : ''}Original page {exercise.page}
              </h3>
              <p className="text-xs text-[#6B7280] truncate">{pdfName}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium w-16 text-center">Page {page}</span>
              <button
                type="button"
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] transition-colors"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] focus:ring-2 focus:ring-[var(--color-accent-lime)]"
                aria-label="Close screenshot"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-[#0C0C0C] p-4 overflow-auto">
            <iframe
              src={`${pdfUrl}#page=${page}`}
              className="w-full h-[70vh] rounded-lg shadow-xl bg-white"
              title={`${pdfName} - Page ${page}`}
            />
          </div>

          <div className="p-4 border-t border-[rgba(250,248,245,0.06)] flex items-center justify-between">
            <span className="text-[11px] text-[#6B7280] flex items-center gap-1.5">
              <FileText size={12} />
              {exercise.name ? `${exercise.name} · ` : ''}referenced as {exercise.page}
            </span>
            <Link
              href={`/materials/${pdfId}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[rgba(250,248,245,0.08)] bg-[rgba(250,248,245,0.02)] text-[#A8A29E] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] transition-colors"
            >
              <ExternalLink size={12} />
              Open full material
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export function extractPageNumber(page?: string): number | null {
  if (!page) return null
  const match = page.match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}

export function findPdfForExercise(exercise: Exercise, course: ReturnType<typeof useCourse>) {
  if (!course) return null
  const candidates = (exercise.sourceAssets ?? []).length
    ? course.sourceFiles.filter((f) => exercise.sourceAssets.includes(f.id))
    : []
  const direct = candidates.find((f) => f.kind === 'pdf' && mediaUrlFor(f))
  if (direct) return direct
  return course.sourceFiles.find((f) => f.kind === 'pdf' && mediaUrlFor(f)) ?? null
}