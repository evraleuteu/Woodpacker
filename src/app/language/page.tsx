'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { BookOpen, Mic, Crosshair, Upload, RefreshCw, Headphones, Diamond, BarChart3, Flame, Trophy } from 'lucide-react'

const skillAreas = [
  { name: 'Vocabulary', icon: BookOpen, count: 342, mastered: 156, color: 'from-[#059669] to-[#10B981]' },
  { name: 'Grammar', icon: BookOpen, count: 128, mastered: 64, color: 'from-[#10B981] to-[#34D399]' },
  { name: 'Reading', icon: BookOpen, count: 48, mastered: 22, color: 'from-[#059669] to-[#10B981]' },
  { name: 'Listening', icon: Headphones, count: 36, mastered: 18, color: 'from-[#D97706] to-[#F59E0B]' },
  { name: 'Patterns', icon: Diamond, count: 89, mastered: 23, color: 'from-[#10B981] to-[#34D399]' },
]

const recentDecks = [
  { name: 'Food & Restaurant', type: 'Vocabulary', items: 42, progress: 75 },
  { name: 'Dative Case', type: 'Grammar', items: 24, progress: 60 },
  { name: 'A1 Dialogues', type: 'Reading', items: 12, progress: 90 },
  { name: 'Ich möchte...', type: 'Pattern', items: 8, progress: 45 },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function LanguagePage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8 max-w-6xl mx-auto"
    >
      <motion.div variants={itemVariants} className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center">
            <BookOpen size={16} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Language Mastery</h1>
        </div>
        <p className="text-[#A8A29E] text-sm">
          Understand the language. Track your progress across all skill areas.
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-5 gap-4 mb-8">
        {skillAreas.map((area) => (
          <div key={area.name} className="glass-card rounded-xl p-5 text-center">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${area.color} flex items-center justify-center mx-auto mb-3`}>
              <area.icon size={16} className="text-white" />
            </div>
            <h3 className="font-semibold text-sm">{area.name}</h3>
            <div className="text-xs text-[#A8A29E] mt-1">{area.count} items</div>
            <div className="progress-bar mt-3">
              <div className="progress-bar-fill" style={{ width: `${(area.mastered / area.count) * 100}%` }} />
            </div>
            <div className="text-xs text-gradient mt-1">{area.mastered} mastered</div>
          </div>
        ))}
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-xl p-6">
          <h2 className="font-semibold text-sm mb-4">Active Decks</h2>
          <div className="space-y-3">
            {recentDecks.map((deck) => (
              <div key={deck.name} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(250,248,245,0.02)]">
                <div>
                  <div className="text-sm font-medium">{deck.name}</div>
                  <div className="text-xs text-[#6B7280]">{deck.type} &middot; {deck.items} items</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${deck.progress}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gradient">{deck.progress}%</span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/materials" className="block text-center text-xs text-gradient hover:opacity-80 mt-4">
            View all language materials →
          </Link>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h2 className="font-semibold text-sm mb-4">Learning Progress</h2>
          <div className="space-y-3">
            {[
              { label: 'Total Items Learned', value: 423, change: '+28 this week', icon: Trophy, color: 'from-[#059669] to-[#10B981]' },
              { label: 'Mastery Rate', value: '68%', change: '+5% this week', icon: BarChart3, color: 'from-[#10B981] to-[#34D399]' },
              { label: 'Active Materials', value: 3, change: 'German, French, Spanish', icon: BookOpen, color: 'from-[#059669] to-[#10B981]' },
              { label: 'Study Streak', value: '5 days', change: 'Best: 12 days', icon: Flame, color: 'from-[#D97706] to-[#F59E0B]' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(250,248,245,0.02)]">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                    <s.icon size={12} className="text-white" />
                  </div>
                  <span className="text-sm">{s.label}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gradient">{s.value}</div>
                  <div className="text-[10px] text-[#6B7280]">{s.change}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h2 className="font-semibold text-sm mb-5">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          <Link
            href="/upload"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <Upload size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Upload Material</div>
          </Link>
          <Link
            href="/speaking"
            className="group p-4 rounded-xl bg-gradient-to-br from-[rgba(16,185,129,0.08)] to-[rgba(5,150,105,0.05)] border border-[rgba(16,185,129,0.15)] text-center transition-all hover:border-[rgba(16,185,129,0.3)] ai-glow-hover"
          >
            <Mic size={18} className="mx-auto mb-2 text-[#10B981]" />
            <div className="text-xs font-medium">Speaking Practice</div>
          </Link>
          <Link
            href="/accent"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <Crosshair size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Accent Training</div>
          </Link>
          <Link
            href="/cycles"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <RefreshCw size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Review Cycles</div>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  )
}
