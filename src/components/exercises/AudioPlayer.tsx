'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, Play, Pause, RotateCw, Send, Type } from 'lucide-react'
import { Avatar } from './Avatar'
import { SentenceBuilder } from './SentenceBuilder'
import { ChoiceCard } from './ChoiceCard'
import type { PremiumExercise } from '@/lib/types/exercise'
import type { UserAnswer } from '@/lib/exercise-model'

type ListenMode = 'choice' | 'reconstruct' | 'dictation'

interface AudioPlayerProps {
  exercise: PremiumExercise
  onAnswer: (answer: UserAnswer) => void
  disabled?: boolean
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const

const WAVE_BARS = Array.from({ length: 24 }, (_, i) => ({
  height: 8 + ((i * 37) % 36),
  duration: 0.5 + ((i * 13) % 60) / 100,
  delay: i * 0.04,
}))

/**
 * Audio-centered listening experience. Uses the Web Speech API to "play" the
 * prompt text (no real audio assets required), renders an animated waveform,
 * and lets the learner pick a response mode after listening.
 */
export function AudioPlayer({ exercise, onAnswer, disabled = false }: AudioPlayerProps) {
  const [phase, setPhase] = useState<'listening' | 'mode-select' | 'responding'>('listening')
  const [mode, setMode] = useState<ListenMode>('dictation')
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<typeof SPEED_OPTIONS[number]>(1)
  const [dictated, setDictated] = useState('')
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const source = exercise.prompt || exercise.sourceText || ''

  const play = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(source)
    u.lang = exercise.locale ?? 'de-DE'
    u.rate = speed
    utteranceRef.current = u
    setPlaying(true)
    u.onend = () => {
      setPlaying(false)
      if (phase === 'listening') setPhase('mode-select')
    }
    u.onerror = () => setPlaying(false)
    window.speechSynthesis.speak(u)
  }

  const stop = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    setPlaying(false)
  }

  const handleMode = (m: ListenMode) => {
    setMode(m)
    setPhase('responding')
  }

  return (
    <motion.div className="flex flex-col items-center">
      <div className="flex justify-center mb-2">
        <Avatar emotion={playing ? 'thinking' : phase === 'listening' ? 'idle' : 'correct'} size={72} />
      </div>

      <p className="text-center text-[#A8A29E] mb-6 max-w-md">Listen carefully, then answer.</p>

      {/* Waveform + play area */}
      <div className="w-full max-w-md mb-6">
        <div
          className="h-16 px-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] flex items-center justify-center gap-1 mb-4 overflow-hidden"
          aria-hidden={!playing}
        >
          {SPEED_OPTIONS.slice(0, 1).map(() => null)}
          {playing ? (
            WaveformBars()
          ) : (
            <span className="text-xs text-[#6B7280] text-center">
              {source ? source.slice(0, 80) + (source.length > 80 ? '…' : '') : 'Tap play to listen'}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mb-4">
          <button
            type="button"
            onClick={playing ? stop : play}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--color-accent-sky)] to-[var(--color-accent-purple)] text-white flex items-center justify-center shadow-[0_0_24px_rgba(56,189,248,0.35)] focus:ring-2 focus:ring-[var(--color-accent-lime)] focus:ring-offset-2 focus:ring-offset-[#0C0C0C]"
            aria-label={playing ? 'Pause' : 'Play audio'}
          >
            {playing ? <Pause size={24} /> : <Play size={22} />}
          </button>
          <button
            type="button"
            onClick={play}
            className="w-10 h-10 rounded-lg bg-[rgba(250,248,245,0.04)] border border-[rgba(250,248,245,0.08)] flex items-center justify-center hover:bg-[rgba(250,248,245,0.07)] focus:ring-2 focus:ring-[var(--color-accent-lime)] text-[#A8A29E]"
            aria-label="Replay"
          >
            <RotateCw size={16} />
          </button>
        </div>

        {/* Speed controls */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                speed === s
                  ? 'bg-gradient-to-r from-[var(--color-accent-purple)] to-[var(--color-accent-lime)] text-white border-transparent'
                  : 'text-[#6B7280] border-[rgba(250,248,245,0.08)] hover:text-[#FAF8F5]'
              } focus:ring-2 focus:ring-[var(--color-accent-lime)]`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Mode selection / sub-challenge */}
      <AnimatePresence mode="wait">
        {phase === 'mode-select' && (
          <motion.div key="modes" className="flex flex-col items-center gap-3 w-full max-w-md">
            <div className="text-sm text-[#6B7280]">How would you like to answer?</div>
            <ModeButton label="Multiple choice" desc="4 visual options" icon={<Volume2 size={16} />} onClick={() => handleMode('choice')} />
            <ModeButton label="Reconstruct" desc="Drag the words" icon={<Play size={16} />} onClick={() => handleMode('reconstruct')} />
            <ModeButton label="Dictation" desc="Type what you heard" icon={<Type size={16} />} onClick={() => handleMode('dictation')} />
          </motion.div>
        )}

        {phase === 'responding' && mode === 'dictation' && (
          <motion.div key="dictation" className="w-full max-w-md flex flex-col items-center gap-4">
            <textarea
              value={dictated}
              onChange={(e) => setDictated(e.target.value)}
              placeholder="Type what you heard…"
              disabled={disabled}
              className="w-full h-24 bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.08)] rounded-xl px-4 py-3 text-sm text-[#FAF8F5] outline-none focus:border-[var(--color-accent-lime)] resize-none focus:ring-2 focus:ring-[var(--color-accent-lime)]"
            />
            <button
              type="button"
              onClick={() => dictated.trim() && onAnswer({ type: 'listening', mode: 'dictation', answer: dictated.trim() })}
              disabled={!dictated.trim() || disabled}
              className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-[var(--color-accent-lime)]"
            >
              <Send size={15} />
              Submit
            </button>
          </motion.div>
        )}

        {phase === 'responding' && mode === 'reconstruct' && (
          <motion.div key="reconstruct" className="w-full">
            <SentenceBuilder exercise={exercise} answerType="translation" onAnswer={onAnswer} disabled={disabled} />
          </motion.div>
        )}

        {phase === 'responding' && mode === 'choice' && (
          <motion.div key="choice" className="w-full">
            <ChoiceCard exercise={exercise} onAnswer={onAnswer} disabled={disabled} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ModeButton({ label, desc, icon, onClick }: { label: string; desc: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-xl glass-card text-left transition-all focus:ring-2 focus:ring-[var(--color-accent-lime)]"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-accent-sky)] to-[var(--color-accent-purple)] flex items-center justify-center text-white">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-[#FAF8F5]">{label}</div>
        <div className="text-xs text-[#6B7280]">{desc}</div>
      </div>
    </motion.button>
  )
}

function WaveformBars() {
  return (
    <>
      {WAVE_BARS.map((b, i) => (
        <motion.div
          key={i}
          className="w-1.5 rounded-full bg-gradient-to-t from-[var(--color-accent-lime)] to-[var(--color-accent-purple)]"
          initial={{ height: 4 }}
          animate={{ height: b.height }}
          transition={{ duration: b.duration, repeat: Infinity, repeatType: 'reverse', delay: b.delay }}
        />
      ))}
    </>
  )
}
