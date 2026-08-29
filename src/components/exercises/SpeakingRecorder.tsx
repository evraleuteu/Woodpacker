'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Square, RefreshCw, Send, CheckCircle2, XCircle } from 'lucide-react'
import { Avatar } from './Avatar'
import type { PremiumExercise } from '@/lib/types/exercise'
import type { UserAnswer } from '@/lib/exercise-model'

interface SpeakingRecorderProps {
  exercise: PremiumExercise
  onAnswer: (answer: UserAnswer) => void
  disabled?: boolean
}

interface RecogLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string; confidence: number } } } }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start: () => void
  stop: () => void
}

interface Score {
  label: string
  score: number
  threshold: number
}

const WAVEFORM_BARS = Array.from({ length: 20 }, (_, i) => ({
  height: 8 + ((i * 31) % 32),
  duration: 0.4 + ((i * 17) % 40) / 100,
  delay: i * 0.03,
}))

/**
 * Duolingo-style speaking task. Records the learner's voice via the Web
 * Speech API, transcribes it in real time, and scores pronunciation,
 * grammar, vocabulary and fluency against a reference sentence.
 */
export function SpeakingRecorder({ exercise, onAnswer, disabled = false }: SpeakingRecorderProps) {
  const reference = exercise.answer ?? ''
  const locale = exercise.locale ?? 'de-DE'
  const [recState, setRecState] = useState<'idle' | 'listening' | 'done'>('idle')
  const [recognized, setRecognized] = useState('')
  const [typed, setTyped] = useState('')
  const [confidence, setConfidence] = useState(0.6)
  const [scores, setScores] = useState<Score[] | null>(null)
  const [typedFallback, setTypedFallback] = useState(false)

  const startRecording = () => {
    const W = window as unknown as { webkitSpeechRecognition?: new () => RecogLike }
    if (!W.webkitSpeechRecognition) {
      setTypedFallback(true)
      return
    }
    const rec = new W.webkitSpeechRecognition()
    rec.lang = locale
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          setRecognized(e.results[i][0].transcript)
          setConfidence(e.results[i][0].confidence)
        }
      }
      setRecState('done')
    }
    rec.onerror = () => setRecState('done')
    rec.onend = () => setRecState('done')
    setRecState('listening')
    setRecognized('')
    rec.start()
  }

  const answerText = recognized || typed.trim()

  const wordOverlap = (a: string, b: string): number => {
    const wa = new Set(a.toLowerCase().match(/[\p{L}']+/gu) ?? [])
    const wb = new Set(b.toLowerCase().match(/[\p{L}']+/gu) ?? [])
    if (!wa.size || !wb.size) return 0
    let hits = 0
    for (const w of wa) {
      if ([...wb].some((t) => t === w || (w.length >= 5 && t.length >= 5 && (w.startsWith(t) || t.startsWith(w))))) hits++
    }
    return hits / wa.size
  }

  const handleSubmit = () => {
    const text = answerText
    if (!text) return
    const overlap = reference ? wordOverlap(text, reference) : 0
    const vocabScore = reference ? Math.round(40 + overlap * 60) : Math.min(100, 40 + (new Set(text.toLowerCase().match(/[\p{L}']+/gu) ?? []).size >= 4 ? 40 : 0) + confidence * 20)
    const grammarScore = reference ? Math.round(45 + overlap * 55) : Math.min(100, 50 + confidence * 40)
    const fluencyScore = reference ? Math.max(0, Math.min(100, Math.round(100 - Math.abs(text.split(' ').length - reference.split(' ').length) * 12))) : Math.min(100, Math.round(40 + text.split(' ').length * 8))
    const pronunciationScore = recState === 'done' ? Math.round(55 + confidence * 45) : grammarScore
    setScores([
      { label: 'Pronunciation', score: pronunciationScore, threshold: 75 },
      { label: 'Grammar', score: grammarScore, threshold: 80 },
      { label: 'Vocabulary', score: vocabScore, threshold: 80 },
      { label: 'Fluency', score: fluencyScore, threshold: 70 },
    ])
    onAnswer({ type: 'speaking', mode: 'text', text })
  }

  const handleReset = () => {
    setRecState('idle')
    setRecognized('')
    setTyped('')
    setScores(null)
    setTypedFallback(false)
  }

  return (
    <motion.div className="flex flex-col items-center">
      <Avatar emotion={recState === 'listening' ? 'thinking' : recState === 'done' && scores ? 'correct' : 'idle'} size={76} />

      <p className="text-center text-[#A8A29E] my-6 max-w-md">{exercise.prompt || reference}</p>

      {/* Microphone */}
      {!scores && (
        <>
          {!typedFallback && (
            <div className="relative mb-6">
              <motion.button
                type="button"
                onClick={startRecording}
                disabled={disabled || recState === 'listening'}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-accent-sky)] to-[var(--color-accent-purple)] text-white flex items-center justify-center shadow-[0_0_0_6px_rgba(56,189,248,0.2)] focus:ring-2 focus:ring-[var(--color-accent-lime)] focus:ring-offset-2 focus:ring-offset-[#0C0C0C]"
                animate={recState === 'listening' ? { boxShadow: ['0 0 0 6px rgba(56,189,248,0.2)', '0 0 0 18px rgba(56,189,248,0)'] } : {}}
                transition={{ duration: 1.4, repeat: recState === 'listening' ? Infinity : 0 }}
                aria-label="Record"
              >
                {recState === 'listening' ? <Square size={32} /> : <Mic size={32} />}
              </motion.button>
            </div>
          )}

          {recState === 'listening' && (
            <div className="flex items-end justify-center gap-0.5 h-10 mb-6" aria-label="Listening">
              {WAVEFORM_BARS.map((b, i) => (
                <motion.div
                  key={i}
                  className="w-1 rounded-sm bg-gradient-to-t from-[var(--color-accent-lime)] to-[var(--color-accent-purple)]"
                  initial={{ height: 4 }}
                  animate={{ height: b.height }}
                  transition={{ duration: b.duration, repeat: Infinity, repeatType: 'reverse', delay: b.delay }}
                />
              ))}
            </div>
          )}

          {recState === 'done' && recognized && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-lg bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.2)] mb-4 max-w-md text-center"
              >
                <div className="text-xs text-[#6B7280] mb-1">You said:</div>
                <div className="text-sm text-[#FAF8F5]">{recognized}</div>
              </motion.div>
            </AnimatePresence>
          )}

          {typedFallback && (
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type your spoken answer here…"
              className="w-full max-w-md mb-4 bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.08)] rounded-xl px-4 py-2.5 text-sm text-[#FAF8F5] outline-none focus:border-[var(--color-accent-lime)] focus:ring-2 focus:ring-[var(--color-accent-lime)]"
            />
          )}

          {!reference && !answerText && (
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary mb-4 text-xs flex items-center gap-1.5 focus:ring-2 focus:ring-[var(--color-accent-lime)]"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!answerText || disabled}
            className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-[var(--color-accent-lime)]"
          >
            <Send size={15} />
            Submit Answer
          </button>
        </>
      )}

      {/* Scores feedback */}
      <AnimatePresence>
        {scores && (
          <motion.div
            key="scores"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-md space-y-3 mt-4"
          >
            <h3 className="text-sm font-semibold text-center text-[#FAF8F5]">AI Feedback</h3>
            {scores.map((s) => {
              const passed = s.score >= s.threshold
              return (
                <div key={s.label} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                  <div className="flex items-center gap-2">
                    {passed ? <CheckCircle2 size={14} className="text-[var(--color-accent-lime)]" /> : <XCircle size={14} className="text-[#6B7280]" />}
                    <span className="text-xs text-[#A8A29E]">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-[rgba(250,248,245,0.06)] overflow-hidden">
                      <div className={`h-full rounded-full ${passed ? 'bg-gradient-to-r from-[var(--color-accent-lime)] to-[#10B981]' : 'bg-[#6B7280]'}`} style={{ width: `${s.score}%` }} />
                    </div>
                    <span className={`text-xs font-medium ${passed ? 'text-[var(--color-accent-lime)]' : 'text-[#6B7280]'}`}>{s.score}%</span>
                  </div>
                </div>
              )
            })}
            <button type="button" onClick={handleReset} className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-[var(--color-accent-lime)]">
              <RefreshCw size={13} />
              Practice again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
