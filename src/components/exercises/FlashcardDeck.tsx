'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Shuffle,
  Volume2,
} from 'lucide-react'
import { FeedbackPanel } from './FeedbackPanel'
import { Avatar } from './Avatar'
import { ExerciseInteractionEngine } from './ExerciseInteractionEngine'
import { ExplanationModal } from './ExplanationModal'
import { SeeScreenshotButton, extractPageNumber, findPdfForExercise } from './ScreenshotModal'
import { mediaUrlFor } from '@/lib/media-url'
import { useCourse } from '@/lib/useCourse'
import { resolveExerciseType } from '@/lib/exercise-classifier'
import { toValidatedExercise, validateAnswer } from '@/lib/exercise-resolver'
import { labelForAnswer } from '@/lib/exercise-helpers'
import type { ExerciseType, UserAnswer } from '@/lib/exercise-model'
import type { PremiumExercise, AvatarEmotion, PracticeDimension } from '@/lib/types/exercise'

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  vocabulary: { label: 'Vocabulary', color: '#10B981' },
  grammar: { label: 'Grammar', color: '#A855F7' },
  reading: { label: 'Reading', color: '#38BDF8' },
  listening: { label: 'Listening', color: '#F59E0B' },
  speaking: { label: 'Speaking', color: '#84CC16' },
  other: { label: 'Exercise', color: '#A8A29E' },
}

const TYPE_INSTRUCTIONS: Record<ExerciseType, string> = {
  'fill-blank': 'Fill in the blank — tap a word to place it in the gap.',
  'multiple-choice': 'Multiple choice — choose the correct option.',
  'multiple-select': 'Multiple select — choose all that apply.',
  translation: 'Translation — arrange the words to build the sentence.',
  recall: 'Recall — answer from memory.',
  'pattern-drill': 'Pattern drill — complete every matched pair.',
  roleplay: 'Roleplay — respond in the dialogue.',
  comprehension: 'Comprehension — answer based on the material.',
  assessment: 'Assessment — complete the task.',
  'gap-text': 'Gap text — fill every blank independently.',
  'sentence-completion': 'Sentence completion — finish the sentence.',
  'word-order': 'Word order — arrange the blocks in the right order.',
  matching: 'Matching — connect the pairs.',
  'drag-drop': 'Drag and drop — place the items correctly.',
  'free-text': 'Free text — write a full answer.',
  'grammar-transformation': 'Grammar transformation — rewrite the sentence.',
  conjugation: 'Conjugation — fill each form.',
  'article-selection': 'Article selection — choose the right article.',
  'case-selection': 'Case selection — choose the right case.',
  listening: 'Listening — play the audio, then answer.',
  speaking: 'Speaking — record your spoken answer.',
  'image-description': 'Image description — describe what you see.',
  'true-false': 'True / false — pick the correct statement.',
}

interface FlashcardDeckProps {
  exercises: PremiumExercise[]
  initialIndex?: number
  onResult?: (result: { correct: boolean; xp: number; practice: PracticeDimension }) => void
}

interface FeedbackState {
  type: 'correct' | 'incorrect'
  answer: string
}

