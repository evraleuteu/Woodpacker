'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Play,
  BookOpen,
  Mic,
  Brain,
  Check,
  Users,
  Clock,
  BadgeCheck,
  Sparkles,
  Upload,
  Search,
  Layers,
  BarChart3,
  MessageCircle,
  FileText,
  ScanText,
  Zap,
  Target,
  Headphones,
  PenLine,
  GraduationCap,
  ChevronDown,
  Star,
  TrendingUp,
  ShieldCheck,
  Globe,
} from 'lucide-react'
import LandingHeader from '@/components/landing/LandingHeader'

// Stats
const stats = [
  { value: '12,400+', label: 'Active learners', sub: 'Growing every week' },
  { value: '280k+', label: 'Hours learned', sub: 'Adaptive practice time' },
  { value: '1.2M+', label: 'Exercises completed', sub: 'From real textbooks' },
  { value: '4.8/5', label: 'Learner rating', sub: 'Average satisfaction' },
]

// Problem cards
const problems = [
  {
    title: 'Forgetting vocabulary',
    desc: 'You memorize words, then lose them a week later. No system keeps them alive.',
    icon: Brain,
    color: '#1F7A4C',
    bg: '#F0FDF4',
  },
  {
    title: 'Passive learning',
    desc: 'Watching videos and reading notes feels productive — but you still cannot speak.',
    icon: BookOpen,
    color: '#2FBF71',
    bg: '#F0FDF4',
  },
  {
    title: 'Courses without fluency',
    desc: 'You finish a textbook and still translate every sentence in your head.',
    icon: GraduationCap,
    color: '#B7791F',
    bg: '#FFFBEB',
  },
  {
    title: 'Disconnected resources',
    desc: 'Books, PDFs, audio and exercises live in different places with no connection.',
    icon: Layers,
    color: '#6B7280',
    bg: '#F9FAFB',
  },
]

// Solution steps
const solutionSteps = [
  {
    step: '01',
    title: 'Upload',
    desc: 'Books, PDFs, audio, video, exercises — any format, any folder structure.',
    items: ['PDF & EPUB', 'Audio & Video', 'Exercises & Notes'],
    icon: Upload,
  },
  {
    step: '02',
    title: 'AI Analysis',
    desc: 'Woodpacker extracts knowledge, maps concepts and detects exercises automatically.',
    items: ['Content extraction', 'Knowledge mapping', 'Context linking'],
    icon: Search,
  },
  {
    step: '03',
    title: 'Mastery System',
    desc: 'Every lesson becomes Speaking, Listening, Reading and Vocabulary mastery.',
    items: ['Speaking', 'Listening', 'Reading & Vocab'],
    icon: Target,
  },
  {
    step: '04',
    title: 'Long-Term Retention',
    desc: 'Woodpecker repetition engine schedules reviews until recall is automatic.',
    items: ['Adaptive cycles', '30 → 1 day spacing', 'Until mastered'],
    icon: TrendingUp,
  },
]

// Features
const features = [
  {
    title: 'Book Analyzer',
    desc: 'Automatically understands uploaded learning materials and rebuilds course structure in optimal learning order.',
    icon: ScanText,
    accent: '#1F7A4C',
    bg: '#F0FDF4',
  },
  {
    title: 'Speaking Mastery Engine',
    desc: 'Transforms passive knowledge into active speaking ability with voice recall, shadowing and roleplay.',
    icon: Mic,
    accent: '#2FBF71',
    bg: '#F0FDF4',
  },
  {
    title: 'Smart Exercise Extraction',
    desc: 'Detects exercises from books automatically — gap fills, translations, listening questions, pattern drills.',
    icon: FileText,
    accent: '#B7791F',
    bg: '#FFFBEB',
  },
  {
    title: 'Adaptive Repetition',
    desc: 'Schedules reviews scientifically. Same items repeat 30, 15, 7, 3, then 1 day apart until mastered.',
    icon: Zap,
    accent: '#1F7A4C',
    bg: '#F0FDF4',
  },
  {
    title: 'Progress Analytics',
    desc: 'Track learning velocity, retention rate, vocabulary growth and speaking improvement with enterprise-grade charts.',
    icon: BarChart3,
    accent: '#6B7280',
    bg: '#F9FAFB',
  },
  {
    title: 'AI Tutor',
    desc: 'Personalized guidance explains grammar, corrects patterns and creates new practice from your own material.',
    icon: MessageCircle,
    accent: '#2FBF71',
    bg: '#F0FDF4',
  },
]

