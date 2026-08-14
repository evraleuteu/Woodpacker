'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Globe,
  BookOpen,
  Mic,
  Headphones,
  Pen,
  GraduationCap,
  Briefcase,
  University,
  MessageSquare,
  Upload,
  Target,
  ArrowRight,
  Trophy,
  Calendar,
} from 'lucide-react'

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

const goals = [
  { id: 'exam', label: 'Pass an exam', icon: GraduationCap, desc: 'Prepare for a specific test' },
  { id: 'speaking', label: 'Improve speaking', icon: Mic, desc: 'Speak more fluently' },
  { id: 'listening', label: 'Improve listening', icon: Headphones, desc: 'Understand native speech' },
  { id: 'work', label: 'Learn for work', icon: Briefcase, desc: 'Professional communication' },
  { id: 'university', label: 'Learn for university', icon: University, desc: 'Academic language' },
  { id: 'general', label: 'General fluency', icon: Globe, desc: 'Everyday conversation' },
]

const languages = [
  { code: 'de', name: 'German', flag: '🇩🇪', desc: 'Deutsch' },
  { code: 'en', name: 'English', flag: '🇬🇧', desc: 'English' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', desc: 'Español' },
  { code: 'fr', name: 'French', flag: '🇫🇷', desc: 'Français' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', desc: 'Italiano' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', desc: 'Português' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', desc: 'Русский' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', desc: '日本語' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', desc: '한국어' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', desc: '中文' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', desc: 'Nederlands' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', desc: 'العربية' },
]

const levels = [
  { id: 'a1', label: 'A1', name: 'Beginner', desc: 'Basic words and phrases' },
  { id: 'a2', label: 'A2', name: 'Elementary', desc: 'Simple conversations' },
  { id: 'b1', label: 'B1', name: 'Intermediate', desc: 'Express opinions' },
  { id: 'b2', label: 'B2', name: 'Upper Intermediate', desc: 'Fluent discussions' },
  { id: 'c1', label: 'C1', name: 'Advanced', desc: 'Complex topics' },
  { id: 'c2', label: 'C2', name: 'Mastery', desc: 'Near-native fluency' },
]

const learningStyles = [
  { id: 'speaking', label: 'Speaking', icon: Mic, desc: 'Improve pronunciation and fluency' },
  { id: 'listening', label: 'Listening', icon: Headphones, desc: 'Understand native speakers' },
  { id: 'grammar', label: 'Grammar', icon: Pen, desc: 'Master sentence structures' },
  { id: 'vocabulary', label: 'Vocabulary', icon: BookOpen, desc: 'Expand your word bank' },
  { id: 'exam', label: 'Exam Preparation', icon: Target, desc: 'Pass your language test' },
]

const fadeVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1)
  const [direction, setDirection] = useState(0)
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [completed, setCompleted] = useState(false)

  const goTo = (s: Step) => {
    setDirection(s > step ? 1 : -1)
    setStep(s)
  }

  const toggleStyle = (id: string) => {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handleAnalyze = () => {
    setAnalyzing(true)
    setTimeout(() => {
      setAnalyzing(false)
      goTo(7)
    }, 2500)
  }

  const handleComplete = () => {
    setCompleted(true)
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-lg"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-6">
            <Trophy size={36} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3">Your Woodpecker Mastery Plan</h1>
          <p className="text-[#A8A29E] mb-8">
            We&apos;ve built your personalised learning journey. Here&apos;s your roadmap to fluency.
          </p>

          <div className="glass-card rounded-2xl p-6 mb-8 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                <div className="text-2xl font-bold text-gradient">12</div>
                <div className="text-xs text-[#A8A29E] mt-1">Weeks to fluency</div>
              </div>
              <div className="p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                <div className="text-2xl font-bold text-gradient">96</div>
                <div className="text-xs text-[#A8A29E] mt-1">Lessons</div>
              </div>
              <div className="p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                <div className="text-2xl font-bold text-gradient">240</div>
                <div className="text-xs text-[#A8A29E] mt-1">Pattern exercises</div>
              </div>
              <div className="p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                <div className="text-2xl font-bold text-gradient">48</div>
                <div className="text-xs text-[#A8A29E] mt-1">Speaking sessions</div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-[#FAF8F5]">Weekly Milestones</h3>
              {[
                { week: 'Week 1-4', label: 'Foundations', desc: 'Core vocabulary and basic patterns' },
                { week: 'Week 5-8', label: 'Building', desc: 'Grammar structures and longer sentences' },
                { week: 'Week 9-12', label: 'Fluency', desc: 'Spontaneous speaking and comprehension' },
              ].map((m) => (
                <div key={m.week} className="flex items-center gap-3 p-3 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center shrink-0">
                    <Calendar size={14} className="text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{m.week}: {m.label}</div>
                    <div className="text-xs text-[#A8A29E]">{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/dashboard"
            className="btn-primary text-base px-8 py-3"
          >
            Begin Your Journey
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  s === step
                    ? 'bg-gradient-to-br from-[#059669] to-[#10B981] text-white shadow-lg shadow-[rgba(16,185,129,0.2)]'
                    : s < step
                    ? 'bg-[#10B981] text-white'
                    : 'bg-[rgba(250,248,245,0.05)] text-[#6B7280] border border-[rgba(250,248,245,0.08)]'
                }`}
              >
                {s < step ? <Check size={14} /> : s}
              </div>
              {s < 7 && (
                <div
                  className={`w-8 h-0.5 rounded-full ${
                    s < step
                      ? 'bg-gradient-to-r from-[#10B981] to-[#059669]'
                      : 'bg-[rgba(250,248,245,0.06)]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={fadeVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            {/* Step 1: Welcome */}
            {step === 1 && (
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-6">
                  <Sparkles size={40} className="text-white" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
                  Master Languages Through<br />
                  <span className="text-gradient">Repetition That Actually Works.</span>
                </h1>
                <p className="text-lg text-[#A8A29E] max-w-xl mx-auto mb-8">
                  Upload your books, lessons and audio. Woodpecker turns them into a personalised mastery system.
                </p>
                <div className="flex items-center justify-center gap-3 mb-12">
                  {[
                    { icon: BookOpen, label: 'Textbooks' },
                    { icon: Mic, label: 'Audio' },
                    { icon: MessageSquare, label: 'Speaking' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)]">
                      <item.icon size={14} className="text-[#10B981]" />
                      <span className="text-sm text-[#A8A29E]">{item.label}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => goTo(2)}
                  className="btn-primary text-base px-10 py-3"
                >
                  Start My Journey
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            {/* Step 2: Goal Selection */}
            {step === 2 && (
              <div>
                <h2 className="text-3xl font-bold text-center mb-2">What is your goal?</h2>
                <p className="text-[#A8A29E] text-center mb-8">Choose your primary language learning objective</p>
                <div className="grid grid-cols-2 gap-3">
                  {goals.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGoal(g.id)}
                      className={`onboarding-card flex items-center gap-4 ${
                        selectedGoal === g.id ? 'selected' : ''
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        selectedGoal === g.id
                          ? 'bg-gradient-to-br from-[#059669] to-[#10B981]'
                          : 'bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)]'
                      }`}>
                        <g.icon size={22} className={selectedGoal === g.id ? 'text-white' : 'text-[#6B7280]'} />
                      </div>
                      <div>
                        <div className="font-semibold">{g.label}</div>
                        <div className="text-sm text-[#A8A29E]">{g.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-3 mt-8">
                  <button onClick={() => goTo(1)} className="btn-secondary">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    onClick={() => goTo(3)}
                    disabled={!selectedGoal}
                    className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Continue <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Language Selection */}
            {step === 3 && (
              <div>
                <h2 className="text-3xl font-bold text-center mb-2">Choose Your Language</h2>
                <p className="text-[#A8A29E] text-center mb-8">Select the language you want to master</p>
                <div className="grid grid-cols-3 gap-3">
                  {languages.map((l) => (
                    <div
                      key={l.code}
                      onClick={() => setSelectedLanguage(l.code)}
                      className={`onboarding-card flex items-center gap-3 ${
                        selectedLanguage === l.code ? 'selected' : ''
                      }`}
                    >
                      <span className="text-2xl">{l.flag}</span>
                      <div>
                        <div className="font-semibold text-sm">{l.name}</div>
                        <div className="text-xs text-[#A8A29E]">{l.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-3 mt-8">
                  <button onClick={() => goTo(2)} className="btn-secondary">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    onClick={() => goTo(4)}
                    disabled={!selectedLanguage}
                    className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Continue <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Current Level */}
            {step === 4 && (
              <div>
                <h2 className="text-3xl font-bold text-center mb-2">What&apos;s Your Current Level?</h2>
                <p className="text-[#A8A29E] text-center mb-8">Be honest — this helps us start at the right place</p>
                <div className="flex gap-3 justify-center">
                  {levels.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => setSelectedLevel(l.id)}
                      className={`onboarding-card text-center flex-1 max-w-[140px] ${
                        selectedLevel === l.id ? 'selected' : ''
                      }`}
                    >
                      <div className={`text-2xl font-bold mb-1 ${
                        selectedLevel === l.id ? 'text-[#10B981]' : 'text-[#6B7280]'
                      }`}>
                        {l.label}
                      </div>
                      <div className="text-sm font-medium">{l.name}</div>
                      <div className="text-xs text-[#A8A29E] mt-1">{l.desc}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-3 mt-8">
                  <button onClick={() => goTo(3)} className="btn-secondary">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    onClick={() => goTo(5)}
                    disabled={!selectedLevel}
                    className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Continue <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Learning Material */}
            {step === 5 && (
              <div>
                <h2 className="text-3xl font-bold text-center mb-2">Upload Your Learning Material</h2>
                <p className="text-[#A8A29E] text-center mb-8">Upload textbooks, PDFs, audio, or notes</p>

                <div className="onboarding-card text-center p-10 mb-6 border-2 border-dashed border-[rgba(250,248,245,0.08)] hover:border-[rgba(16,185,129,0.3)] transition-all">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4">
                    <Upload size={24} className="text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Drop your files here</h3>
                  <p className="text-sm text-[#A8A29E] mb-4">or click to browse</p>
                  <p className="text-xs text-[#6B7280]">PDF, EPUB, DOCX, MP3, WAV, M4A, TXT</p>
                </div>

                <div className="flex flex-wrap gap-2 justify-center mb-8">
                  {[
                    { icon: BookOpen, label: 'German A1 Textbook' },
                    { icon: Mic, label: 'French Dialogues' },
                    { icon: BookOpen, label: 'Spanish Notes' },
                  ].map((ex) => (
                    <button
                      key={ex.label}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)] text-sm text-[#A8A29E] hover:border-[rgba(16,185,129,0.3)] transition-all"
                    >
                      <ex.icon size={12} className="text-[#10B981]" />
                      {ex.label}
                    </button>
                  ))}
                </div>

                {analyzing ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4 animate-analyze-pulse">
                      <Sparkles size={24} className="text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">Woodpecker is analysing your material...</h3>
                    <p className="text-sm text-[#A8A29E]">Extracting vocabulary, grammar, and patterns</p>
                    <div className="flex justify-center gap-1 mt-4">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse-soft"
                          style={{ animationDelay: `${i * 0.3}s` }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center gap-3">
                    <button onClick={() => goTo(4)} className="btn-secondary">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button onClick={handleAnalyze} className="btn-primary">
                      Analyse My Material <Sparkles size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 6: Learning Style */}
            {step === 6 && (
              <div>
                <h2 className="text-3xl font-bold text-center mb-2">What Would You Like to Improve?</h2>
                <p className="text-[#A8A29E] text-center mb-8">Select all areas you want to focus on</p>
                <div className="grid grid-cols-2 gap-3">
                  {learningStyles.map((s) => {
                    const isSelected = selectedStyles.includes(s.id)
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleStyle(s.id)}
                        className={`onboarding-card flex items-center gap-4 ${
                          isSelected ? 'selected' : ''
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-gradient-to-br from-[#059669] to-[#10B981]'
                            : 'bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)]'
                        }`}>
                          <s.icon size={22} className={isSelected ? 'text-white' : 'text-[#6B7280]'} />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{s.label}</div>
                          <div className="text-sm text-[#A8A29E]">{s.desc}</div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center">
                            <Check size={14} className="text-white" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-center gap-3 mt-8">
                  <button onClick={() => goTo(5)} className="btn-secondary">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={selectedStyles.length === 0}
                    className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Generate My Plan <Sparkles size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 7: Roadmap */}
            {step === 7 && (
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-6">
                  <Trophy size={36} className="text-white" />
                </div>
                <h1 className="text-4xl font-bold mb-3">Your Woodpecker Mastery Plan</h1>
                <p className="text-[#A8A29E] mb-8">
                  We&apos;ve built your personalised learning journey. Here&apos;s your roadmap to fluency.
                </p>

                <div className="glass-card rounded-2xl p-6 mb-8 text-left">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                      <div className="text-2xl font-bold text-gradient">12</div>
                      <div className="text-xs text-[#A8A29E] mt-1">Weeks to fluency</div>
                    </div>
                    <div className="p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                      <div className="text-2xl font-bold text-gradient">96</div>
                      <div className="text-xs text-[#A8A29E] mt-1">Lessons</div>
                    </div>
                    <div className="p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                      <div className="text-2xl font-bold text-gradient">240</div>
                      <div className="text-xs text-[#A8A29E] mt-1">Pattern exercises</div>
                    </div>
                    <div className="p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                      <div className="text-2xl font-bold text-gradient">48</div>
                      <div className="text-xs text-[#A8A29E] mt-1">Speaking sessions</div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <h3 className="text-sm font-semibold">Weekly Milestones</h3>
                    {[
                      { week: 'Week 1-4', label: 'Foundations', desc: 'Core vocabulary and basic patterns' },
                      { week: 'Week 5-8', label: 'Building', desc: 'Grammar structures and longer sentences' },
                      { week: 'Week 9-12', label: 'Fluency', desc: 'Spontaneous speaking and comprehension' },
                    ].map((m) => (
                      <div key={m.week} className="flex items-center gap-3 p-3 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center shrink-0">
                          <Calendar size={14} className="text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{m.week}: {m.label}</div>
                          <div className="text-xs text-[#A8A29E]">{m.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href="/dashboard"
                  className="btn-primary text-base px-8 py-3"
                >
                  Begin Your Journey
                  <ArrowRight size={18} />
                </Link>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
