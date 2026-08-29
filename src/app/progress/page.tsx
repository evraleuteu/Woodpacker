'use client'

import { motion } from 'framer-motion'
import { TrendingUp, Clock, BookOpen, Mic, Award, Target, Calendar, Flame, BarChart3, ArrowRight } from 'lucide-react'
import { useCourse } from '@/lib/useCourse'
import { useGameStats } from '@/lib/useGameStats'
import Link from 'next/link'
import { useMemo } from 'react'
import { buildPracticePlan } from '@/lib/plan'

export default function ProgressPage() {
  const course = useCourse()
  const { stats } = useGameStats()
  const plan = useMemo(() => (course ? buildPracticePlan(course) : null), [course])

  if (!course || !plan) {
    return (
      <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
        <div className="rounded-[24px] border border-dashed border-[#D1D5DB] bg-white p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={22} className="text-[#1F7A4C]" />
          </div>
          <h2 className="text-lg font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
            No progress yet
          </h2>
          <p className="text-sm text-[#6B7280] mt-1">Upload materials and start practicing to see analytics.</p>
          <Link href="/upload" className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold">
            Upload materials <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  const totalItems = plan.items.length
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']
  const velocity = [12, 18, 24, 22, 28, 34, 31, 38]
  const retention = [62, 68, 74, 71, 78, 84, 82, 91]
  const vocab = [80, 190, 340, 520, 720, 980, 1180, 1240]

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
            Progress Analytics
          </h1>
          <p className="text-sm text-[#6B7280] mt-1 max-w-xl">Enterprise-grade insights: learning velocity, retention, vocabulary growth, speaking improvement & time invested.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-xs font-semibold text-[#1F7A4C] shrink-0">
          <Award size={12} /> Live tracking
        </span>
      </div>

      {/* KPI */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Learning velocity', value: '38 items/week', sub: '+12% vs last week', icon: TrendingUp, color: '#1F7A4C', bg: '#F0FDF4' },
          { label: 'Retention rate', value: '91%', sub: 'Adaptive repetition', icon: Target, color: '#2FBF71', bg: '#F0FDF4' },
          { label: 'Vocabulary growth', value: '1,240 words', sub: 'Across all lessons', icon: BookOpen, color: '#B7791F', bg: '#FFFBEB' },
          { label: 'Time invested', value: '18.4 hours', sub: `~${Math.ceil(totalItems * 1.2)} min total`, icon: Clock, color: '#6B7280', bg: '#F9FAFB' },
        ].map((k) => (
          <div key={k.label} className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border" style={{ background: k.bg, color: k.color, borderColor: k.color + '20' }}>
              <k.icon size={16} />
            </div>
            <div className="text-xs font-semibold tracking-wide uppercase text-[#6B7280] mt-3">{k.label}</div>
            <div className="text-lg font-bold tracking-tight text-[#111827] mt-1" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {k.value}
            </div>
            <div className="text-xs text-[#6B7280]">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Velocity */}
        <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <TrendingUp size={14} className="text-[#1F7A4C]" /> Learning velocity
            </h3>
            <span className="text-xs px-2 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C] font-medium">Items / week</span>
          </div>
          <div className="flex items-end gap-2 h-36 px-1">
            {velocity.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] font-bold text-[#1F7A4C]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {v}
                </div>
                <div className="w-full rounded-t-lg bg-[#1F7A4C] hover:bg-[#16643D] transition-colors" style={{ height: `${(v / 40) * 100}%`, minHeight: '8px' }} />
                <span className="text-[10px] text-[#6B7280]">{weeks[i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-[#6B7280] flex items-center gap-1.5">
            <Flame size={12} className="text-[#F4B942]" /> {stats.streak} day streak · {stats.xp} XP earned
          </div>
        </div>

        {/* Retention */}
        <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <Target size={14} className="text-[#2FBF71]" /> Retention rate
            </h3>
            <span className="text-xs px-2 py-1 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] font-medium">Spaced repetition</span>
          </div>
          <div className="h-36 relative px-1">
            <svg viewBox="0 0 320 120" className="w-full h-full">
              <polyline
                fill="none"
                stroke="#1F7A4C"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={retention.map((v, i) => `${(i / 7) * 300 + 10},${110 - (v / 100) * 90}`).join(' ')}
              />
              {retention.map((v, i) => (
                <circle key={i} cx={(i / 7) * 300 + 10} cy={110 - (v / 100) * 90} r={4} fill="#1F7A4C" stroke="white" strokeWidth={2} />
              ))}
            </svg>
            <div className="flex justify-between text-[10px] text-[#9CA3AF] px-2 -mt-2">
              {weeks.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
          </div>
          <div className="mt-2 text-xs text-[#6B7280]">From 62% → 91% — Woodpecker cycles keep knowledge alive.</div>
        </div>

        {/* Vocab growth */}
        <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <BookOpen size={14} className="text-[#B7791F]" /> Vocabulary growth
            </h3>
            <span className="text-xs font-bold text-[#B7791F]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              +1,240
            </span>
          </div>
          <div className="flex items-end gap-1.5 h-36 px-1">
            {vocab.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-lg bg-[#F4B942]" style={{ height: `${(v / 1240) * 100}%`, minHeight: '6px' }} />
                <span className="text-[10px] text-[#6B7280]">{weeks[i]}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-[#6B7280] mt-2">{vocab[vocab.length - 1]} unique words retained — not just seen.</div>
        </div>

        {/* Speaking improvement + time */}
        <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
          <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2 mb-4">
            <Mic size={14} className="text-[#1F7A4C]" /> Speaking & time
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Pronunciation', value: '82%', color: '#1F7A4C' },
              { label: 'Fluency', value: '68%', color: '#2FBF71' },
              { label: 'Grammar', value: '74%', color: '#F4B942' },
              { label: 'Hours', value: '18.4h', color: '#6B7280' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-[#FAFBFC] border border-[#E5E7EB] p-3">
                <div className="text-[11px] font-semibold tracking-wide uppercase text-[#6B7280]">{s.label}</div>
                <div className="text-lg font-bold text-[#111827] mt-1" style={{ fontFamily: 'var(--font-space-grotesk)', color: s.color }}>
                  {s.value}
                </div>
                <div className="h-1 rounded-full bg-[#E5E7EB] overflow-hidden mt-2">
                  <div className="h-full rounded-full" style={{ width: s.label === 'Hours' ? '68%' : s.value, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] p-3 flex items-center gap-2">
            <Calendar size={14} className="text-[#1F7A4C] shrink-0" />
            <span className="text-xs text-[#16643D]">Next speaking challenge in 4 hours — daily coaching</span>
          </div>
        </div>
      </div>

      {/* Time invested detail */}
      <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
        <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2 mb-3">
          <Clock size={14} className="text-[#6B7280]" /> Time invested — by dimension
        </h3>
        <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Vocabulary', h: '6.2h' },
            { label: 'Grammar', h: '4.1h' },
            { label: 'Listening', h: '3.8h' },
            { label: 'Reading', h: '2.4h' },
            { label: 'Speaking', h: '1.6h' },
            { label: 'Review', h: '0.3h' },
          ].map((t) => (
            <div key={t.label} className="rounded-xl bg-[#FAFBFC] border border-[#E5E7EB] p-3 text-center">
              <div className="text-xs font-medium text-[#6B7280]">{t.label}</div>
              <div className="text-sm font-bold text-[#111827] mt-1" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {t.h}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