// Showcase tabs
const showcaseTabs = [
  { id: 'upload', label: 'Upload flow', desc: 'Drag & drop folders' },
  { id: 'extraction', label: 'Extraction', desc: 'AI knowledge mapping' },
  { id: 'exercises', label: 'Exercises', desc: 'Auto-generated practice' },
  { id: 'speaking', label: 'Speaking', desc: 'Voice mastery' },
  { id: 'dashboard', label: 'Dashboard', desc: 'Mastery overview' },
]

// FAQ
const faqs = [
  {
    q: 'What kind of materials can I upload?',
    a: 'PDF textbooks, EPUB, DOCX, PPTX, TXT, MP3, WAV, M4A, MP4 and images. You can upload an entire folder — Woodpacker scans subfolders recursively and connects lessons, audio, exercises and solutions automatically.',
  },
  {
    q: 'How is this different from Duolingo or Anki?',
    a: 'Duolingo teaches its own content; Anki requires you to create cards. Woodpacker transforms your own books and courses into a complete mastery system — vocabulary, grammar, reading, listening and speaking — and repeats them until recall is automatic.',
  },
  {
    q: 'Do I need to create exercises myself?',
    a: 'No. Woodpacker detects exercises from your books, extracts transcripts and passages, and generates speaking drills, listening questions, reading tasks and pattern exercises from your own material.',
  },
  {
    q: 'What is the Woodpecker repetition method?',
    a: 'Same items are practiced 5 times with shrinking intervals: 30, 15, 7, 3, then 1 day. Each cycle reduces support — from audio + transcript to no hints — until you speak without translating.',
  },
  {
    q: 'Can I track speaking and pronunciation progress?',
    a: 'Yes. Speaking sessions include pronunciation, fluency and grammar scoring with daily challenges and streaks. Progress analytics show learning velocity, retention and vocabulary growth over time.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes. Start free and explore the mastery engine with your own materials. Upgrade to Pro for unlimited materials, advanced analytics and team features.',
  },
]

