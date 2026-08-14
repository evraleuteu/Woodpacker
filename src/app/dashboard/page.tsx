'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Upload,
  BookOpen,
  Mic,
  BarChart3,
  Flame,
  Diamond,
  Play,
  RefreshCw,
  Library,
  Trophy,
  Target,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'

const dailyMission = {
  title: "Today's Mission",
  minutesRemaining: 15,
  progress: 42,
  items: [
    { label: 'Vocabulary Review', done: true },
    { label: 'Grammar Drill — Dative Case', done: false },
    { label: 'Audio Recall Practice', done: false },
    { label: 'Pattern Mastery — "Ich möchte"', done: false },
  ],
}

const continueLearning = {
  title: 'German Cases — Lesson 8',
  subtitle: 'Continue where you left off',
  progress: 62,
  type: 'Grammar',
}

const masteryScores = [
  { label: 'Vocabulary', score: 72, color: 'from-[#059669] to-[#10B981]' },
  { label: 'Grammar', score: 58, color: 'from-[#10B981] to-[#34D399]' },
  { label: 'Speaking', score: 45, color: 'from-[#D97706] to-[#F59E0B]' },
  { label: 'Listening', score: 63, color: 'from-[#059669] to-[#10B981]' },
]

const weeklyData = [
  { day: 'Mon', minutes: 25 },
  { day: 'Tue', minutes: 40 },
  { day: 'Wed', minutes: 15 },
  { day: 'Thu', minutes: 60 },
  { day: 'Fri', minutes: 35 },
  { day: 'Sat', minutes: 0 },
  { day: 'Sun', minutes: 0 },
]

const recommendedSession = {
  title: 'Dative Case Patterns',
  desc: 'Based on your recent mistakes',
  icon: Target,
  action: 'Practice Now',
}

