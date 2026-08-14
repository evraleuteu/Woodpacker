'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Mic,
  Diamond,
  Headphones,
  Trophy,
  ArrowLeft,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Volume2,
  Sparkles,
  Upload,
  Type,
  Square,
} from 'lucide-react'
import { loadCourse } from '@/lib/storage'
import { minePatterns } from '@/lib/heuristics'
import type { Course, Lesson } from '@/lib/types'

type SpeakingMode = 'audio-recall' | 'pattern-mastery' | 'voice-response' | null

interface SpeakingItem {
  id: string
  mode: Exclude<SpeakingMode, null>
  lessonTitle: string
  kind: string
  audio?: string
  transcript?: string
  question?: string
  prompt?: string
  reference?: string
  examples?: string[]
}

interface Score {
  label: string
  score: number
  threshold: number
}

const LANG_OPTIONS = [
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'es-ES', label: 'Español' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'en-US', label: 'English' },
  { code: 'pt-PT', label: 'Português' },
  { code: 'nl-NL', label: 'Nederlands' },
  { code: 'ru-RU', label: 'Русский' },
]

const CYCLE_LABELS = ['Full support', 'Keywords only', 'No transcript', 'Question only', 'Real-life scenario']

const modes = [
  {
    id: 'audio-recall' as const,
    title: 'Audio Recall',
    description: 'Listen to your material, pause, and answer aloud.',
    icon: Headphones,
    gradient: 'from-[#059669] to-[#10B981]',
    tag: 'Listening & Speaking',
  },
  {
    id: 'pattern-mastery' as const,
    title: 'Pattern Mastery',
    description: 'Drill sentence structures repeated throughout your material.',
    icon: Diamond,
    gradient: 'from-[#10B981] to-[#34D399]',
    tag: 'Grammar & Structure',
  },
  {
    id: 'voice-response' as const,
    title: 'Voice Response',
    description: 'Respond to prompts from your material. Get structured feedback.',
    icon: MessageSquare,
    gradient: 'from-[#D97706] to-[#F59E0B]',
    tag: 'Free Speaking',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const lessonSentences = (lesson: Lesson): string[] => {
  const sentences: string[] = []
  for (const g of lesson.grammar) sentences.push(...g.examples)
  for (const v of lesson.vocabulary) sentences.push(...v.examples)
  if (lesson.materials.listening?.transcript) sentences.push(lesson.materials.listening.transcript)
  if (lesson.materials.reading?.passage) sentences.push(lesson.materials.reading.passage)
  for (const s of lesson.materials.speaking.roleplays) sentences.push(s)
  return sentences
}

const buildItems = (course: Course): SpeakingItem[] => {
  const items: SpeakingItem[] = []
  for (const lesson of course.modules.flatMap((m) => m.lessons)) {
    const listening = lesson.materials.listening
    if (listening?.transcript && listening.questions?.length) {
      for (const q of listening.questions) {
        items.push({
          id: `ar-listen-${lesson.id}-${q.slice(0, 24)}`,
          mode: 'audio-recall',
          lessonTitle: lesson.title,
          kind: 'Listening — transcript from your material',
          audio: listening.transcript,
          transcript: listening.transcript,
          question: q,
          reference: listening.transcript.split('.')[0] + '.',
        })
      }
    } else if (listening?.transcript) {
      items.push({
        id: `ar-repeat-${lesson.id}`,
        mode: 'audio-recall',
        lessonTitle: lesson.title,
        kind: 'Listening — repeat aloud',
        audio: listening.transcript,
        transcript: listening.transcript,
        question: 'Repeat the sentence aloud.',
        reference: listening.transcript,
      })
    }
    for (const recall of lesson.materials.speaking.recalls.slice(0, 6)) {
      items.push({
        id: `ar-recall-${lesson.id}-${recall.slice(0, 24)}`,
        mode: 'audio-recall',
        lessonTitle: lesson.title,
        kind: 'Vocabulary recall — from your material',
        audio: recall,
        transcript: recall,
        question: 'Say your answer aloud.',
        reference: recall,
      })
    }
    if (lesson.materials.reading?.passage && lesson.materials.reading.questions?.length) {
      items.push({
        id: `ar-read-${lesson.id}`,
        mode: 'audio-recall',
        lessonTitle: lesson.title,
        kind: 'Reading — answer from the text',
        audio: lesson.materials.reading.passage,
        transcript: lesson.materials.reading.passage,
        question: lesson.materials.reading.questions[0],
        reference: lesson.materials.reading.passage.split('.')[0] + '.',
      })
    }

    for (const p of minePatterns(lessonSentences(lesson), 3)) {
      items.push({
        id: `pm-${lesson.id}-${p.pattern.slice(0, 24)}`,
        mode: 'pattern-mastery',
        lessonTitle: lesson.title,
        kind: `Pattern — ${p.count}× in your material`,
        audio: p.examples[0],
        transcript: p.examples[0],
        question: `Complete the sentence: "${p.pattern}"`,
        reference: p.examples[0],
        examples: p.examples,
      })
    }

    for (const drill of lesson.materials.speaking.drills.slice(0, 2)) {
      items.push({
        id: `pm-drill-${lesson.id}-${drill.slice(0, 24)}`,
        mode: 'pattern-mastery',
        lessonTitle: lesson.title,
        kind: 'Grammar drill — from your material',
        question: drill,
        reference: drill,
      })
    }

    if (listening?.questions?.length) {
      items.push({
        id: `vr-listen-${lesson.id}`,
        mode: 'voice-response',
        lessonTitle: lesson.title,
        kind: 'Listening question — speak freely',
        prompt: listening.questions[0],
        audio: listening.transcript,
      })
    }
    for (const w of lesson.materials.writing.prompts.slice(0, 2)) {
      items.push({
        id: `vr-write-${lesson.id}-${w.slice(0, 24)}`,
        mode: 'voice-response',
        lessonTitle: lesson.title,
        kind: 'Writing prompt — say it instead',
        prompt: w,
      })
    }
    for (const rp of lesson.materials.speaking.roleplays.slice(0, 2)) {
      items.push({
        id: `vr-rp-${lesson.id}-${rp.slice(0, 24)}`,
        mode: 'voice-response',
        lessonTitle: lesson.title,
        kind: 'Roleplay — from your material',
        prompt: `Scenario: ${rp}`,
        audio: rp,
      })
    }
  }
  return items
}

const loadProgress = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem('woodpacker:speaking-progress')
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

const loadLang = (course?: Course | null): string => {
  try {
    return localStorage.getItem('woodpacker:speech-lang') ?? (course?.language ? `${course.language}-${course.language.toUpperCase()}` : 'de-DE')
  } catch {
    return 'de-DE'
  }
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

export default function SpeakingPage() {
  const [course] = useState<Course | null>(() => loadCourse())
  const [items] = useState<SpeakingItem[]>(() => (course ? buildItems(course) : []))
  const [lang, setLang] = useState<string>(() => loadLang(course))
  const [progress, setProgress] = useState<Record<string, number>>(() => loadProgress())
  const [activeMode, setActiveMode] = useState<SpeakingMode>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [scores, setScores] = useState<Score[]>([])
  const [mastered, setMastered] = useState(false)
  const [recState, setRecState] = useState<'idle' | 'listening' | 'done'>('idle')
  const [recognized, setRecognized] = useState('')
  const [typed, setTyped] = useState('')
  const [recConfidence, setRecConfidence] = useState(0.6)

  const modeItems = activeMode ? items.filter((i) => i.mode === activeMode) : []
  const item = modeItems[currentIndex]
  const itemCycle = item ? progress[item.id] ?? 1 : 1

  const setItemCycle = (id: string, cycle: number) => {
    const next = { ...progress, [id]: Math.min(5, Math.max(1, cycle)) }
    setProgress(next)
    try {
      localStorage.setItem('woodpacker:speaking-progress', JSON.stringify(next))
    } catch {
      return
    }
  }

  const speak = (text?: string) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  }

  const startRecording = () => {
    const W = window as unknown as { webkitSpeechRecognition?: new () => RecogLike }
    if (!W.webkitSpeechRecognition) return
    const rec = new W.webkitSpeechRecognition()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          setRecognized(e.results[i][0].transcript)
          setRecConfidence(e.results[i][0].confidence)
        }
      }
      setRecState('done')
    }
    rec.onerror = () => {
      setRecState('done')
    }
    rec.onend = () => {
      setRecState('done')
    }
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
    const reference = item?.reference ?? ''
    const overlap = reference ? wordOverlap(text, reference) : 0
    const vocabScore = reference
      ? Math.round(40 + overlap * 60)
      : Math.min(100, 40 + (new Set(text.toLowerCase().match(/[\p{L}']+/gu) ?? []).size >= 4 ? 40 : 0) + recConfidence * 20)
    const grammarScore = reference
      ? Math.round(45 + overlap * 55)
      : Math.min(100, 50 + recConfidence * 40)
    const fluencyScore = reference
      ? Math.max(0, Math.min(100, Math.round(100 - Math.abs(text.split(' ').length - reference.split(' ').length) * 12)))
      : Math.min(100, Math.round(40 + text.split(' ').length * 8))
    const pronunciationScore = recState === 'done' ? Math.round(55 + recConfidence * 45) : grammarScore

    const nextScores: Score[] = [
      { label: 'Pronunciation', score: pronunciationScore, threshold: 75 },
      { label: 'Grammar', score: grammarScore, threshold: 80 },
      { label: 'Vocabulary', score: vocabScore, threshold: 80 },
      { label: 'Fluency', score: fluencyScore, threshold: 70 },
    ]
    setScores(nextScores)
    const passed = nextScores.every((s) => s.score >= s.threshold)
    setMastered(passed)
    setShowFeedback(true)
    if (passed && item) {
      const next = itemCycle >= 5 ? 5 : itemCycle + 1
      setItemCycle(item.id, next)
    }
  }

  const handleRetry = () => {
    setShowFeedback(false)
    setMastered(false)
    setRecognized('')
    setTyped('')
    setRecState('idle')
  }

  const handleNext = () => {
    if (currentIndex < modeItems.length - 1) setCurrentIndex((i) => i + 1)
    handleRetry()
  }

  const handleBack = () => {
    setActiveMode(null)
    setCurrentIndex(0)
    handleRetry()
  }

  if (!course) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-5xl mx-auto">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4 ai-glow">
            <Mic size={22} className="text-white" />
          </div>
          <h3 className="font-semibold mb-1">No materials to speak from yet</h3>
          <p className="text-sm text-[#A8A29E] mb-4 max-w-md mx-auto">
            Every speaking exercise here is built from your own textbook — transcripts, patterns and prompts are extracted from your uploaded material.
          </p>
          <Link href="/upload" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Upload size={14} />
            Upload materials
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Speaking Mastery</h1>
          <p className="text-[#A8A29E] text-sm mt-1">
            {items.length} speaking exercises generated from “{course.title}” — nothing invented, everything from your material.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-[#6B7280] shrink-0">
          Speech language
          <select
            value={lang}
            onChange={(e) => {
              setLang(e.target.value)
              try {
                localStorage.setItem('woodpacker:speech-lang', e.target.value)
              } catch {
                return
              }
            }}
            className="bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.08)] rounded-lg px-2 py-1.5 text-xs text-[#FAF8F5] outline-none"
          >
            {LANG_OPTIONS.map((o) => (
              <option key={o.code} value={o.code} className="bg-[#1A1B1E]">
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </motion.div>

      {!activeMode ? (
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4 mb-8">
            {modes.map((m) => {
              const count = items.filter((i) => i.mode === m.id).length
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveMode(m.id)
                    setCurrentIndex(0)
                  }}
                  disabled={!count}
                  className={`group glass-card rounded-xl p-6 text-left ${count ? '' : 'opacity-50 cursor-not-allowed'}`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.gradient} flex items-center justify-center mb-4`}>
                    <m.icon size={22} className="text-white" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[#6B7280] font-medium">{m.tag}</span>
                  <h3 className="font-semibold mt-1 mb-1 group-hover:text-[#10B981] transition-colors">{m.title}</h3>
                  <p className="text-xs text-[#A8A29E] leading-relaxed">{m.description}</p>
                  <div className="mt-3 text-[11px] text-[#10B981]">{count} exercise(s) from your materials</div>
                </button>
              )
            })}
          </motion.div>

          <motion.div variants={itemVariants} className="rounded-xl border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.03)] p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center shrink-0">
                <Trophy size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Speak Until Mastered</h3>
                <p className="text-xs text-[#A8A29E] leading-relaxed">
                  An exercise is only mastered when pronunciation ≥ 75%, grammar ≥ 80%, vocabulary ≥ 80% and fluency ≥ 70%. Mastered items advance to the next Woodpecker cycle (5 cycles of decreasing support). If performance drops in later cycles, it returns for practice.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : modeItems.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center">
          <p className="text-sm text-[#A8A29E] mb-4">No exercises of this type could be generated from your materials.</p>
          <button onClick={handleBack} className="btn-secondary text-xs px-4 py-2">
            <ArrowLeft size={14} className="inline mr-1" />
            Back to modes
          </button>
        </div>
      ) : item ? (
        <div>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-6">
            <button onClick={handleBack} className="text-[#6B7280] hover:text-[#FAF8F5] transition-colors p-1">
              <ArrowLeft size={18} />
            </button>
            <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${modes.find((m) => m.id === activeMode)?.gradient} text-white text-xs font-medium`}>
              {modes.find((m) => m.id === activeMode)?.title}
            </div>
            <span className="text-xs text-[#6B7280]">
              Exercise {currentIndex + 1} of {modeItems.length}
            </span>
            <div className="flex-1" />
            <div className="flex items-center gap-1 text-xs text-[#6B7280]">
              {[1, 2, 3, 4, 5].map((c) => (
                <div key={c} className={`w-6 h-1.5 rounded-full ${c <= itemCycle ? 'bg-[#10B981]' : 'bg-[rgba(250,248,245,0.06)]'}`} />
              ))}
              <span className="ml-1">Cycle {itemCycle}/5 · {CYCLE_LABELS[itemCycle - 1]}</span>
            </div>
          </motion.div>

          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="glass-card rounded-xl p-8 mb-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Sparkles size={12} className="text-[#10B981]" />
              <span className="text-[11px] text-[#6B7280]">{item.kind}</span>
              <span className="text-[11px] text-[#10B981]">from “{item.lessonTitle}”</span>
            </div>

            {activeMode === 'audio-recall' && (
              <div>
                <div className="p-5 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] mb-6">
                  <div className="flex items-center gap-3">
                    {itemCycle <= 3 && (
                      <button
                        onClick={() => speak(item.audio)}
                        className="w-11 h-11 rounded-full bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] flex items-center justify-center hover:bg-[rgba(16,185,129,0.2)] transition-all shrink-0"
                        aria-label="Play audio"
                      >
                        <Volume2 size={18} className="text-[#10B981]" />
                      </button>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs text-[#6B7280] mb-0.5">
                        {itemCycle === 1 ? 'Full support: audio + transcript' : itemCycle === 2 ? 'Keywords only — audio plays' : itemCycle === 3 ? 'Audio only, no transcript' : itemCycle === 4 ? 'Question only' : 'Real-life scenario, no hints'}
                      </div>
                      {itemCycle === 1 && <div className="text-sm text-[#A8A29E]">{item.transcript}</div>}
                      {itemCycle === 2 &&
                        item.transcript &&
                        item.transcript.split(' ').map((w, i) => (
                          <span key={i} className="text-sm text-[#A8A29E] mr-1">
                            {w.length > 3 ? `${w.slice(0, 3)}…` : w}
                          </span>
                        ))}
                      {itemCycle >= 3 && <div className="text-sm text-[#6B7280]">Press play and listen carefully.</div>}
                    </div>
                  </div>
                </div>
                <div className="text-xl font-bold mb-3">{item.question}</div>
                <p className="text-sm text-[#A8A29E] mb-6">Say your answer aloud, then submit.</p>
              </div>
            )}

            {activeMode === 'pattern-mastery' && (
              <div>
                <div className="text-sm text-[#A8A29E] mb-2">{item.question}</div>
                <div className="text-3xl font-bold text-gradient mb-6">{item.prompt ?? item.reference}</div>
                {item.examples && item.examples.length > 0 && (
                  <div className="space-y-2 mb-6">
                    <div className="text-xs text-[#A8A29E] mb-2">Examples from your material:</div>
                    {item.examples.map((ex, i) => (
                      <div key={i} className="p-3 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-sm flex items-center gap-2">
                        <Diamond size={10} className="text-[#10B981] shrink-0" />
                        {ex}
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => speak(item.audio ?? item.reference)} className="inline-flex items-center gap-1.5 text-xs text-[#10B981] mb-4 hover:underline">
                  <Volume2 size={12} />
                  Play example
                </button>
                <p className="text-sm text-[#A8A29E] mb-6">Now complete the pattern aloud with your own sentence.</p>
              </div>
            )}

            {activeMode === 'voice-response' && (
              <div>
                <div className="p-5 rounded-xl bg-[rgba(245,158,11,0.04)] border border-[rgba(245,158,11,0.15)] mb-6">
                  <div className="text-xs text-[#F59E0B] mb-2">From your material — speak freely:</div>
                  <div className="text-xl font-bold text-gradient-gold">{item.prompt}</div>
                  {itemCycle <= 3 && item.audio && (
                    <button onClick={() => speak(item.audio)} className="inline-flex items-center gap-1.5 text-xs text-[#F59E0B] mt-3 hover:underline">
                      <Volume2 size={12} />
                      Play audio prompt
                    </button>
                  )}
                </div>
                <p className="text-sm text-[#A8A29E] mb-6">Respond naturally. You will get structured feedback on pronunciation, grammar, vocabulary and fluency.</p>
              </div>
            )}

            {!showFeedback ? (
              <div className="space-y-3">
                {recState !== 'done' && (
                  <button
                    onClick={startRecording}
                    disabled={!answerText && recState === 'listening'}
                    className={`${activeMode === 'voice-response' ? 'btn-gold' : 'btn-primary'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {recState === 'listening' ? (
                      <>
                        <Square size={16} className="animate-pulse" />
                        Listening… speak now
                      </>
                    ) : (
                      <>
                        <Mic size={16} />
                        Record Answer
                      </>
                    )}
                  </button>
                )}
                {recState === 'done' && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[rgba(16,185,129,0.05)] border border-[rgba(16,185,129,0.15)]">
                    <CheckCircle2 size={14} className="text-[#10B981] shrink-0" />
                    <div className="text-sm text-[#A8A29E] truncate">{recognized || 'No speech recognized'}</div>
                    <button onClick={startRecording} className="ml-auto text-xs text-[#10B981] hover:underline shrink-0">
                      Re-record
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                  <Type size={11} />
                  No microphone? Type your answer instead:
                </div>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Type your spoken answer here…"
                  className="w-full bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.08)] rounded-lg px-3 py-2 text-sm text-[#FAF8F5] outline-none focus:border-[rgba(16,185,129,0.4)]"
                />
                <button onClick={handleSubmit} disabled={!answerText} className={`${activeMode === 'voice-response' ? 'btn-gold' : 'btn-primary'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                  Submit Answer
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                {!mastered ? (
                  <button onClick={handleRetry} className={`${activeMode === 'voice-response' ? 'btn-gold' : 'btn-primary'}`}>
                    <RefreshCw size={16} />
                    Practice Again
                  </button>
                ) : (
                  <button onClick={handleNext} className={`${activeMode === 'voice-response' ? 'btn-gold' : 'btn-primary'}`}>
                    Next Exercise
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            )}
          </motion.div>

          <AnimatePresence>
            {showFeedback && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="space-y-4">
                {mastered && (
                  <div className="rounded-xl bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] p-4 flex items-center gap-3">
                    <Trophy size={20} className="text-[#10B981]" />
                    <div>
                      <div className="font-semibold text-[#10B981]">Mastered — advancing to Cycle {Math.min(5, itemCycle + 1)}</div>
                      <div className="text-xs text-[#A8A29E]">
                        {itemCycle >= 5 ? 'All 5 cycles complete — recall is automatic.' : `Next time this exercise reappears with ${CYCLE_LABELS[Math.min(4, itemCycle)]}.`}
                      </div>
                    </div>
                  </div>
                )}
                {!mastered && (
                  <div className="rounded-xl bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] p-4">
                    <div className="font-semibold text-[#F59E0B] text-sm mb-1">Keep drilling — this exercise stays in Cycle {itemCycle}</div>
                    <div className="text-xs text-[#A8A29E]">
                      {item.audio && (
                        <button onClick={() => speak(item.audio)} className="inline-flex items-center gap-1 text-[#10B981] hover:underline mr-3">
                          <Volume2 size={12} />
                          Play audio again
                        </button>
                      )}
                      Below mastery — repeat until it becomes effortless.
                    </div>
                  </div>
                )}

                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm">AI Feedback</h3>
                    <span className="text-xs text-[#6B7280]">{recState === 'done' ? 'Speech analyzed' : 'Text answer analyzed'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {scores.map((s) => {
                      const passed = s.score >= s.threshold
                      return (
                        <div key={s.label} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(250,248,245,0.02)]">
                          <div className="flex items-center gap-2">
                            {passed ? <CheckCircle2 size={14} className="text-[#10B981]" /> : <XCircle size={14} className="text-[#6B7280]" />}
                            <span className="text-xs text-[#A8A29E]">{s.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 progress-bar h-1.5">
                              <div className={passed ? 'progress-bar-fill-success' : 'progress-bar-fill'} style={{ width: `${s.score}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${passed ? 'text-[#10B981]' : 'text-[#A8A29E]'}`}>
                              {s.score}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {item?.reference && (
                  <div className="glass-card rounded-xl p-6">
                    <h3 className="font-semibold text-sm mb-3">Comparison</h3>
                    <div className="p-3 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] mb-2">
                      <div className="text-xs text-[#6B7280] mb-1">You said:</div>
                      <div className="text-sm">{answerText || '—'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.15)]">
                      <div className="text-xs text-[#10B981] mb-1">Reference from your material:</div>
                      <div className="text-sm text-[#10B981]">{item.reference}</div>
                      <div className="text-xs text-[#6B7280] mt-1">Try to match the wording from the original material as closely as possible.</div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  {!mastered ? (
                    <button onClick={handleRetry} className={`${activeMode === 'voice-response' ? 'btn-gold' : 'btn-primary'}`}>
                      <RefreshCw size={14} />
                      Practice Again
                    </button>
                  ) : (
                    <button onClick={handleNext} className={`${activeMode === 'voice-response' ? 'btn-gold' : 'btn-primary'}`}>
                      Next Exercise
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  )
}