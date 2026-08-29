'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Mic, Crosshair, TrendingUp, Zap, Repeat, Volume2 } from 'lucide-react'
import { useCourse } from '@/lib/useCourse'

const focusAreas = [
  { name: 'Pronunciation', icon: Volume2, description: 'Individual sounds and phonemes', exercises: 24, gradient: 'from-[#059669] to-[#10B981]' },
  { name: 'Intonation', icon: TrendingUp, description: 'Rise and fall of the voice', exercises: 18, gradient: 'from-[#10B981] to-[#34D399]' },
  { name: 'Rhythm', icon: Zap, description: 'Stress timing and syllable length', exercises: 15, gradient: 'from-[#059669] to-[#10B981]' },
  { name: 'Stress', icon: Zap, description: 'Word and sentence stress patterns', exercises: 20, gradient: 'from-[#D97706] to-[#F59E0B]' },
  { name: 'Shadowing', icon: Repeat, description: 'Repeat audio in real-time', exercises: 12, gradient: 'from-[#10B981] to-[#34D399]' },
]

const errorPatterns = [
  { phoneme: 'TH sound /θ/', language: 'German', severity: 'High' },
  { phoneme: 'R sound /ɹ/', language: 'French', severity: 'Medium' },
  { phoneme: 'Vowel length', language: 'Spanish', severity: 'Low' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function AccentMastery() {
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const course = useCourse()
  const drillLesson = useMemo(() => {
    if (!course) return null
    const lessons = course.modules.flatMap((m) => m.lessons)
    return lessons.find((l) => l.materials?.listening?.transcript || l.materials?.reading?.passage) ?? lessons[0] ?? null
  }, [course])
  const drillLine = useMemo(() => {
    if (!drillLesson) return null
    const text = drillLesson.materials?.listening?.transcript || drillLesson.materials?.reading?.passage
    if (text) {
      const first = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]/)?.[0]?.trim()
      if (first) return first
    }
    return drillLesson.materials?.speaking?.recalls[0] ?? null
  }, [drillLesson])

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8 max-w-6xl mx-auto"
    >
      <motion.div variants={itemVariants} className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D97706] to-[#F59E0B] flex items-center justify-center">
            <Crosshair size={16} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Accent Mastery</h1>
        </div>
        <p className="text-[#A8A29E] text-sm">
          Sound natural. Improve pronunciation, intonation, rhythm, stress, and shadowing through Woodpecker repetition cycles.
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-xl p-6">
          <h2 className="font-semibold text-sm mb-4">Training Focus</h2>
          <div className="space-y-2">
            {focusAreas.map((area) => (
              <button
                key={area.name}
                onClick={() => setSelectedArea(selectedArea === area.name ? null : area.name)}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all ${
                  selectedArea === area.name
                    ? 'bg-gradient-to-r from-[rgba(16,185,129,0.12)] to-[rgba(5,150,105,0.08)] border border-[rgba(16,185,129,0.25)]'
                    : 'bg-[rgba(250,248,245,0.02)] border border-transparent hover:border-[rgba(250,248,245,0.06)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${area.gradient} flex items-center justify-center`}>
                    <area.icon size={14} className="text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{area.name}</div>
                    <div className="text-xs text-[#A8A29E]">{area.description}</div>
                  </div>
                </div>
                <span className="text-xs text-[#6B7280]">{area.exercises} drills</span>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h2 className="font-semibold text-sm mb-2">Detected Error Patterns</h2>
          <p className="text-xs text-[#A8A29E] mb-4">Based on your uploaded materials and speaking sessions.</p>
          <div className="space-y-3">
            {errorPatterns.map((error) => (
              <div key={error.phoneme} className="p-3 rounded-lg bg-[rgba(250,248,245,0.02)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{error.phoneme}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      error.severity === 'High'
                        ? 'bg-[rgba(239,68,68,0.1)] text-[#ef4444] border border-[rgba(239,68,68,0.2)]'
                        : error.severity === 'Medium'
                        ? 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b] border border-[rgba(245,158,11,0.2)]'
                        : 'bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]'
                    }`}
                  >
                    {error.severity}
                  </span>
                </div>
                <div className="text-xs text-[#6B7280]">{error.language}</div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 px-3 py-2 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-xs text-[#6B7280] hover:text-[#FAF8F5] transition-colors">
            Upload voice sample for full analysis →
          </button>
        </div>
      </motion.div>

      {selectedArea && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.03)] p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">{selectedArea} — Daily Drill</h3>
            <span className="text-xs text-[#6B7280]">5 min &middot; Cycle 1 of 5</span>
          </div>

          <div className="p-4 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] mb-4">
            <div className="text-sm text-[#A8A29E] mb-2">Listen and repeat:</div>
            <div className="text-lg font-bold text-gradient">
              {drillLine ? `"${drillLine.length > 90 ? `${drillLine.slice(0, 90)}…` : drillLine}"` : '"The thirty-three thieves thought..."'}
            </div>
            <div className="text-xs text-[#6B7280] mt-2">
              {drillLesson ? `From "${drillLesson.title}" · Focus on rhythm and stress.` : 'Focus on the /θ/ sound at the start of each word.'}
            </div>
          </div>

          <div className="flex gap-2">
            <Link href="/speaking" className="btn-primary inline-flex items-center gap-2">
              <Mic size={14} />
              Start Practice
            </Link>
            <button className="btn-secondary">
              <Repeat size={14} />
              Slower
            </button>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <div className="flex gap-1 flex-1">
              {[1, 2, 3, 4, 5].map((c) => (
                <div
                  key={c}
                  className={`flex-1 h-1.5 rounded-full ${c === 1 ? 'progress-bar-fill' : 'bg-[rgba(250,248,245,0.05)]'}`}
                />
              ))}
            </div>
            <div className="text-[10px] text-[#6B7280]">Cycle 1: Full audio + transcript</div>
          </div>
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h2 className="font-semibold text-sm mb-5">Accent Woodpecker Cycle</h2>
        <div className="grid grid-cols-5 gap-3">
          {[
            { cycle: 1, label: 'Listen & Repeat', support: 'Full audio + transcript', icon: Volume2 },
            { cycle: 2, label: 'Shadow', support: 'Audio + keywords', icon: Repeat },
            { cycle: 3, label: 'Read Aloud', support: 'Text only, no audio', icon: Mic },
            { cycle: 4, label: 'Speak Freely', support: 'Topic prompt only', icon: Mic },
            { cycle: 5, label: 'Natural Speech', support: 'Real conversation, no hints', icon: Crosshair },
          ].map((c) => (
            <div key={c.cycle} className="text-center p-4 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D97706] to-[#F59E0B] flex items-center justify-center mx-auto mb-3">
                <c.icon size={16} className="text-white" />
              </div>
              <div className="text-sm font-bold text-gradient-gold">Cycle {c.cycle}</div>
              <div className="text-xs font-medium mt-0.5 text-[#A8A29E]">{c.label}</div>
              <div className="text-[10px] text-[#6B7280] mt-1 leading-tight">{c.support}</div>
            </div>
          ))}
        </div>
        <Link
          href="/speaking"
          className="block text-center text-xs text-gradient hover:opacity-80 mt-4"
        >
          Combine with Speaking Mastery for full practice →
        </Link>
      </motion.div>
    </motion.div>
  )
}