export default function LandingContent() {
  const [activeTab, setActiveTab] = useState('upload')
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <LandingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-[#FAFBFC] pointer-events-none" />
        <div className="max-w-[1200px] mx-auto px-6 pt-12 md:pt-20 pb-12 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-left"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C] text-xs font-semibold mb-6">
                <span className="w-2 h-2 rounded-full bg-[#1F7A4C] animate-pulse" />
                Trusted by 12,400+ language learners
                <span className="hidden sm:inline-flex items-center gap-1 ml-1 text-[#6B7280]">
                  <Star size={12} className="text-[#F4B942] fill-[#F4B942]" /> 4.8/5 rating
                </span>
              </div>

              <h1 className="text-[38px] md:text-[52px] font-bold leading-[0.95] tracking-[-0.03em] text-[#111827] mb-4" style={{ fontFamily: 'var(--font-manrope)' }}>
                Master Any Language
                <br />
                <span className="text-[#1F7A4C]">Through Intelligent</span>
                <br />
                Repetition
              </h1>

              <p className="text-[17px] leading-relaxed text-[#6B7280] max-w-[560px] mb-8">
                Upload books, courses, PDFs, audio lessons, and exercises. Woodpacker automatically transforms them into a personalized{' '}
                <span className="font-semibold text-[#111827]">speaking, listening, reading, and vocabulary mastery system</span>.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#1F7A4C] text-white font-semibold shadow-sm hover:bg-[#16643D] hover:shadow-md hover:-translate-y-px transition-all"
                >
                  Start Learning Free
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="#showcase"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white border border-[#E5E7EB] text-[#111827] font-semibold hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-colors"
                >
                  <Play size={16} className="text-[#1F7A4C]" />
                  Watch Demo
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7280]">
                <span className="flex items-center gap-1.5">
                  <Check size={14} className="text-[#1F7A4C]" /> No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <Check size={14} className="text-[#1F7A4C]" /> Cancel anytime
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#1F7A4C]" /> Premium educational quality
                </span>
              </div>

              {/* Mini trust row */}
              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-[#F3F4F6]">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-white bg-[#E5E7EB] flex items-center justify-center text-[11px] font-bold text-[#6B7280]"
                    >
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-[#111827]">Loved by learners in 18 languages</div>
                  <div className="text-[#6B7280]">German, French, Spanish, Italian, Japanese, Chinese & more</div>
                </div>
              </div>
            </motion.div>

            {/* Right – Product mockup */}
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative lg:pl-6"
            >
              {/* Window */}
              <div className="rounded-[24px] bg-white border border-[#E5E7EB] shadow-[0_12px_40px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden">
                {/* Window bar */}
                <div className="h-10 flex items-center justify-between px-4 border-b border-[#F3F4F6] bg-[#FAFBFC]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#FECACA] border border-[#FCA5A5]" />
                    <span className="w-3 h-3 rounded-full bg-[#FDE68A] border border-[#FCD34D]" />
                    <span className="w-3 h-3 rounded-full bg-[#BBF7D0] border border-[#86EFAC]" />
                  </div>
                  <div className="text-xs font-medium text-[#6B7280] hidden sm:block">Woodpacker — Mastery Dashboard</div>
                  <div className="w-16" />
                </div>

                {/* Dashboard preview */}
                <div className="p-5 bg-white space-y-4">
                  {/* Top metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Mastery Score', value: '78%', sub: '+12% this week', color: '#1F7A4C' },
                      { label: 'Current Streak', value: '14 days', sub: 'Personal best', color: '#F4B942' },
                      { label: 'Reviews due', value: '24', sub: '~18 min today', color: '#111827' },
                    ].map((m) => (
                      <div key={m.label} className="rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-3">
                        <div className="text-[10px] font-semibold tracking-wide uppercase text-[#6B7280]">{m.label}</div>
                        <div className="text-lg font-bold tracking-tight mt-1" style={{ fontFamily: 'var(--font-space-grotesk)', color: m.color }}>
                          {m.value}
                        </div>
                        <div className="text-[11px] text-[#6B7280]">{m.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress visualization */}
                  <div className="rounded-2xl border border-[#E5E7EB] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                        <BarChart3 size={14} className="text-[#1F7A4C]" /> Learning Progress
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C] font-medium">B1 → B2</span>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Vocabulary', pct: 82, count: '1,240 words' },
                        { label: 'Speaking', pct: 64, count: '86 sessions' },
                        { label: 'Listening', pct: 71, count: '42 transcripts' },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-[#374151] w-20">{r.label}</span>
                          <div className="flex-1 h-2 rounded-full bg-[#F3F4F6] overflow-hidden border border-[#E5E7EB]">
                            <div className="h-full rounded-full bg-[#1F7A4C]" style={{ width: `${r.pct}%` }} />
                          </div>
                          <span className="text-xs text-[#6B7280] w-20 text-right">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Speaking mastery preview */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[#E5E7EB] p-4">
                      <div className="text-xs font-semibold text-[#111827] flex items-center gap-1.5 mb-2">
                        <Mic size={12} className="text-[#1F7A4C]" /> Speaking Mastery
                      </div>
                      <div className="flex items-end gap-1 h-10 mb-2">
                        {[40, 65, 35, 80, 55, 70, 45].map((h, i) => (
                          <div key={i} className="flex-1 rounded-sm bg-[#1F7A4C]" style={{ height: `${h}%`, opacity: 0.25 + (h / 100) * 0.75 }} />
                        ))}
                      </div>
                      <div className="text-[11px] text-[#6B7280]">Fluency +18% this month</div>
                    </div>
                    <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFBEB] p-4">
                      <div className="text-xs font-semibold text-[#111827] mb-1">Today&apos;s Goal</div>
                      <div className="text-lg font-bold text-[#B7791F]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                        6 / 8 tasks
                      </div>
                      <div className="h-1.5 rounded-full bg-white border border-[#FDE68A] overflow-hidden mt-2">
                        <div className="h-full bg-[#F4B942]" style={{ width: '75%' }} />
                      </div>
                      <div className="text-[11px] text-[#6B7280] mt-1">~12 min remaining</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <div className="hidden md:flex absolute -right-2 top-10 rounded-2xl bg-white border border-[#E5E7EB] shadow-lg px-3 py-2.5 items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center">
                  <Upload size={14} className="text-[#1F7A4C]" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#111827]">German A1 Textbook.pdf</div>
                  <div className="text-[11px] text-[#22C55E] flex items-center gap-1">
                    <Check size={10} /> Analyzed — 24 lessons found
                  </div>
                </div>
              </div>

              <div className="hidden md:flex absolute -left-4 bottom-10 rounded-2xl bg-white border border-[#E5E7EB] shadow-lg px-3 py-2.5 items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#F4B942] flex items-center justify-center">
                  <Mic size={14} className="text-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#111827]">Pronunciation 92%</div>
                  <div className="text-[11px] text-[#6B7280]">“Guten Morgen, wie geht es dir?”</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-y border-[#E5E7EB] bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                <Users size={16} className="text-[#1F7A4C]" /> Trusted by learners worldwide
              </h3>
              <p className="text-sm text-[#6B7280] mt-1">Real results from Woodpacker daily practice — continuity that sticks.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
              <span className="w-2 h-2 rounded-full bg-[#22C55E]" /> All systems operational
              <span className="hidden sm:inline">• GDPR compliant • No ads</span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-5"
              >
                <div className="text-2xl font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {s.value}
                </div>
                <div className="text-sm font-semibold text-[#111827] mt-1">{s.label}</div>
                <div className="text-xs text-[#6B7280]">{s.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="mt-6 rounded-2xl border border-[#E5E7EB] bg-white p-5 md:p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="flex -space-x-3 shrink-0">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-white bg-[#F3F4F6] flex items-center justify-center text-xs font-bold text-[#374151]"
                >
                  {['A', 'M', 'S'][i - 1]}
                </div>
              ))}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={14} className="text-[#F4B942] fill-[#F4B942]" />
                ))}
                <span className="text-xs font-semibold text-[#111827] ml-1">4.8 out of 5</span>
              </div>
              <p className="text-sm leading-relaxed text-[#374151]">
                “I uploaded my German textbook and started speaking on day 3. The cycles finally made vocabulary stick — no more relearning the same words.”
              </p>
              <div className="text-xs text-[#6B7280] mt-1">— Anna M., B1 German learner, Berlin</div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-[#1F7A4C] bg-[#F0FDF4] border border-[#BBF7D0] px-3 py-1.5 rounded-full shrink-0">
              <BadgeCheck size={14} /> Verified learner
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E5E7EB] text-xs font-semibold text-[#6B7280] mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" /> The problem with traditional learning
          </div>
          <h2 className="text-3xl md:text-[40px] font-bold tracking-tight text-[#111827] leading-[1.05]" style={{ fontFamily: 'var(--font-manrope)' }}>
            Why most learners never reach fluency
          </h2>
          <p className="text-[16px] leading-relaxed text-[#6B7280] mt-3">
            Language courses leave you with passive knowledge. You recognize words but cannot produce them when it matters.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {problems.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="rounded-[20px] border border-[#E5E7EB] bg-white p-6 flex gap-4 hover:shadow-soft transition-shadow"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border" style={{ background: p.bg, color: p.color, borderColor: p.color + '20' }}>
                <p.icon size={18} />
              </div>
              <div>
                <div className="text-base font-bold text-[#111827]">{p.title}</div>
                <div className="text-sm leading-relaxed text-[#6B7280] mt-1">{p.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Solution */}
      <section id="solution" className="bg-white border-y border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-xs font-semibold text-[#1F7A4C] mb-3">
              <Sparkles size={12} /> The Woodpacker system
            </div>
            <h2 className="text-3xl md:text-[40px] font-bold tracking-tight text-[#111827] leading-[1.05]" style={{ fontFamily: 'var(--font-manrope)' }}>
              From disconnected files to mastery
            </h2>
            <p className="text-[16px] leading-relaxed text-[#6B7280] mt-3">
              Your materials become an integrated system. Upload once, learn in every dimension.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-4 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-[34px] left-[8%] right-[8%] h-px bg-[#E5E7EB]" />
            {solutionSteps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="relative rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-5 pt-6"
              >
                <div className="absolute -top-3 left-5 w-8 h-8 rounded-full bg-[#1F7A4C] text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm">
                  {s.step}
                </div>
                <div className="w-10 h-10 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center text-[#1F7A4C] mb-4 mt-2">
                  <s.icon size={16} />
                </div>
                <div className="text-sm font-bold text-[#111827]">{s.title}</div>
                <div className="text-sm leading-relaxed text-[#6B7280] mt-1">{s.desc}</div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {s.items.map((it) => (
                    <span key={it} className="text-[11px] font-medium px-2 py-1 rounded-full bg-white border border-[#E5E7EB] text-[#374151]">
                      {it}
                    </span>
                  ))}
                </div>
                {i < solutionSteps.length - 1 && (
                  <div className="hidden md:flex absolute top-8 -right-2 w-4 h-4 rounded-full bg-white border border-[#E5E7EB] items-center justify-center">
                    <ArrowRight size={10} className="text-[#9CA3AF]" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1F7A4C] flex items-center justify-center shrink-0">
                <Target size={16} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#111827]">Long-Term Retention Guarantee</div>
                <div className="text-sm text-[#16643D]">Woodpecker repetition engine ensures nothing you learn is ever forgotten.</div>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-[#BBF7D0] text-[#1F7A4C] shrink-0">
              30 → 15 → 7 → 3 → 1 day cycles
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="max-w-[640px]">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E5E7EB] text-xs font-semibold text-[#6B7280] mb-3">
              <Layers size={12} className="text-[#1F7A4C]" /> Premium feature suite
            </div>
            <h2 className="text-3xl md:text-[36px] font-bold tracking-tight text-[#111827] leading-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
              Everything you need to truly master a language
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-[#6B7280] max-w-[360px]">
            Six integrated engines work together to turn your materials into active ability — not just recognition.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-[20px] border border-[#E5E7EB] bg-white p-6 hover:shadow-soft hover:-translate-y-1 transition-all group"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center border mb-4" style={{ background: f.bg, color: f.accent, borderColor: f.accent + '20' }}>
                <f.icon size={18} />
              </div>
              <div className="text-base font-bold text-[#111827]">{f.title}</div>
              <div className="text-sm leading-relaxed text-[#6B7280] mt-1.5">{f.desc}</div>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#1F7A4C] opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ArrowRight size={12} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Interactive Product Showcase – Brilliant style */}
      <section id="showcase" className="bg-white border-y border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="max-w-3xl mx-auto text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-xs font-semibold text-[#92400E] mb-3">
              <Sparkles size={12} /> Interactive showcase
            </div>
            <h2 className="text-3xl md:text-[40px] font-bold tracking-tight text-[#111827] leading-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
              See Woodpacker in action
            </h2>
            <p className="text-[16px] leading-relaxed text-[#6B7280] mt-3">
              Inspired by Brilliant — an animated, tab-driven tour of the full learning loop.
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FAFBFC] overflow-hidden shadow-sm">
            <div className="border-b border-[#E5E7EB] bg-white px-2 py-2 flex gap-1 overflow-x-auto">
              {showcaseTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    activeTab === t.id ? 'bg-[#1F7A4C] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {t.label} <span className={`hidden sm:inline font-normal ${activeTab === t.id ? 'text-white/70' : 'text-[#9CA3AF]'}`}>· {t.desc}</span>
                </button>
              ))}
            </div>

            <div className="p-6 md:p-8 bg-[#FAFBFC] min-h-[380px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'upload' && (
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                      <div>
                        <h3 className="text-xl font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                          Upload without organizing
                        </h3>
                        <p className="text-sm leading-relaxed text-[#6B7280] mt-2">
                          Drop a folder or files. Woodpacker detects textbooks, workbooks, audio, video and solutions — even nested subfolders — and keeps relationships intact.
                        </p>
                        <div className="mt-4 space-y-2">
                          {[
                            'Folder uploads — recursive scan',
                            'Relationship detection between files',
                            'Upload validation & checklist',
                          ].map((it) => (
                            <div key={it} className="flex items-center gap-2 text-sm text-[#374151]">
                              <span className="w-5 h-5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center">
                                <Check size={10} className="text-[#1F7A4C]" />
                              </span>
                              {it}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border-2 border-dashed border-[#D1D5DB] bg-white p-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-[#1F7A4C] flex items-center justify-center mx-auto mb-3">
                          <Upload size={20} className="text-white" />
                        </div>
                        <div className="text-sm font-semibold text-[#111827]">Drop your files here</div>
                        <div className="text-xs text-[#6B7280] mt-1">PDF · EPUB · MP3 · MP4 · DOCX · Images</div>
                        <div className="mt-4 flex justify-center gap-2">
                          <span className="text-xs px-3 py-1.5 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-[#374151]">Choose files</span>
                          <span className="text-xs px-3 py-1.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C]">Upload folder</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'extraction' && (
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                      <div>
                        <h3 className="text-xl font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                          AI extracts and maps knowledge
                        </h3>
                        <p className="text-sm leading-relaxed text-[#6B7280] mt-2">
                          Content extraction, knowledge mapping, exercise detection and context linking happen automatically — in the correct pedagogical order, not file order.
                        </p>
                        <div className="grid grid-cols-3 gap-2 mt-4">
                          {[
                            { k: '24', l: 'Lessons' },
                            { k: '186', l: 'Vocabulary' },
                            { k: '42', l: 'Exercises' },
                          ].map((s) => (
                            <div key={s.l} className="rounded-xl bg-white border border-[#E5E7EB] p-3 text-center">
                              <div className="text-lg font-bold text-[#1F7A4C]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                                {s.k}
                              </div>
                              <div className="text-xs text-[#6B7280]">{s.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4 space-y-2">
                        {[
                          { label: 'Content extraction', pct: 100 },
                          { label: 'Knowledge mapping', pct: 86 },
                          { label: 'Exercise detection', pct: 92 },
                          { label: 'Context linking', pct: 78 },
                        ].map((r) => (
                          <div key={r.label} className="flex items-center gap-3">
                            <span className="text-xs font-medium text-[#374151] w-32">{r.label}</span>
                            <div className="flex-1 h-2 rounded-full bg-[#F3F4F6] overflow-hidden border border-[#E5E7EB]">
                              <div className="h-full bg-[#1F7A4C]" style={{ width: `${r.pct}%` }} />
                            </div>
                            <span className="text-xs font-bold text-[#1F7A4C] w-8">{r.pct}%</span>
                          </div>
                        ))}
                        <div className="pt-3 flex items-center gap-2 text-xs text-[#6B7280]">
                          <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" /> Analyzing German A1 Textbook...
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'exercises' && (
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                      <div>
                        <h3 className="text-xl font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                          Exercises generated from your books
                        </h3>
                        <p className="text-sm leading-relaxed text-[#6B7280] mt-2">
                          Gap fills, translations, listening comprehension, pattern drills and speaking roleplays — all sourced from your own material, not generic AI.
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-4">
                          {['Gap Fill', 'Translation', 'Listening', 'Pattern Drill', 'Roleplay', 'Recall'].map((t) => (
                            <span key={t} className="text-xs font-medium px-2.5 py-1 rounded-full bg-white border border-[#E5E7EB] text-[#374151]">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4 space-y-3">
                        <div className="rounded-xl border border-[#E5E7EB] p-3">
                          <div className="text-[11px] font-semibold tracking-wide uppercase text-[#6B7280]">Gap Fill</div>
                          <div className="text-sm text-[#111827] mt-1">
                            Ich <span className="px-2 py-0.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] font-mono text-xs">____</span> heute keine Zeit.
                          </div>
                          <div className="text-xs text-[#6B7280] mt-1">Answer: habe</div>
                        </div>
                        <div className="rounded-xl border border-[#E5E7EB] p-3">
                          <div className="text-[11px] font-semibold tracking-wide uppercase text-[#6B7280]">Listening</div>
                          <div className="text-sm text-[#111827] mt-1">What did the speaker order at the restaurant?</div>
                          <div className="flex gap-1.5 mt-2">
                            {['Pasta', 'Soup', 'Salad'].map((o, i) => (
                              <span
                                key={o}
                                className={`text-xs px-2.5 py-1 rounded-full border ${i === 1 ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#1F7A4C] font-semibold' : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#6B7280]'}`}
                              >
                                {o}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'speaking' && (
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                      <div>
                        <h3 className="text-xl font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                          Speaking until it is automatic
                        </h3>
                        <p className="text-sm leading-relaxed text-[#6B7280] mt-2">
                          Voice recall, pattern mastery and roleplay. Pronunciation, fluency and grammar are scored after every attempt.
                        </p>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {[
                            { l: 'Pronunciation', v: '92%' },
                            { l: 'Fluency', v: '84%' },
                            { l: 'Grammar', v: '88%' },
                          ].map((s) => (
                            <div key={s.l} className="rounded-xl bg-white border border-[#E5E7EB] p-3 text-center">
                              <div className="text-sm font-bold text-[#1F7A4C]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                                {s.v}
                              </div>
                              <div className="text-[11px] text-[#6B7280]">{s.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5 text-center">
                        <div className="w-16 h-16 rounded-full bg-[#1F7A4C] flex items-center justify-center mx-auto mb-3">
                          <Mic size={22} className="text-white" />
                        </div>
                        <div className="text-sm font-semibold text-[#111827]">“Ich hätte gern die Rechnung, bitte.”</div>
                        <div className="text-xs text-[#6B7280] mt-1">Tap and speak · Daily challenge</div>
                        <div className="mt-4 h-10 flex items-center justify-center gap-1">
                          {[18, 32, 22, 40, 28, 35, 20, 30].map((h, i) => (
                            <div key={i} className="w-1 rounded-full bg-[#1F7A4C]" style={{ height: `${h}px`, opacity: 0.3 + (i / 8) * 0.7 }} />
                          ))}
                        </div>
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1F7A4C] text-white text-xs font-semibold">
                          <Play size={12} /> Check pronunciation
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'dashboard' && (
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                      <div>
                        <h3 className="text-xl font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                          Mastery dashboard — your command center
                        </h3>
                        <p className="text-sm leading-relaxed text-[#6B7280] mt-2">
                          Today&apos;s goal, current streak, mastery score, active courses, upcoming reviews and speaking sessions — all in one premium view.
                        </p>
                        <div className="mt-4">
                          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1F7A4C] hover:text-[#16643D]">
                            Open dashboard <ArrowRight size={14} />
                          </Link>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white border border-[#E5E7EB] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Today&apos;s Goal</span>
                          <span className="text-xs font-bold text-[#1F7A4C]">75% complete</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden border border-[#E5E7EB]">
                          <div className="h-full w-3/4 bg-[#1F7A4C]" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] p-3">
                            <div className="text-xs text-[#16643D]">Streak</div>
                            <div className="text-lg font-bold text-[#1F7A4C]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                              14 days 🔥
                            </div>
                          </div>
                          <div className="rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-3">
                            <div className="text-xs text-[#92400E]">Mastery</div>
                            <div className="text-lg font-bold text-[#B7791F]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                              78 / 100
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#6B7280] pt-1">
                          <Clock size={12} /> Next review in 4 hours · 12 speaking sessions this week
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-xs font-semibold text-[#1F7A4C] mb-3">
            <BadgeCheck size={12} /> Simple, premium pricing
          </div>
          <h2 className="text-3xl md:text-[40px] font-bold tracking-tight text-[#111827] leading-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
            Premium learning, fair pricing
          </h2>
          <p className="text-[16px] leading-relaxed text-[#6B7280] mt-3">
            Start free. Upgrade when you are ready to accelerate.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start max-w-5xl mx-auto">
          {/* Free */}
          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-7">
            <h3 className="text-lg font-bold text-[#111827]">Free</h3>
            <p className="text-sm text-[#6B7280] mt-1">For testing the mastery system</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                €0
              </span>
              <span className="text-sm text-[#6B7280]">/month</span>
            </div>
            <ul className="mt-6 space-y-2.5">
              {['Up to 2 materials', 'Basic extraction', 'Limited exercises', 'Community support'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#374151]">
                  <span className="w-5 h-5 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center">
                    <Check size={10} className="text-[#6B7280]" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/onboarding" className="mt-6 flex items-center justify-center w-full py-3 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB] transition-colors">
              Start free
            </Link>
          </div>

          {/* Pro – highlighted */}
          <div className="rounded-[24px] border-2 border-[#1F7A4C] bg-white p-7 shadow-[0_12px_32px_rgba(31,122,76,0.12)] relative md:-mt-3">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#1F7A4C] text-white text-xs font-bold">Most popular</div>
            <h3 className="text-lg font-bold text-[#111827]">Pro</h3>
            <p className="text-sm text-[#6B7280] mt-1">For serious learners</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                €19
              </span>
              <span className="text-sm text-[#6B7280]">/month</span>
            </div>
            <ul className="mt-6 space-y-2.5">
              {['Unlimited materials', 'Full AI transformation', 'Speaking & accent scoring', 'Adaptive repetition engine', 'Progress analytics', 'Priority support'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#374151]">
                  <span className="w-5 h-5 rounded-full bg-[#1F7A4C] flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/onboarding" className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold hover:bg-[#16643D] transition-colors shadow-sm">
              Start Learning Free <ArrowRight size={14} />
            </Link>
            <p className="text-xs text-center text-[#6B7280] mt-2">14-day free trial · Cancel anytime</p>
          </div>

          {/* Team */}
          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-7">
            <h3 className="text-lg font-bold text-[#111827]">Team</h3>
            <p className="text-sm text-[#6B7280] mt-1">For schools & institutions</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                Custom
              </span>
            </div>
            <ul className="mt-6 space-y-2.5">
              {['Everything in Pro', 'Team analytics & admin', 'SSO & compliance', 'Dedicated success manager', 'Volume discounts'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#374151]">
                  <span className="w-5 h-5 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center">
                    <Check size={10} className="text-[#6B7280]" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/pricing" className="mt-6 flex items-center justify-center w-full py-3 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] text-sm font-semibold text-[#111827] hover:bg-white transition-colors">
              Contact sales
            </Link>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/pricing" className="text-sm font-semibold text-[#1F7A4C] hover:text-[#16643D] inline-flex items-center gap-1">
            View full pricing & comparison <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-y border-[#E5E7EB]">
        <div className="max-w-[900px] mx-auto px-6 py-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
              Frequently asked questions
            </h2>
            <p className="text-sm text-[#6B7280] mt-2">Everything you need to know about Woodpacker.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={f.q} className="rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={openFaq === i}
                >
                  <span className="text-sm font-semibold text-[#111827]">{f.q}</span>
                  <span className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-all ${openFaq === i ? 'bg-[#1F7A4C] border-[#1F7A4C] text-white' : 'bg-white border-[#E5E7EB] text-[#6B7280]'}`}>
                    <ChevronDown size={14} className={`transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 text-sm leading-relaxed text-[#6B7280] border-t border-[#E5E7EB] pt-3 bg-white">{f.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="rounded-[24px] border border-[#1F7A4C] bg-[#1F7A4C] p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-white overflow-hidden relative">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative">
            <h3 className="text-2xl md:text-[28px] font-bold tracking-tight leading-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
              Start your mastery journey today
            </h3>
            <p className="text-sm text-white/80 mt-1 max-w-xl">
              Upload your first book and experience the Woodpecker repetition system. No credit card, no commitment.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0 relative">
            <Link href="/onboarding" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-[#1F7A4C] font-semibold hover:bg-[#F9FAFB] transition-colors shadow-sm">
              Start Learning Free <ArrowRight size={16} />
            </Link>
            <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#16643D] text-white font-semibold hover:bg-[#145A35] border border-white/20 transition-colors">
              View Demo
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-10 pt-8 border-t border-[#E5E7EB] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#6B7280]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#1F7A4C] flex items-center justify-center">
              <BookOpen size={12} className="text-white" />
            </div>
            <span className="font-semibold text-[#111827]">Woodpacker</span>
            <span>© 2026 Woodpacker Education. Premium language mastery, built for fluency.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="hover:text-[#111827]">
              Pricing
            </Link>
            <Link href="/dashboard" className="hover:text-[#111827]">
              Dashboard
            </Link>
            <span className="flex items-center gap-1.5">
              <Globe size={12} /> EN · DE · FR · ES · IT · JA · ZH
            </span>
          </div>
        </footer>
      </section>
    </div>
  )
}
