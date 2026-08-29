'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Mic, Award, TrendingUp, Target, Headphones, Play, Check, Clock, Flame, BarChart3, Sparkles } from 'lucide-react'
import { useCourse } from '@/lib/useCourse'

export default function SpeakingMasteryPage() {
  const course = useCourse()

  if (!course) {
    return (
      <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
        <div className="rounded-[24px] border border-dashed border-[#D1D5DB] bg-white p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-4">
            <Mic size={22} className="text-[#1F7A4C]" />
          </div>
          <h2 className="text-lg font-bold text-[#111827]">No speaking material yet</h2>
          <p className="text-sm text-[#6B7280] mt-1">Upload a textbook with dialogues to generate speaking sessions.</p>
          <Link href="/upload" className="mt-6 inline-flex px-6 py-2.5 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold">Upload now</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
            Speaking Mastery
          </h1>
          <p className="text-sm text-[#6B7280] mt-1 max-w-xl leading-relaxed">
            Modern coaching experience — pronunciation, fluency and grammar scored after every session. Daily challenges keep momentum.
          </p>
        </div>
        <Link href="/cycles" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]">
          <Target size={14} className="text-[#1F7A4C]" /> Daily challenges
        </Link>
      </div>

      {/* Scores */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Speaking score', value: '78', sub: '/100', desc: 'Overall', icon: Award, color: '#1F7A4C', bg: '#F0FDF4' },
          { label: 'Pronunciation', value: '84', sub: '%', desc: '+4% this week', icon: Mic, color: '#2FBF71', bg: '#F0FDF4' },
          { label: 'Fluency', value: '68', sub: '%', desc: 'Words per minute', icon: TrendingUp, color: '#F4B942', bg: '#FFFBEB' },
          { label: 'Grammar', value: '74', sub: '%', desc: 'Pattern accuracy', icon: Target, color: '#6B7280', bg: '#F9FAFB' },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border" style={{ background: s.bg, color: s.color, borderColor: s.color + '20' }}>
              <s.icon size={16} />
            </div>
            <div className="text-xs font-semibold tracking-wide uppercase text-[#6B7280] mt-3">{s.label}</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)', color: s.color }}>
                {s.value}
              </span>
              <span className="text-sm font-bold text-[#9CA3AF]">{s.sub}</span>
            </div>
            <div className="text-xs text-[#6B7280]">{s.desc}</div>
            <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden mt-3">
              <div className="h-full rounded-full" style={{ width: `${Number(s.value)}%`, background: s.color }} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Daily challenges */}
      <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
            <Flame size={14} className="text-[#F4B942]" /> Daily challenges
          </h3>
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] font-semibold">3 / 5 completed</span>
        </div>
        <div className="grid md:grid-cols-5 gap-3">
          {[
            { title: 'Shadowing', desc: 'Repeat after native speaker', done: true },
            { title: 'Roleplay', desc: 'Restaurant dialogue', done: true },
            { title: 'Recall', desc: 'Say 10 words from memory', done: true },
            { title: 'Pattern drill', desc: '“Ich hätte gern …”', done: false },
            { title: 'Free speak', desc: '60s monologue', done: false },
          ].map((c) => (
            <div key={c.title} className={`rounded-2xl border p-4 ${c.done ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FAFBFC] border-[#E5E7EB]'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${c.done ? 'bg-[#1F7A4C] text-white' : 'bg-white border border-[#E5E7EB] text-[#9CA3AF]'}`}>
                {c.done ? <Check size={12} strokeWidth={3} /> : <Play size={10} />}
              </div>
              <div className="text-xs font-bold text-[#111827] mt-3">{c.title}</div>
              <div className="text-[11px] text-[#6B7280] leading-snug">{c.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-[#6B7280]">
          <Clock size={12} /> Next challenge unlocks in 6 hours · Streak bonus +20 XP
        </div>
      </div>

      {/* Practice */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[20px] border border-[#E5E7EB] bg-white p-5">
          <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2 mb-3">
            <Headphones size={14} className="text-[#1F7A4C]" /> Voice practice
          </h3>
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-5 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1F7A4C] flex items-center justify-center mx-auto mb-3">
              <Mic size={22} className="text-white" />
            </div>
            <div className="text-sm font-semibold text-[#111827]">“Guten Morgen, ich hätte gern ein Brot, bitte.”</div>
            <div className="text-xs text-[#6B7280] mt-1">Listen, then speak · Tap to record</div>
            <div className="mt-4 flex items-center justify-center gap-1">
              {[14, 28, 20, 36, 24, 30, 18, 26, 22].map((h, i) => (
                <div key={i} className="w-1 rounded-full bg-[#1F7A4C]" style={{ height: `${h}px`, opacity: 0.3 + (i / 9) * 0.7 }} />
              ))}
            </div>
            <button className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold hover:bg-[#16643D]">
              <Mic size={14} /> Start recording
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-[#FAFBFC] border border-[#E5E7EB] p-3 text-center">
              <div className="text-xs text-[#6B7280]">Accuracy</div>
              <div className="text-sm font-bold text-[#1F7A4C]">92%</div>
            </div>
            <div className="rounded-xl bg-[#FAFBFC] border border-[#E5E7EB] p-3 text-center">
              <div className="text-xs text-[#6B7280]">Fluency</div>
              <div className="text-sm font-bold text-[#111827]">~108 wpm</div>
            </div>
            <div className="rounded-xl bg-[#FAFBFC] border border-[#E5E7EB] p-3 text-center">
              <div className="text-xs text-[#6B7280]">Time</div>
              <div className="text-sm font-bold text-[#111827]">3.2s</div>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
          <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-[#1F7A4C]" /> Sessions this week
          </h3>
          <div className="space-y-2">
            {[
              { day: 'Mon', min: 12, score: 82 },
              { day: 'Tue', min: 18, score: 78 },
              { day: 'Wed', min: 8, score: 85 },
              { day: 'Today', min: 14, score: 88, active: true },
            ].map((r) => (
              <div key={r.day} className={`flex items-center gap-3 p-3 rounded-xl border ${r.active ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FAFBFC] border-[#F3F4F6]'}`}>
                <span className="text-xs font-bold w-12">{r.day}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white border border-[#E5E7EB] overflow-hidden">
                  <div className="h-full bg-[#1F7A4C] rounded-full" style={{ width: `${(r.min / 20) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-[#1F7A4C]">{r.min}m</span>
                <span className="text-xs text-[#6B7280]">{r.score}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-[#1F7A4C] p-4 text-white">
            <div className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles size={12} /> Tip
            </div>
            <div className="text-xs leading-relaxed text-white/85 mt-1">Practice shadowing 5 min daily to improve intonation fastest.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
