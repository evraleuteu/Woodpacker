'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Mic,
  Headphones,
  MessageSquare,
  Crosshair,
  Volume2,
  Trophy,
} from 'lucide-react'

const cycles = [
  {
    id: '1',
    material: 'German A1 Textbook',
    language: 'German',
    cycleNumber: 1,
    durationDays: 30,
    progress: 65,
    status: 'Active',
    startDate: 'Jul 10, 2026',
    endDate: 'Aug 9, 2026',
    pillars: [
      { name: 'Vocabulary', total: 120, completed: 78, mastered: 45 },
      { name: 'Grammar', total: 80, completed: 52, mastered: 30 },
      { name: 'Speaking', total: 48, completed: 22, mastered: 8 },
    ],
  },
  {
    id: '2',
    material: 'French Dialogue Course',
    language: 'French',
    cycleNumber: 1,
    durationDays: 30,
    progress: 30,
    status: 'Active',
    startDate: 'Jul 21, 2026',
    endDate: 'Aug 20, 2026',
    pillars: [
      { name: 'Vocabulary', total: 94, completed: 28, mastered: 15 },
      { name: 'Speaking', total: 31, completed: 8, mastered: 3 },
      { name: 'Listening', total: 22, completed: 6, mastered: 2 },
    ],
  },
]

const cycleProgression = [
  { cycle: 1, duration: '30 Days', support: 'Full audio + transcript + hints', icon: Volume2 },
  { cycle: 2, duration: '15 Days', support: 'Audio + keywords only', icon: Headphones },
  { cycle: 3, duration: '7 Days', support: 'Audio only, no transcript', icon: Mic },
  { cycle: 4, duration: '3 Days', support: 'Question only, no audio', icon: MessageSquare },
  { cycle: 5, duration: '1 Day', support: 'Full spontaneous, no hints', icon: Crosshair },
]

const milestones = [
  { name: 'Pattern: Ich möchte...', language: 'German', status: 'Mastered', score: 96 },
  { name: 'Pattern: Je voudrais...', language: 'French', status: 'In Progress', score: 72 },
  { name: 'Audio Recall: Restaurant', language: 'German', status: 'Cycle 2', score: 88 },
  { name: 'Voice Response: Weekend', language: 'German', status: 'Needs Review', score: 65 },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function CyclesPage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8 max-w-6xl mx-auto"
    >
      <motion.div variants={itemVariants} className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Woodpecker Cycles</h1>
        <p className="text-[#A8A29E] text-sm mt-1">
          Each exercise progresses through five cycles of decreasing support until recall is automatic.
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 mb-8">
        <h2 className="font-semibold text-sm mb-5">How Cycles Work</h2>
        <div className="grid grid-cols-5 gap-3">
          {cycleProgression.map((c) => (
            <div key={c.cycle} className="text-center p-4 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-3">
                <c.icon size={16} className="text-white" />
              </div>
              <div className="text-sm font-bold text-gradient">Cycle {c.cycle}</div>
              <div className="text-xs text-[#A8A29E] mb-1">{c.duration}</div>
              <div className="text-[10px] text-[#6B7280] leading-tight">{c.support}</div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <h2 className="font-semibold mb-5 text-sm">Active Cycles</h2>
        <div className="space-y-4 mb-8">
          {cycles.map((c) => (
            <div key={c.id} className="glass-card rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold">{c.material}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#6B7280] mt-0.5">
                    <span>{c.language}</span>
                    <span>&middot;</span>
                    <span>Cycle {c.cycleNumber} of 5</span>
                    <span>&middot;</span>
                    <span>{c.durationDays} days</span>
                    <span>&middot;</span>
                    <span>{c.startDate} → {c.endDate}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]">
                    Active
                  </span>
                  <span className="text-sm font-bold text-gradient">{c.progress}%</span>
                </div>
              </div>

              <div className="progress-bar mb-4">
                <div className="progress-bar-fill" style={{ width: `${c.progress}%` }} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {c.pillars.map((p) => (
                  <div key={p.name} className="p-3 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                    <div className="text-xs text-[#6B7280] mb-1">{p.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{p.completed}/{p.total}</span>
                      <span className="text-gradient text-xs">{p.mastered} mastered</span>
                    </div>
                    <div className="progress-bar mt-2">
                      <div className="progress-bar-fill" style={{ width: `${(p.completed / p.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t border-[rgba(250,248,245,0.06)]">
                <Link
                  href="/speaking"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[rgba(16,185,129,0.1)] to-[rgba(5,150,105,0.08)] border border-[rgba(16,185,129,0.2)] text-[#10B981] text-xs font-medium hover:border-[rgba(16,185,129,0.35)] transition-all"
                >
                  <Mic size={12} />
                  Continue Speaking Practice
                </Link>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-xs text-[#6B7280] hover:text-[#FAF8F5] transition-all">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="rounded-xl border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.03)] p-6">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center">
            <Trophy size={12} className="text-white" />
          </div>
          Speak Until Mastered — Language Progress
        </h3>
        <div className="space-y-2">
          {milestones.map((item) => (
            <div key={item.name} className="flex items-center justify-between p-2.5 rounded-lg bg-[rgba(250,248,245,0.02)]">
              <div className="flex items-center gap-2">
                <span className="text-sm">{item.name}</span>
                <span className="text-xs text-[#6B7280]">({item.language})</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    item.status === 'Mastered'
                      ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981] border-[rgba(16,185,129,0.2)]'
                      : item.status === 'In Progress' || item.status === 'Cycle 2'
                      ? 'bg-[rgba(245,158,11,0.1)] text-[#F59E0B] border-[rgba(245,158,11,0.2)]'
                      : 'bg-[rgba(239,68,68,0.1)] text-[#ef4444] border-[rgba(239,68,68,0.2)]'
                  }`}
                >
                  {item.status}
                </span>
                <span className="text-xs font-medium">{item.score}%</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