export function FlashcardDeck({ exercises, initialIndex = 0, onResult }: FlashcardDeckProps) {
  const course = useCourse()
  const [order, setOrder] = useState<number[]>(() => {
    const base = exercises.map((_, i) => i)
    if (initialIndex > 0) return [initialIndex, ...base.filter((i) => i !== initialIndex)]
    return base
  })
  const [pos, setPos] = useState(0)
  const [typed, setTyped] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [hintUsed, setHintUsed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [explainOpen, setExplainOpen] = useState(false)
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null)
  const [mediaPlayed, setMediaPlayed] = useState(false)

  const current = exercises[order[pos]]
  const meta = CATEGORY_META[current.practice] ?? CATEGORY_META.other
  const instruction = TYPE_INSTRUCTIONS[current.type]
  const resolvedType: ExerciseType = resolveExerciseType({
    type: current.type,
    prompt: current.prompt,
    options: (current.optionItems ?? current.options ?? []).map((o) =>
      typeof o === 'string' ? { id: `opt-${o}`, label: o } : o,
    ),
    structured: current.structured,
    subtype: current.subtype,
  })
  const validatedExercise = useMemo(() => toValidatedExercise(current), [current])
  const pageNumber = extractPageNumber(current.page)
  const pdfFile = findPdfForExercise(current, course)
  const targetPage = pageNumber ?? 1
  const canShowOriginal = pageNumber !== null && pdfFile !== null
  const mediaLocked = !mediaPlayed && !!(current.requiredAudio || current.requiredVideo)

  const linkedAudio = useMemo(() => {
    const id = current.requiredAudio?.[0]
    if (!id || !course) return null
    const file = course.sourceFiles.find((f) => f.id === id)
    if (!file) return null
    const url = mediaUrlFor(file)
    return url ? { file, url } : null
  }, [current.requiredAudio, course])

  const linkedVideo = useMemo(() => {
    const id = current.requiredVideo?.[0]
    if (!id || !course) return null
    const file = course.sourceFiles.find((f) => f.id === id)
    if (!file) return null
    const url = mediaUrlFor(file)
    return url ? { file, url } : null
  }, [current.requiredVideo, course])

  const emotion: AvatarEmotion = feedback
    ? feedback.type === 'correct'
      ? 'celebrate'
      : 'wrong'
    : playing
      ? 'thinking'
      : 'idle'

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel()
      }
    }
  }, [current.id])

  const speak = (text: string, force = false) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
    if (playing && !force) {
      window.speechSynthesis.cancel()
      setPlaying(false)
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = current.locale ?? 'de-DE'
    u.rate = 1
    u.onend = () => setPlaying(false)
    u.onerror = () => setPlaying(false)
    setPlaying(true)
    window.speechSynthesis.speak(u)
  }

  const resetCard = () => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setTyped('')
    setFeedback(null)
     setHintUsed(false)
    setPlaying(false)
    setMediaPlayed(false)
  }

  const goTo = (nextPos: number) => {
    setPos(Math.max(0, Math.min(order.length - 1, nextPos)))
    resetCard()
  }

  const shuffleDeck = () => {
    const next = [...order]
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[next[i], next[j]] = [next[j], next[i]]
    }
    setOrder(next)
    setPos(0)
    resetCard()
  }

  /** Validate a structured answer through the per-type registry. */
  const handleAnswer = async (answer: UserAnswer) => {
    if (feedback || hintUsed || mediaLocked) return
    const result = validateAnswer(validatedExercise, answer)
    const feedbackType: 'correct' | 'incorrect' = result.correct ? 'correct' : 'incorrect'
    setFeedback({ type: feedbackType, answer: labelForAnswer(answer) })
    onResult?.({ correct: result.correct, xp: current.xp ?? 5, practice: current.practice })
    void fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exerciseId: current.id,
        correct: result.correct,
        practice: current.practice,
      }),
    }).catch(() => {})
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (explainOpen) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.key === 'ArrowRight') goTo(pos + 1)
      if (e.key === 'ArrowLeft') goTo(pos - 1)
      if (e.key === 'Enter' && !feedback && !mediaLocked && typed.trim().length > 0) {
        handleAnswer({ type: 'free-text', text: typed })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  function renderInteractive(type: ExerciseType): React.ReactNode {
    return (
      <ExerciseInteractionEngine
        exercise={current}
        resolvedType={type}
        feedback={feedback}
        mediaLocked={mediaLocked}
        hintUsed={hintUsed}
        typed={typed}
        setTyped={setTyped}
        onAnswer={handleAnswer}
      />
    )
  }

  const cardShadow =
    feedback?.type === 'correct'
      ? '0 0 0 2px rgba(16,185,129,0.6), 0 0 70px rgba(16,185,129,0.35), 0 20px 60px -15px rgba(0,0,0,0.08)'
      : feedback?.type === 'incorrect'
        ? '0 0 0 2px rgba(239,68,68,0.4), 0 20px 60px -15px rgba(0,0,0,0.08)'
        : '0 20px 60px -15px rgba(0,0,0,0.08), 0 0 40px rgba(16,185,129,0.06)'

  if (!exercises.length) {
    return (
      <div className="w-full">
        <div className="min-h-[420px] rounded-[24px] border border-[#E5E7EB] bg-white px-8 py-12 text-center shadow-soft-lg">
          <h3 className="mb-1 text-xl font-semibold text-[#111827]">No exercises available</h3>
          <p className="text-sm text-[#6B7280]">Upload materials to create a course first.</p>
        </div>
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative mx-auto w-full max-w-[760px]">
        <div
          className="relative overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white shadow-soft-xl h-[48vh] min-h-[360px] max-h-[560px] sm:h-[52vh] lg:h-[58vh]"
          style={{
            boxShadow: cardShadow,
            borderColor: feedback?.type === 'correct' ? 'rgba(34,197,94,0.45)' : '#E5E7EB',
          }}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-2.5 py-2 sm:px-3 sm:py-2.5 lg:px-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <span
                  className="inline-flex items-center rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.22em] sm:px-2.5"
                  style={{ background: `${meta.color}1A`, color: meta.color, borderColor: `${meta.color}44` }}
                >
                  {meta.label.toUpperCase()}
                </span>
                <span className="hidden text-[9px] font-semibold uppercase tracking-[0.22em] text-[#6B7280] sm:inline">
                  Cycle practice
                </span>
              </div>
              <div className="flex items-center gap-2">
                {pdfFile && (
                  <Link
                    href={`/materials/${pdfFile.id}?page=${targetPage}`}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-2 py-1.5 text-[9px] font-medium text-[#1F7A4C] transition-colors hover:border-[#86EFAC] hover:bg-[#DCFCE7] sm:text-[10px]"
                    title="Open the PDF at this exercise's page"
                  >
                    <FileText size={11} />
                    Go to page {targetPage}
                  </Link>
                )}
                {canShowOriginal && (
                  <Link
                    href={`/exercises/${current.id}/original`}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E9D5FF] bg-[#FAF5FF] px-2 py-1.5 text-[9px] font-medium text-[#7C3AED] transition-colors hover:border-[#C4B5FD] hover:bg-[#F3E8FF] sm:text-[10px]"
                    title="View the original PDF page and media for this exercise"
                  >
                    <BookOpen size={11} />
                    Show original
                  </Link>
                )}
                <SeeScreenshotButton exercise={current} />
                <span className="whitespace-nowrap text-[10px] font-medium text-[#6B7280] tabular-nums">
                  Card {pos + 1} / {order.length}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id}
                    ref={setCardEl}
                    className="px-2.5 py-2.5 sm:px-3 sm:py-3 lg:px-4 lg:py-4"
                    initial={{ opacity: 0, y: 14, scale: 0.99 }}
                    animate={
                      feedback?.type === 'incorrect'
                        ? { x: [0, -10, 10, -8, 8, -4, 4, 0] }
                        : feedback?.type === 'correct'
                          ? { x: 0, scale: [1, 1.015, 1] }
                          : { x: 0, opacity: 1, y: 0, scale: 1 }
                    }
                    exit={{ opacity: 0, y: -12, scale: 0.99 }}
                    transition={{ duration: feedback?.type === 'incorrect' ? 0.5 : 0.35, ease: 'easeOut' }}
                  >
                    <div className="rounded-[20px] border border-[#E5E7EB] bg-[#FAFBFC] p-3 sm:p-3.5 lg:p-4">
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div>
                          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.24em] text-[#1F7A4C]">Lesson practice</div>
                          <h2 className="text-lg font-black leading-tight text-[#111827] sm:text-xl lg:text-2xl">
                            {current.challengeTitle}
                          </h2>
                        </div>
                        <div
                          className="hidden rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] sm:inline-flex"
                          style={{ background: `${meta.color}18`, borderColor: `${meta.color}55`, color: meta.color }}
                        >
                          {meta.label}
                        </div>
                      </div>
                      <p className="mb-3 max-w-2xl text-[11px] text-[#6B7280] italic sm:text-xs">{instruction}</p>

                      {linkedAudio && (
                        <div className="mb-3 rounded-[18px] border border-[#E5E7EB] bg-white p-2.5 sm:p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <Volume2 size={14} className="text-[#1F7A4C] shrink-0" />
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#6B7280]">Audio</span>
                            <span className="truncate text-[10px] text-[#4B5563]">{linkedAudio.file.name}</span>
                          </div>
                          <audio src={linkedAudio.url} controls className="w-full" onPlay={() => setMediaPlayed(true)} />
                          {!mediaPlayed && (
                            <p className="mt-2 text-[10px] text-[#6B7280]">
                              Listen to the audio first — the answer stays locked until it has been played.
                            </p>
                          )}
                        </div>
                      )}

                      {linkedVideo && (
                        <div className="mb-3 rounded-[18px] border border-[#E5E7EB] bg-white p-2.5 sm:p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#7C3AED]">Video</span>
                            <span className="truncate text-[10px] text-[#4B5563]">{linkedVideo.file.name}</span>
                          </div>
                          <video
                            src={linkedVideo.url}
                            controls
                            className="max-h-[35vh] w-full rounded-xl bg-black"
                            onPlay={() => setMediaPlayed(true)}
                          />
                          {!mediaPlayed && (
                            <p className="mt-2 text-[10px] text-[#6B7280]">
                              Watch the video first — the answer stays locked until it has been played.
                            </p>
                          )}
                        </div>
                      )}

                      {!mediaLocked && (
                        <div className="mb-3 flex items-start gap-3 rounded-[18px] border border-[#E5E7EB] bg-white p-2.5 sm:p-3">
                          <div className="shrink-0">
                            <Avatar emotion={emotion} size={60} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-base leading-relaxed text-[#111827] sm:text-lg whitespace-pre-wrap">
                              {current.prompt}
                            </div>
                            <button
                              type="button"
                              onClick={() => speak(current.prompt)}
                              className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[#1F7A4C] transition-colors hover:text-[#16643D]"
                            >
                              <span
                                className={`flex h-8 w-8 items-center justify-center rounded-full border border-[#BBF7D0] bg-[#F0FDF4] transition-all ${playing ? 'animate-pulse' : ''}`}
                              >
                                <Volume2 size={14} className="text-[#1F7A4C]" />
                              </span>
                              {playing ? 'Playing…' : 'Listen'}
                            </button>
                          </div>
                        </div>
                      )}

                      {current.practice === 'reading' && current.sourceText && (
                        <div className="mb-4 max-h-52 overflow-y-auto rounded-[18px] border border-[#E5E7EB] bg-white p-4">
                          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[#6B7280]">Reading passage</p>
                          <div className="text-sm leading-relaxed text-[#374151] whitespace-pre-wrap">{current.sourceText}</div>
                        </div>
                      )}

                      {feedback && current.solutions && current.solutions.length > 0 && (
                        <div className="mb-4 rounded-[16px] border border-[#E5E7EB] bg-white p-3">
                          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#6B7280]">
                            Solution (handbook)
                          </div>
                          <p className="text-[12px] leading-relaxed text-[#374151] whitespace-pre-wrap">{current.solutions[0]}</p>
                        </div>
                      )}

                      <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-3 sm:p-4">
                        {renderInteractive(resolvedType)}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 mt-3 rounded-[18px] border border-[#E5E7EB] bg-white/90 p-2 shadow-soft backdrop-blur-sm">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <button
              type="button"
              onClick={() => goTo(pos - 1)}
              disabled={pos === 0}
              className="justify-self-start flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#111827] transition-colors hover:border-[#D1D5DB] hover:bg-[#F9FAFB] disabled:cursor-default disabled:opacity-30"
            >
              <ChevronLeft size={14} />
              Previous
            </button>

            <button
              type="button"
              onClick={shuffleDeck}
              className="justify-self-center flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#374151] transition-colors hover:border-[#D1D5DB] hover:bg-[#F9FAFB]"
            >
              <Shuffle size={13} />
              Shuffle
            </button>

            <button
              type="button"
              onClick={() => goTo(pos + 1)}
              disabled={pos === order.length - 1}
              className="justify-self-end flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#111827] transition-colors hover:border-[#D1D5DB] hover:bg-[#F9FAFB] disabled:cursor-default disabled:opacity-30"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div aria-live="polite" className="sr-only">
          {feedback
            ? feedback.type === 'correct'
              ? 'Correct! Well done.'
              : 'Incorrect. Review the correct answer below.'
            : ''}
        </div>

        <FeedbackPanel
          visible={!!feedback}
          type={feedback?.type ?? 'incorrect'}
          answer={feedback?.answer}
          correctAnswer={current.answer}
          explanation={current.explanation}
          xp={feedback?.type === 'correct' ? current.xp : 0}
          onRetry={() => setFeedback(null)}
          onNext={() => goTo(pos + 1)}
          onExplain={() => setExplainOpen(true)}
          anchorEl={cardEl}
        />

        <ExplanationModal
          visible={explainOpen}
          onClose={() => setExplainOpen(false)}
          exercise={current}
          correctAnswer={current.answer}
          userAnswer={feedback?.answer}
        />
      </div>
    </MotionConfig>
  )
}
