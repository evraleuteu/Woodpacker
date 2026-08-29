'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Mic,
  Video,
  FileText,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useCourse } from '@/lib/useCourse'
import { mediaUrlFor } from '@/lib/media-url'
import { flattenExercises } from '@/lib/exercise-utils'
import { extractPageNumber } from '@/components/exercises/ScreenshotModal'
import type { Exercise, Lesson } from '@/lib/types'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function ExerciseOriginalPage() {
  const params = useParams()
  const course = useCourse()
  const exerciseId = params?.id as string | undefined
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const { exercise, lesson, moduleTitle } = (() => {
    if (!course) return { exercise: null as Exercise | null, lesson: null as Lesson | null, moduleTitle: '' }
    const loc = flattenExercises(course).find((l) => l.exercise.id === exerciseId) ?? null
    if (!loc) return { exercise: null, lesson: null, moduleTitle: '' }
    for (const mod of course.modules) {
      for (const l of mod.lessons) {
        if (l.title === loc.lessonTitle) {
          return { exercise: loc.exercise, lesson: l, moduleTitle: mod.title }
        }
      }
    }
    return { exercise: loc.exercise, lesson: null, moduleTitle: loc.moduleTitle }
  })()

  const [zoom, setZoom] = useState(1)

  const initialPage = extractPageNumber(exercise?.page) ?? 1
  const [pdfPage, setPdfPage] = useState(initialPage)

  const assetIds = new Set<string>()
  for (const id of lesson?.sourceAssets ?? []) assetIds.add(id)
  for (const id of exercise?.sourceAssets ?? []) assetIds.add(id)

  const pdfFile = (() => {
    if (!course) return null
    const direct = course.sourceFiles.find((f) => assetIds.has(f.id) && f.kind === 'pdf' && mediaUrlFor(f))
    if (direct) return direct
    return course.sourceFiles.find((f) => f.kind === 'pdf' && mediaUrlFor(f)) ?? null
  })()

  const audioFiles = course ? course.sourceFiles.filter((f) => assetIds.has(f.id) && f.kind === 'audio' && mediaUrlFor(f)) : []

  const videoFiles = course ? course.sourceFiles.filter((f) => assetIds.has(f.id) && f.kind === 'video' && mediaUrlFor(f)) : []

  const pdfMaxPage = pdfFile?.pageCount ?? 0
  const clampedPage = pdfMaxPage ? Math.min(pdfPage, pdfMaxPage) : pdfPage

  if (!course) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4 ai-glow">
            <Sparkles size={22} className="text-white" />
          </div>
          <h3 className="font-semibold mb-1">No course loaded</h3>
          <p className="text-sm text-[#A8A29E] mb-4 max-w-md mx-auto">
            Upload materials first and Woodpecker will extract every exercise from them.
          </p>
          <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm mx-auto w-fit">
            Upload materials
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  if (!exercise) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(250,248,245,0.03)] flex items-center justify-center mx-auto mb-4">
            <FileText size={22} className="text-[#6B7280]" />
          </div>
          <h3 className="font-semibold mb-1">Exercise not found</h3>
          <p className="text-sm text-[#A8A29E] mb-4">This exercise may have been removed or the course was rebuilt.</p>
          <Link href="/exercises" className="btn-secondary inline-flex items-center gap-2 text-sm mx-auto w-fit">
            <ArrowLeft size={14} />
            Back to Exercises
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  const hasContent = !!pdfFile || audioFiles.length > 0 || videoFiles.length > 0

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-6xl mx-auto">
      <motion.div variants={itemVariants} className="flex items-center gap-4 mb-6">
        <Link
          href={`/exercises/${exerciseId}/play`}
          className="p-2 rounded-lg text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.03)] transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-1">
            {moduleTitle && <span className="truncate">{moduleTitle}</span>}
            {lesson?.title && (
              <>
                <span>&middot;</span>
                <span className="truncate">{lesson.title}</span>
              </>
            )}
            {exercise.name && (
              <span className="px-2 py-0.5 rounded-full bg-[rgba(139,92,246,0.1)] text-[#A78BFA] border border-[rgba(139,92,246,0.2)] shrink-0">
                {exercise.name}
              </span>
            )}
            {exercise.page && (
              <span className="px-2 py-0.5 rounded-full bg-[rgba(250,248,245,0.03)] text-[#6B7280] border border-[rgba(250,248,245,0.08)] shrink-0">
                {exercise.page}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight truncate">Original material</h1>
        </div>
      </motion.div>

      {!hasContent ? (
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(250,248,245,0.03)] flex items-center justify-center mx-auto mb-4">
            <FileText size={22} className="text-[#6B7280]" />
          </div>
          <h3 className="font-semibold mb-1">No original content available</h3>
          <p className="text-sm text-[#A8A29E] mb-4 max-w-md mx-auto">
            No PDF page or media files are stored for this exercise. Re-upload the material to enable the original view.
          </p>
        </motion.div>
      ) : (
        <>
          {pdfFile && (
            <motion.div variants={itemVariants} className="glass-card rounded-xl overflow-hidden mb-8">
              <div className="p-3 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between bg-[rgba(250,248,245,0.02)]">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen size={15} className="text-[#059669] shrink-0" />
                  <span className="text-sm font-medium truncate">{pdfFile.name}</span>
                  <span className="text-xs text-[#6B7280] shrink-0">
                    {exercise.page ? `— original page ${exercise.page}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                    className="p-1.5 rounded text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] transition-colors"
                    aria-label="Zoom out"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-sm font-medium w-16 text-center">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                    className="p-1.5 rounded text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] transition-colors"
                    aria-label="Zoom in"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => setPdfPage(Math.max(1, pdfPage - 1))}
                    disabled={pdfPage <= 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-sm font-medium w-24 text-center">Page {pdfPage}</span>
                  <button
                    onClick={() => setPdfPage(pdfPage + 1)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.05)] transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-center min-h-[500px] bg-[#0C0C0C] p-4" style={{ zoom }}>
                <iframe
                  src={`${mediaUrlFor(pdfFile)}#page=${clampedPage}`}
                  className="w-full h-[70vh] rounded-lg shadow-xl bg-white"
                  title={`${pdfFile.name} - Page ${clampedPage}`}
                />
              </div>
            </motion.div>
          )}

          {(audioFiles.length > 0 || videoFiles.length > 0) && (
            <motion.div variants={itemVariants} className="space-y-6">
              {audioFiles.length > 0 && (
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Mic size={14} className="text-[#10B981]" />
                    Audio ({audioFiles.length})
                  </h3>
                  <div className="space-y-4">
                    {audioFiles.map((file) => (
                      <div key={file.id} className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center shrink-0">
                          <Mic size={20} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{file.name}</div>
                          <div className="text-xs text-[#6B7280]">
                            {file.durationSec
                              ? `${Math.round(file.durationSec / 60)}:${String(Math.round(file.durationSec) % 60).padStart(2, '0')}`
                              : 'Audio file'}
                          </div>
                        </div>
                        <audio ref={audioRef} src={mediaUrlFor(file) ?? undefined} controls className="w-64 max-w-full" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {videoFiles.length > 0 && (
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Video size={14} className="text-[#EC4899]" />
                    Video ({videoFiles.length})
                  </h3>
                  <div className="space-y-6">
                    {videoFiles.map((file) => (
                      <div key={file.id}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#EC4899] to-[#F97316] flex items-center justify-center shrink-0">
                            <Video size={20} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{file.name}</div>
                            <div className="text-xs text-[#6B7280]">
                              {file.durationSec
                                ? `${Math.round(file.durationSec / 60)}:${String(Math.round(file.durationSec) % 60).padStart(2, '0')}`
                                : 'Video file'}
                            </div>
                          </div>
                        </div>
                        <video ref={videoRef} src={mediaUrlFor(file) ?? undefined} controls className="w-full rounded-lg bg-black max-h-[60vh]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}