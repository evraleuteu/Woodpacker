'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

const pillars = [
  {
    id: 'language',
    title: 'Language Mastery',
    goal: 'Understand the language.',
    icon: '🌍',
    color: 'from-blue-500 to-blue-700',
    features: ['Vocabulary Decks', 'Grammar Decks', 'Reading Decks', 'Listening Decks', 'Pattern Decks'],
    status: 'active',
  },
  {
    id: 'speaking',
    title: 'Speaking Mastery',
    goal: 'Speak automatically without mentally translating.',
    icon: '🎤',
    color: 'from-wood-500 to-wood-700',
    features: ['Audio Recall', 'Pattern Mastery', 'Voice Response', 'Roleplay', 'Speak Until Mastered'],
    status: 'active',
  },
  {
    id: 'accent',
    title: 'Accent Mastery',
    goal: 'Sound natural.',
    icon: '🎯',
    color: 'from-purple-500 to-purple-700',
    features: ['Pronunciation', 'Intonation', 'Rhythm', 'Shadowing', 'Accent Correction'],
    status: 'active',
  },
  {
    id: 'knowledge',
    title: 'Knowledge Mastery',
    goal: 'Long-term retention for any subject.',
    icon: '🧠',
    color: 'from-amber-500 to-amber-700',
    features: ['Medicine', 'Engineering', 'Law', 'Nursing', 'Certifications'],
    status: 'premium',
  },
]

const supportedLanguages = ['German', 'French', 'Spanish', 'Italian', 'English', 'Japanese', 'Chinese', 'Korean', 'Portuguese', 'Russian', 'Arabic', 'Dutch']

const stats = [
  { label: 'Uploaded Materials', value: '0' },
  { label: 'Knowledge Units', value: '0' },
  { label: 'Speaking Sessions', value: '0' },
  { label: 'Mastery Score', value: '--' },
]

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-wood-900/20 via-transparent to-blue-900/20" />
        <div className="relative max-w-5xl mx-auto px-8 py-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-wood-600/10 border border-wood-600/30 text-wood-400 text-xs mb-6">
            <span className="w-2 h-2 rounded-full bg-wood-400 animate-pulse-soft" />
            Language Mastery System v1.0
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            From Textbook to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-wood-400 to-wood-300">
              Fluent Speech.
            </span>
          </h1>
          <p className="text-lg text-muted max-w-2xl mb-8 leading-relaxed">
            Upload any language textbook, PDF, audio course, or notes. Woodpecker AI transforms it into a complete
            mastery system for <strong className="text-foreground">Vocabulary, Grammar, Reading, Listening, Speaking, and Accent</strong>.
            Every exercise comes from your own material and repeats through adaptive cycles until you master it.
          </p>
          <div className="flex gap-4">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-wood-600 hover:bg-wood-500 text-white font-medium transition-colors"
            >
              ↑ Upload Your Textbook
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface-lighter hover:bg-surface-light text-foreground font-medium transition-colors border border-border"
            >
              View Dashboard
            </Link>
          </div>

          {/* Supported languages */}
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="text-xs text-muted mr-1">Supported:</span>
            {supportedLanguages.map((lang) => (
              <span key={lang} className="text-xs px-2 py-0.5 rounded-md bg-surface-lighter text-muted border border-border">
                {lang}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="max-w-5xl mx-auto px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold mb-2">Three Pillars of Language Mastery</h2>
          <p className="text-muted">Every language lesson automatically generates exercises across all three dimensions.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {pillars.filter(p => p.status === 'active').map((pillar) => (
            <div
              key={pillar.id}
              className="rounded-2xl border border-border bg-surface p-6 transition-all hover:scale-[1.02]"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">{pillar.icon}</span>
              </div>
              <h3 className="text-lg font-bold mb-1">{pillar.title}</h3>
              <p className="text-sm text-muted mb-3">{pillar.goal}</p>
              <div className="flex flex-wrap gap-1.5">
                {pillar.features.map((f) => (
                  <span key={f} className="text-xs px-2 py-1 rounded-md bg-surface-lighter text-muted">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Knowledge Mastery Premium */}
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-600/5 p-6 flex items-center justify-between">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🧠</span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold">Knowledge Mastery</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-400 border border-amber-600/30">
                  Premium — Coming Soon
                </span>
              </div>
              <p className="text-sm text-muted">
                Medicine, Engineering, Law, Nursing, Certifications, and University courses.
                Transform any textbook into a recall and repetition system.
              </p>
            </div>
          </div>
          <span className="text-amber-400 text-sm font-medium whitespace-nowrap">Mastery Plan →</span>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-2">How It Works</h2>
            <p className="text-muted">From uploaded textbook to fluent speaking in five steps.</p>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {[
              { step: '1', label: 'Upload', desc: 'Your textbook, PDF, or audio' },
              { step: '2', label: 'Analyze', desc: 'AI extracts vocabulary, grammar, dialogues' },
              { step: '3', label: 'Generate', desc: 'Exercises for all language skills' },
              { step: '4', label: 'Practice', desc: 'Daily Woodpecker sessions' },
              { step: '5', label: 'Speak', desc: 'Automatic, without translating' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-wood-600/20 border border-wood-600/30 text-wood-400 flex items-center justify-center mx-auto mb-3 text-sm font-bold">
                  {item.step}
                </div>
                <h4 className="text-sm font-semibold mb-1">{item.label}</h4>
                <p className="text-xs text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-8 py-12">
          <div className="grid grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-wood-400">{stat.value}</div>
                <div className="text-xs text-muted mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}