const recentActivity = [
  { type: 'speaking', label: 'Audio Recall — Restaurant', score: 88, time: '5 min ago', xp: 25 },
  { type: 'vocabulary', label: 'Vocabulary Review — Food', score: 92, time: '15 min ago', xp: 15 },
  { type: 'grammar', label: 'Grammar Drill — Dative Case', score: 75, time: '1 hour ago', xp: 20 },
  { type: 'pattern', label: 'Pattern Mastery — "Ich möchte..."', score: 95, time: '2 hours ago', xp: 30 },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function DashboardPage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8 max-w-6xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Good morning, Learner</h1>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] text-xs text-[#F59E0B]">
              <Flame size={12} className="animate-streak-flame" />
              27 Day Streak
            </span>
          </div>
          <p className="text-[#A8A29E] text-sm">You&apos;re on fire. Keep your streak alive.</p>
        </div>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#059669] to-[#10B981] text-white text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.97]"
        >
          <Upload size={14} />
          Upload Textbook
        </Link>
      </motion.div>

      {/* Top row: Daily Goal + Continue Learning + Streak */}
      <motion.div variants={itemVariants} className="grid grid-cols-12 gap-4 mb-6">
        {/* Daily Mission */}
        <div className="col-span-4 glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-[#10B981]" />
              <h2 className="font-semibold text-sm">{dailyMission.title}</h2>
            </div>
            <span className="text-xs text-[#6B7280]">{dailyMission.progress}%</span>
          </div>
          <div className="progress-bar mb-4 h-2">
            <div className="progress-bar-fill" style={{ width: `${dailyMission.progress}%` }} />
          </div>
          <div className="space-y-2">
            {dailyMission.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {item.done ? (
                  <CheckCircle2 size={14} className="text-[#10B981] shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-[rgba(250,248,245,0.15)] shrink-0" />
                )}
                <span className={item.done ? 'text-[#6B7280] line-through' : 'text-[#FAF8F5]'}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-[rgba(250,248,245,0.06)] text-xs text-[#6B7280]">
            <Clock size={12} />
            {dailyMission.minutesRemaining} min remaining
          </div>
        </div>

        {/* Continue Learning Hero */}
        <div className="col-span-5 glass-card rounded-xl p-5 relative overflow-hidden group cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(16,185,129,0.08)] to-transparent pointer-events-none" />
          <div className="relative">
            <div className="text-xs text-[#6B7280] mb-1 flex items-center gap-2">
              <Play size={10} className="text-[#10B981]" />
              Continue Learning
            </div>
            <h3 className="text-lg font-bold mb-1">{continueLearning.title}</h3>
            <p className="text-sm text-[#A8A29E] mb-4">{continueLearning.subtitle}</p>
            <div className="flex items-center gap-4">
              <div className="flex-1 progress-bar h-2">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${continueLearning.progress}%` }}
                />
              </div>
              <span className="text-sm font-bold text-gradient">{continueLearning.progress}%</span>
            </div>
            <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#059669] to-[#10B981] text-white text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              Resume
              <Play size={14} />
            </button>
          </div>
        </div>

        {/* Streak + XP */}
        <div className="col-span-3 glass-card rounded-xl p-5 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D97706] to-[#F59E0B] flex items-center justify-center mb-3 animate-streak-flame">
            <Flame size={24} className="text-white" />
          </div>
          <div className="text-3xl font-bold text-gradient-gold">27</div>
          <div className="text-sm text-[#6B7280]">Day Streak</div>
          <div className="mt-3 flex items-center gap-1 text-xs text-[#F59E0B] bg-[rgba(245,158,11,0.08)] px-3 py-1 rounded-full">
            <Sparkles size={10} />
            +50 XP Daily Bonus
          </div>
        </div>
      </motion.div>

      {/* Second row: Mastery Scores + Weekly Progress */}
      <motion.div variants={itemVariants} className="grid grid-cols-12 gap-4 mb-6">
        {/* Mastery Scores */}
        <div className="col-span-4 glass-card rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Trophy size={14} className="text-[#10B981]" />
            Mastery Score
          </h2>
          <div className="space-y-3">
            {masteryScores.map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-[#A8A29E]">{m.label}</span>
                  <span className="font-semibold">{m.score}%</span>
                </div>
                <div className="progress-bar h-1.5">
                  <div
                    className={`progress-bar-fill`}
                    style={{ width: `${m.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[rgba(250,248,245,0.06)]">
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>Overall Mastery</span>
              <span className="text-gradient font-bold text-sm">59%</span>
            </div>
          </div>
        </div>

        {/* Weekly Progress Chart */}
        <div className="col-span-5 glass-card rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-[#10B981]" />
            Weekly Progress
          </h2>
          <div className="flex items-end justify-between gap-2 h-32">
            {weeklyData.map((d) => (
              <div key={d.day} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full rounded-md bg-gradient-to-t from-[#059669] to-[#10B981] transition-all duration-500"
                  style={{
                    height: `${(d.minutes / 60) * 100}%`,
                    opacity: d.minutes > 0 ? 1 : 0.2,
                  }}
                />
                <span className="text-[10px] text-[#6B7280]">{d.day}</span>
                {d.minutes > 0 && (
                  <span className="text-[10px] text-[#A8A29E]">{d.minutes}m</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[rgba(250,248,245,0.06)] flex items-center justify-between text-xs text-[#6B7280]">
            <span>Total: 175 min this week</span>
            <span className="text-[#10B981]">+15% vs last week</span>
          </div>
        </div>

        {/* Recommended Session */}
        <div className="col-span-3 glass-card rounded-xl p-5 bg-gradient-to-br from-[rgba(16,185,129,0.04)] to-transparent border-[rgba(16,185,129,0.15)]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-[#F59E0B]" />
            <h2 className="font-semibold text-sm">AI Recommended</h2>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D97706] to-[#F59E0B] flex items-center justify-center mb-3">
            <Target size={18} className="text-white" />
          </div>
          <h3 className="font-semibold mb-1">{recommendedSession.title}</h3>
          <p className="text-xs text-[#A8A29E] mb-4">{recommendedSession.desc}</p>
          <Link
            href="/speaking"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#10B981] hover:text-[#34D399] transition-colors"
          >
            {recommendedSession.action}
            <ArrowRight size={12} />
          </Link>
        </div>
      </motion.div>

      {/* Third row: Recent Activity */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Recent Activity</h2>
          <span className="text-xs text-[#6B7280]">Today</span>
        </div>
        <div className="space-y-2">
          {recentActivity.map((a, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[rgba(250,248,245,0.02)]">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
                  a.type === 'speaking' ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981]' :
                  a.type === 'vocabulary' ? 'bg-[rgba(5,150,105,0.1)] text-[#059669]' :
                  a.type === 'grammar' ? 'bg-[rgba(245,158,11,0.1)] text-[#F59E0B]' :
                  'bg-[rgba(16,185,129,0.1)] text-[#10B981]'
                }`}>
                  {a.type === 'speaking' ? <Mic size={12} /> : a.type === 'vocabulary' ? <BookOpen size={12} /> : a.type === 'grammar' ? <BookOpen size={12} /> : <Diamond size={12} />}
                </div>
                <div>
                  <div className="text-sm">{a.label}</div>
                  <div className="text-xs text-[#6B7280]">{a.time}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#10B981]">+{a.xp} XP</span>
                <span className="text-sm font-medium text-gradient">{a.score}%</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
        <h2 className="font-semibold text-sm mb-5">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          <Link
            href="/speaking"
            className="group p-4 rounded-xl bg-gradient-to-br from-[rgba(16,185,129,0.08)] to-[rgba(5,150,105,0.05)] border border-[rgba(16,185,129,0.15)] text-center transition-all hover:border-[rgba(16,185,129,0.3)] ai-glow-hover"
          >
            <Mic size={18} className="mx-auto mb-2 text-[#10B981]" />
            <div className="text-xs font-medium">Speaking Practice</div>
          </Link>
          <Link
            href="/cycles"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <RefreshCw size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Review Cycles</div>
          </Link>
          <Link
            href="/upload"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <Upload size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Upload More</div>
          </Link>
          <Link
            href="/materials"
            className="group p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-center transition-all hover:bg-[rgba(250,248,245,0.04)] hover:border-[rgba(16,185,129,0.2)]"
          >
            <Library size={18} className="mx-auto mb-2 text-[#6B7280] group-hover:text-[#10B981] transition-colors" />
            <div className="text-xs font-medium">Library</div>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  )
}
