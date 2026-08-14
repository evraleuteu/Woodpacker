'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Globe,
  Mic,
  Crosshair,
  Brain,
  Upload,
  ChevronRight,
  BookOpen,
  Zap,
  ArrowRight,
} from 'lucide-react'

const pillars = [
  {
    id: 'language',
    title: 'Language Mastery',
    goal: 'Understand the language.',
    icon: Globe,
    gradient: 'from-[#059669] to-[#10B981]',
    features: ['Vocabulary Decks', 'Grammar Decks', 'Reading Decks', 'Listening Decks', 'Pattern Decks'],
    status: 'active' as const,
  },
  {
    id: 'speaking',
    title: 'Speaking Mastery',
    goal: 'Speak automatically without mentally translating.',
    icon: Mic,
    gradient: 'from-[#10B981] to-[#34D399]',
    features: ['Audio Recall', 'Pattern Mastery', 'Voice Response', 'Roleplay', 'Speak Until Mastered'],
    status: 'active' as const,
  },
  {
    id: 'accent',
    title: 'Accent Mastery',
    goal: 'Sound natural.',
    icon: Crosshair,
    gradient: 'from-[#D97706] to-[#F59E0B]',
    features: ['Pronunciation', 'Intonation', 'Rhythm', 'Shadowing', 'Accent Correction'],
    status: 'active' as const,
  },
  {
    id: 'knowledge',
    title: 'Knowledge Mastery',
    goal: 'Long-term retention for any subject.',
    icon: Brain,
    gradient: 'from-[#F59E0B] to-[#F97316]',
    features: ['Medicine', 'Engineering', 'Law', 'Nursing', 'Certifications'],
    status: 'premium' as const,
  },
]

const supportedLanguages = ['German', 'French', 'Spanish', 'Italian', 'English', 'Japanese', 'Chinese', 'Korean', 'Portuguese', 'Russian', 'Arabic', 'Dutch']

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function LandingContent() {
  const mounted = true

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-5xl mx-auto px-8 py-32 md:py-40">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.25)] text-[#10B981] text-xs mb-6"
          >
            <Sparkles size={12} />
            Language Mastery System v2.0
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]"
          >
            Master Languages Through{' '}
            <span className="text-gradient">
              Repetition That Works.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-[#A8A29E] max-w-2xl mb-10 leading-relaxed"
          >
            Upload any language textbook, PDF, audio course, or notes. Woodpecker AI transforms it into a complete
            mastery system for <strong className="text-[#FAF8F5]">Vocabulary, Grammar, Reading, Listening, Speaking, and Accent</strong>.
            Every exercise comes from your own material and repeats through adaptive cycles until you master it.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex gap-4"
          >
            <Link
              href="/onboarding"
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#059669] to-[#10B981] text-white font-medium transition-all duration-200 hover:shadow-[0_0_24px_rgba(16,185,129,0.3)] active:scale-[0.97]"
            >
              Start My Journey
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl glass text-[#FAF8F5] font-medium transition-all duration-200 hover:bg-[rgba(250,248,245,0.05)] hover:border-[rgba(16,185,129,0.3)]"
            >
              View Dashboard
              <ChevronRight size={16} />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-10 flex flex-wrap gap-2"
          >
            <span className="text-xs text-[#6B7280] mr-1">Supported:</span>
            {supportedLanguages.map((lang) => (
              <span
                key={lang}
                className="text-xs px-2 py-0.5 rounded-md bg-[rgba(250,248,245,0.03)] text-[#6B7280] border border-[rgba(250,248,245,0.06)]"
              >
                {lang}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pillars */}
      <section className="max-w-5xl mx-auto px-8 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight mb-4">Three Pillars of Language Mastery</h2>
          <p className="text-lg text-[#A8A29E] max-w-xl mx-auto">
            Every language lesson automatically generates exercises across all three dimensions.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6"
        >
          {pillars.filter(p => p.status === 'active').map((pillar) => (
            <motion.div key={pillar.id} variants={itemVariants}>
              <Link
                href={pillar.id === 'language' ? '/language' : pillar.id === 'speaking' ? '/speaking' : '/accent'}
                className="group block glass rounded-2xl p-8 transition-all duration-200 glass-hover"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center mb-5`}>
                  <pillar.icon size={22} className="text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">{pillar.title}</h3>
                <p className="text-sm text-[#A8A29E] mb-4">{pillar.goal}</p>
                <div className="flex flex-wrap gap-1.5">
                  {pillar.features.map((f) => (
                    <span key={f} className="text-xs px-2 py-1 rounded-md bg-[rgba(250,248,245,0.03)] text-[#6B7280] border border-[rgba(250,248,245,0.06)]">
                      {f}
                    </span>
                  ))}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 rounded-2xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.03)] p-6 flex items-center justify-between"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#F97316] flex items-center justify-center shrink-0">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold">Knowledge Mastery</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.1)] text-[#F59E0B] border border-[rgba(245,158,11,0.3)]">
                  Premium — Coming Soon
                </span>
              </div>
              <p className="text-sm text-[#A8A29E]">
                Medicine, Engineering, Law, Nursing, Certifications, and University courses.
                Transform any textbook into a recall and repetition system.
              </p>
            </div>
          </div>
          <span className="text-[#F59E0B] text-sm font-medium whitespace-nowrap">Mastery Plan →</span>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="border-t border-[rgba(250,248,245,0.06)]">
        <div className="max-w-5xl mx-auto px-8 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold tracking-tight mb-4">How It Works</h2>
            <p className="text-lg text-[#A8A29E]">From uploaded textbook to fluent speaking in five steps.</p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-5 gap-4"
          >
            {[
              { step: '1', label: 'Upload', desc: 'Your textbook, PDF, or audio', icon: Upload },
              { step: '2', label: 'Analyze', desc: 'AI extracts vocabulary, grammar, dialogues', icon: Zap },
              { step: '3', label: 'Generate', desc: 'Exercises for all language skills', icon: Sparkles },
              { step: '4', label: 'Practice', desc: 'Daily Woodpecker sessions', icon: BookOpen },
              { step: '5', label: 'Speak', desc: 'Automatic, without translating', icon: Mic },
            ].map((item) => (
              <motion.div key={item.step} variants={itemVariants} className="text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <item.icon size={20} className="text-white" />
                </div>
                <h4 className="text-base font-semibold mb-1">{item.label}</h4>
                <p className="text-sm text-[#6B7280]">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-[rgba(250,248,245,0.06)]">
        <div className="max-w-5xl mx-auto px-8 py-16">
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: 'Uploaded Materials', value: '0' },
              { label: 'Knowledge Units', value: '0' },
              { label: 'Speaking Sessions', value: '0' },
              { label: 'Mastery Score', value: '--' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-gradient mb-2">{stat.value}</div>
                <div className="text-sm text-[#6B7280]">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
