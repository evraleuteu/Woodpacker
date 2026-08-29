'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Globe,
  BookOpen,
  GraduationCap,
  Briefcase,
  Plane,
  School,
  Heart,
  Sparkles,
  Clock,
  Target,
  Video,
  FileText,
  Headphones,
  Trophy,
  ArrowRight,
  Flame,
  Calendar,
  Mic,
  Mail,
  Monitor,
  Code2,
} from 'lucide-react'

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

// Step 1 – Language
const languages = [
  { id: 'de', label: 'German', native: 'Deutsch', flag: '🇩🇪' },
  { id: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { id: 'fr', label: 'French', native: 'Français', flag: '🇫🇷' },
  { id: 'es', label: 'Spanish', native: 'Español', flag: '🇪🇸' },
  { id: 'other', label: 'Other', native: 'Another language', flag: '🌍' },
]

// Step 2 – Goal
const goals = [
  { id: 'exams', label: 'Exams', desc: 'Pass a language exam', icon: GraduationCap },
  { id: 'work', label: 'Work', desc: 'Professional communication', icon: Briefcase },
  { id: 'immigration', label: 'Immigration', desc: 'Live & integrate abroad', icon: Plane },
  { id: 'school', label: 'School', desc: 'Study & academic success', icon: School },
  { id: 'growth', label: 'Personal Growth', desc: 'Speak for yourself', icon: Heart },
]

// Step 3 – Level
const levels = [
  { id: 'A1', label: 'A1', name: 'Beginner', desc: 'Basic words & phrases' },
  { id: 'A2', label: 'A2', name: 'Elementary', desc: 'Simple conversations' },
  { id: 'B1', label: 'B1', name: 'Intermediate', desc: 'Express opinions' },
  { id: 'B2', label: 'B2', name: 'Upper-Intermediate', desc: 'Fluent discussions' },
  { id: 'C1', label: 'C1', name: 'Advanced', desc: 'Complex topics' },
  { id: 'C2', label: 'C2', name: 'Mastery', desc: 'Near-native fluency' },
]

// Step 4 – Material
const materials = [
  { id: 'books', label: 'Books', desc: 'Textbooks, novels', icon: BookOpen },
  { id: 'pdfs', label: 'Course PDFs', desc: 'Course books & workbooks', icon: FileText },
  { id: 'exercises', label: 'Exercises', desc: 'Worksheets & tasks', icon: Target },
  { id: 'audio', label: 'Audio Lessons', desc: 'MP3, audio courses', icon: Headphones },
  { id: 'videos', label: 'Videos', desc: 'Lessons & recordings', icon: Video },
]

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>(1)
  const [direction, setDirection] = useState(1)

  // selections
  const [language, setLanguage] = useState<string | null>(null)
  const [goal, setGoal] = useState<string | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [minutes, setMinutes] = useState(20)
  const [email, setEmail] = useState('')

  const go = (next: Step) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  const toggleMaterial = (id: string) => {
    setSelectedMaterials((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const canContinue = () => {
    if (step === 1) return !!language
    if (step === 2) return !!goal
    if (step === 3) return !!level
    if (step === 4) return selectedMaterials.length > 0
    if (step === 5) return minutes >= 5 && minutes <= 120
    return true
  }

  // derived preview values
  const languageLabel = languages.find((l) => l.id === language)?.label ?? 'your language'
  const dailyWords = Math.round(minutes * 0.8)
  const weeklyHours = ((minutes * 7) / 60).toFixed(1)
  const weeksToNextLevel = level === 'A1' ? '8–12' : level === 'A2' ? '10–14' : level === 'B1' ? '12–16' : level === 'B2' ? '14–20' : '16–24'
  const speakingLevelAtEnd = level === 'A1' ? 'A2 speaking' : level === 'A2' ? 'B1 speaking' : level === 'B1' ? 'B2 speaking' : level === 'B2' ? 'C1 speaking' : 'C2 mastery'

  return (
    <div className="min-h-screen bg-[#FAFBFC] flex flex-col">
      {/* Top bar – Duolingo style */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[720px] mx-auto px-4 h-[64px] flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#1F7A4C] flex items-center justify-center">
              <BookOpen size={14} className="text-white" />
            </div>
            <span className="hidden sm:inline text-[15px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
              Woodpacker
            </span>
          </Link>

          {/* Progress */}
          <div className="flex-1 max-w-[420px] flex items-center gap-3">
            <div className="flex-1 h-2.5 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] overflow-hidden p-0.5">
              <motion.div
                className="h-full rounded-full bg-[#1F7A4C]"
                initial={false}
                animate={{ width: `${(step / 7) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <span className="text-xs font-bold text-[#1F7A4C] hidden sm:inline" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {step} / 7
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-[#6B7280]">
            <Flame size={14} className="text-[#F4B942]" />
            <span className="font-medium">7-day streak ahead</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-[720px]">
          {/* Step dots – Duolingo style */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3, 4, 5, 6, 7].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    s === step
                      ? 'bg-[#1F7A4C] border-[#1F7A4C] text-white shadow-sm'
                      : s < step
                        ? 'bg-[#F0FDF4] border-[#1F7A4C] text-[#1F7A4C]'
                        : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'
                  }`}
                >
                  {s < step ? <Check size={14} strokeWidth={3} /> : s}
                </div>
                {s < 7 && <div className={`w-6 h-0.5 rounded-full ${s < step ? 'bg-[#1F7A4C]' : 'bg-[#E5E7EB]'}`} />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 24 : -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -24 : 24 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {/* Step 1 – Welcome / Language */}
              {step === 1 && (
                <div className="text-center">
                  <div className="w-20 h-20 rounded-[20px] bg-[#1F7A4C] flex items-center justify-center mx-auto mb-5 shadow-sm">
                    <Globe size={32} className="text-white" />
                  </div>
                  <h1 className="text-[28px] md:text-[34px] font-bold leading-tight tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                    What language do you want to master?
                  </h1>
                  <p className="text-[15px] text-[#6B7280] mt-2 max-w-lg mx-auto leading-relaxed">
                    Choose your focus language. Woodpacker will build your entire mastery system around it.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 text-left">
                    {languages.map((l) => {
                      const selected = language === l.id
                      return (
                        <button
                          key={l.id}
                          onClick={() => setLanguage(l.id)}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                            selected ? 'border-[#1F7A4C] bg-[#F0FDF4] shadow-sm' : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#F9FAFB]'
                          }`}
                        >
                          <span className="text-3xl leading-none">{l.flag}</span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold ${selected ? 'text-[#1F7A4C]' : 'text-[#111827]'}`}>{l.label}</div>
                            <div className="text-xs text-[#6B7280]">{l.native}</div>
                          </div>
                          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-[#1F7A4C] border-[#1F7A4C]' : 'bg-white border-[#E5E7EB]'}`}>
                            {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex justify-end mt-8">
                    <button
                      onClick={() => go(2)}
                      disabled={!language}
                      className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#1F7A4C] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#16643D] shadow-sm transition-colors"
                    >
                      Continue <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 – Goal */}
              {step === 2 && (
                <div>
                  <div className="text-center mb-8">
                    <h2 className="text-[26px] md:text-[30px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                      Why are you learning?
                    </h2>
                    <p className="text-[15px] text-[#6B7280] mt-1">We tailor the journey to your motivation.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {goals.map((g) => {
                      const selected = goal === g.id
                      return (
                        <button
                          key={g.id}
                          onClick={() => setGoal(g.id)}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                            selected ? 'border-[#1F7A4C] bg-[#F0FDF4] shadow-sm' : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#F9FAFB]'
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${selected ? 'bg-[#1F7A4C] border-[#1F7A4C] text-white' : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#6B7280]'}`}>
                            <g.icon size={20} />
                          </div>
                          <div className="flex-1">
                            <div className={`text-sm font-bold ${selected ? 'text-[#1F7A4C]' : 'text-[#111827]'}`}>{g.label}</div>
                            <div className="text-xs text-[#6B7280]">{g.desc}</div>
                          </div>
                          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-[#1F7A4C] border-[#1F7A4C]' : 'bg-white border-[#E5E7EB]'}`}>
                            {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex justify-between mt-8">
                    <button onClick={() => go(1)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-[#E5E7EB] text-[#374151] font-semibold hover:bg-[#F9FAFB]">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button
                      onClick={() => go(3)}
                      disabled={!goal}
                      className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#1F7A4C] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#16643D] shadow-sm"
                    >
                      Continue <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 – Level */}
              {step === 3 && (
                <div>
                  <div className="text-center mb-8">
                    <h2 className="text-[26px] md:text-[30px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                      What&apos;s your current level?
                    </h2>
                    <p className="text-[15px] text-[#6B7280] mt-1">Pick the one that feels closest — you can change it later.</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {levels.map((l) => {
                      const selected = level === l.id
                      return (
                        <button
                          key={l.id}
                          onClick={() => setLevel(l.id)}
                          className={`p-5 rounded-2xl border-2 text-center transition-all ${selected ? 'border-[#1F7A4C] bg-[#F0FDF4] shadow-sm' : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#F9FAFB]'}`}
                        >
                          <div className={`text-2xl font-extrabold tracking-tight ${selected ? 'text-[#1F7A4C]' : 'text-[#111827]'}`} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                            {l.label}
                          </div>
                          <div className="text-xs font-semibold text-[#111827] mt-1">{l.name}</div>
                          <div className="text-[11px] text-[#6B7280] mt-0.5">{l.desc}</div>
                          {selected && (
                            <div className="mt-3 inline-flex w-6 h-6 rounded-full bg-[#1F7A4C] items-center justify-center">
                              <Check size={12} className="text-white" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-6 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-3 flex items-start gap-2">
                    <Sparkles size={14} className="text-[#D97706] mt-0.5 shrink-0" />
                    <p className="text-xs leading-relaxed text-[#92400E]">
                      Woodpacker adapts the difficulty automatically. Your materials determine the actual starting point — this just calibrates the plan.
                    </p>
                  </div>

                  <div className="flex justify-between mt-8">
                    <button onClick={() => go(2)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-[#E5E7EB] text-[#374151] font-semibold hover:bg-[#F9FAFB]">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button
                      onClick={() => go(4)}
                      disabled={!level}
                      className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#1F7A4C] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#16643D] shadow-sm"
                    >
                      Continue <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4 – Material */}
              {step === 4 && (
                <div>
                  <div className="text-center mb-8">
                    <h2 className="text-[26px] md:text-[30px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                      What would you like to upload?
                    </h2>
                    <p className="text-[15px] text-[#6B7280] mt-1">Select all that apply — or skip and upload later.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {materials.map((m) => {
                      const selected = selectedMaterials.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleMaterial(m.id)}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${selected ? 'border-[#1F7A4C] bg-[#F0FDF4] shadow-sm' : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:bg-[#F9FAFB]'}`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${selected ? 'bg-[#1F7A4C] border-[#1F7A4C] text-white' : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#6B7280]'}`}>
                            <m.icon size={18} />
                          </div>
                          <div className="flex-1">
                            <div className={`text-sm font-bold ${selected ? 'text-[#1F7A4C]' : 'text-[#111827]'}`}>{m.label}</div>
                            <div className="text-xs text-[#6B7280]">{m.desc}</div>
                          </div>
                          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-[#1F7A4C] border-[#1F7A4C]' : 'bg-white border-[#E5E7EB]'}`}>
                            {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <p className="text-xs text-center text-[#6B7280] mt-4">
                    Woodpacker supports PDF, EPUB, DOCX, MP3, WAV, M4A, MP4 & images — folder uploads included.
                  </p>

                  <div className="flex justify-between mt-8">
                    <button onClick={() => go(3)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-[#E5E7EB] text-[#374151] font-semibold hover:bg-[#F9FAFB]">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => go(5)} className="px-5 py-3 rounded-xl text-sm font-medium text-[#6B7280] hover:text-[#111827]">
                        Skip for now
                      </button>
                      <button
                        onClick={() => go(5)}
                        disabled={!canContinue()}
                        className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#1F7A4C] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#16643D] shadow-sm"
                      >
                        Continue <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5 – Minutes per day */}
              {step === 5 && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-center mx-auto mb-4">
                    <Clock size={24} className="text-[#D97706]" />
                  </div>
                  <h2 className="text-[26px] md:text-[30px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                    How many minutes per day?
                  </h2>
                  <p className="text-[15px] text-[#6B7280] mt-1">Set a realistic daily goal. You can adjust anytime.</p>

                  <div className="mt-8 rounded-[20px] border border-[#E5E7EB] bg-white p-6">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="text-4xl font-extrabold tracking-tight text-[#1F7A4C]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                        {minutes}
                      </span>
                      <span className="text-sm font-semibold text-[#6B7280]">minutes / day</span>
                    </div>

                    <input
                      type="range"
                      min={5}
                      max={120}
                      step={5}
                      value={minutes}
                      onChange={(e) => setMinutes(Number(e.target.value))}
                      className="w-full accent-[#1F7A4C] h-2"
                      aria-label="Minutes per day"
                    />
                    <div className="flex justify-between text-[11px] font-medium text-[#9CA3AF] mt-1">
                      <span>5 min</span>
                      <span>60 min</span>
                      <span>120 min</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-6">
                      {[15, 30, 60].map((m) => (
                        <button
                          key={m}
                          onClick={() => setMinutes(m)}
                          className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${minutes === m ? 'bg-[#1F7A4C] border-[#1F7A4C] text-white shadow-sm' : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#374151] hover:bg-white hover:border-[#D1D5DB]'}`}
                        >
                          {m} min
                        </button>
                      ))}
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-6 text-xs">
                      <span className="flex items-center gap-1.5 text-[#374151]">
                        <span className="w-2 h-2 rounded-full bg-[#1F7A4C]" />
                        {dailyWords} words/day
                      </span>
                      <span className="flex items-center gap-1.5 text-[#374151]">
                        <span className="w-2 h-2 rounded-full bg-[#F4B942]" />
                        {weeklyHours}h / week
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between mt-8">
                    <button onClick={() => go(4)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-[#E5E7EB] text-[#374151] font-semibold hover:bg-[#F9FAFB]">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button onClick={() => go(6)} className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#1F7A4C] text-white font-semibold hover:bg-[#16643D] shadow-sm">
                      See my plan <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 6 – Personalized Plan Preview */}
              {step === 6 && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#1F7A4C] flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Trophy size={24} className="text-white" />
                  </div>
                  <h2 className="text-[26px] md:text-[30px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                    Your personalized plan
                  </h2>
                  <p className="text-[15px] leading-relaxed text-[#6B7280] max-w-lg mx-auto mt-1">
                    Based on <span className="font-semibold text-[#111827]">{languageLabel}</span> · {level} · {minutes} min/day ·{' '}
                    {selectedMaterials.length ? selectedMaterials.join(', ') : 'any materials'} — here&apos;s your roadmap.
                  </p>

                  <div className="mt-6 rounded-[20px] border border-[#E5E7EB] bg-white overflow-hidden text-left">
                    <div className="px-5 py-4 bg-[#FAFBFC] border-b border-[#E5E7EB] flex items-center justify-between">
                      <span className="text-sm font-bold text-[#111827] flex items-center gap-2">
                        <Calendar size={14} className="text-[#1F7A4C]" /> Weekly progress
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#1F7A4C] text-white">{minutes} min/day · {weeklyHours}h/week</span>
                    </div>

                    <div className="p-5">
                      <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-4 text-center">
                          <div className="text-lg font-bold text-[#1F7A4C]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                            {weeksToNextLevel}
                          </div>
                          <div className="text-xs font-medium text-[#374151]">weeks to next level</div>
                          <div className="text-[11px] text-[#6B7280]">Adaptive to your pace</div>
                        </div>
                        <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-4 text-center">
                          <div className="text-lg font-bold text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                            ~{dailyWords * 7}
                          </div>
                          <div className="text-xs font-medium text-[#374151]">words / week</div>
                          <div className="text-[11px] text-[#6B7280]">Kept by repetition</div>
                        </div>
                        <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-center">
                          <div className="text-lg font-bold text-[#B7791F]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                            {speakingLevelAtEnd}
                          </div>
                          <div className="text-xs font-medium text-[#92400E]">Expected outcome</div>
                          <div className="text-[11px] text-[#6B7280]">After 12 weeks</div>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold tracking-wide uppercase text-[#6B7280] mb-3">Estimated milestones</h4>
                      <div className="space-y-3">
                        {[
                          { week: 'Week 1–4', label: 'Foundations', desc: 'Core vocabulary & basic patterns — speaking from day 3', pct: 28 },
                          { week: 'Week 5–8', label: 'Building', desc: 'Grammar structures & longer sentences — daily speaking', pct: 58 },
                          { week: 'Week 9–12', label: 'Fluency', desc: 'Spontaneous speaking & comprehension — automatic recall', pct: 86 },
                        ].map((m) => (
                          <div key={m.week} className="flex gap-3 p-3 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC]">
                            <div className="w-10 h-10 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
                              <Calendar size={14} className="text-[#1F7A4C]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#111827]">
                                {m.week}: {m.label}
                              </div>
                              <div className="text-xs text-[#6B7280] leading-relaxed">{m.desc}</div>
                              <div className="h-1.5 rounded-full bg-white border border-[#E5E7EB] overflow-hidden mt-2">
                                <div className="h-full bg-[#1F7A4C] rounded-full" style={{ width: `${m.pct}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] p-3 flex items-start gap-2">
                        <Sparkles size={14} className="text-[#1F7A4C] mt-0.5 shrink-0" />
                        <p className="text-xs leading-relaxed text-[#16643D]">
                          This preview adapts to your materials. Upload a textbook and Woodpacker calibrates exact lessons, vocabulary and speaking tasks.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between mt-8">
                    <button onClick={() => go(5)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-[#E5E7EB] text-[#374151] font-semibold hover:bg-[#F9FAFB]">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button onClick={() => go(7)} className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#1F7A4C] text-white font-semibold hover:bg-[#16643D] shadow-sm">
                      Create my account <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 7 – Account Creation */}
              {step === 7 && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#111827] flex items-center justify-center mx-auto mb-4">
                    <Sparkles size={24} className="text-white" />
                  </div>
                  <h2 className="text-[26px] md:text-[30px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                    Create your account
                  </h2>
                  <p className="text-[15px] text-[#6B7280] mt-1">Minimal friction — start learning in 30 seconds.</p>

                  <div className="mt-6 rounded-[20px] border border-[#E5E7EB] bg-white p-6 text-left">
                    <div className="grid gap-3">
                      <button className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-sm font-semibold text-[#111827] transition-colors">
                        <Monitor size={18} className="text-[#EA4335]" /> Continue with Google
                      </button>
                      <button className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-sm font-semibold text-[#111827] transition-colors">
                        <Code2 size={18} /> Continue with GitHub
                      </button>

                      <div className="flex items-center gap-3 py-2">
                        <div className="h-px flex-1 bg-[#E5E7EB]" />
                        <span className="text-xs font-medium text-[#9CA3AF]">OR</span>
                        <div className="h-px flex-1 bg-[#E5E7EB]" />
                      </div>

                      <label className="text-xs font-semibold text-[#374151]">Email address</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full pl-9 pr-3 py-3 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] text-sm placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1F7A4C]/20 focus:border-[#1F7A4C] focus:bg-white transition-all"
                          />
                        </div>
                      </div>

                      <Link
                        href="/dashboard"
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#1F7A4C] text-white font-semibold hover:bg-[#16643D] shadow-sm transition-colors mt-1"
                      >
                        Create account & start learning <ArrowRight size={16} />
                      </Link>

                      <p className="text-xs text-center text-[#9CA3AF] leading-relaxed">
                        By continuing you agree to our Terms and Privacy Policy. No spam — unsubscribe anytime.
                      </p>
                    </div>

                    {/* Summary */}
                    <div className="mt-6 pt-4 border-t border-[#F3F4F6] flex flex-wrap gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C] font-medium">
                        {language ? languages.find((l) => l.id === language)?.label : 'Language'} · {level ?? 'Level'}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] font-medium">{minutes} min/day</span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-[#6B7280]">{selectedMaterials.length} material types</span>
                    </div>
                  </div>

                  <div className="flex justify-between mt-8">
                    <button onClick={() => go(6)} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-[#E5E7EB] text-[#374151] font-semibold hover:bg-[#F9FAFB]">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <Link href="/dashboard" className="text-sm font-medium text-[#6B7280] hover:text-[#111827] px-3 py-3">
                      Skip for now →
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Motivational footer */}
          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-[#9CA3AF]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
            Friendly · Motivating · Professional — Duolingo-grade onboarding
          </div>
        </div>
      </div>
    </div>
  )
}
