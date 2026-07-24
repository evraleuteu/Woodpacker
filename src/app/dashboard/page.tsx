'use client'

import { useState } from 'react'
import Link from 'next/link'

const recentMaterials = [
  { id: '1', title: 'German A1 Textbook', type: 'Book', language: 'German', status: 'Active', progress: 65 },
  { id: '2', title: 'French Dialogue Course', type: 'Audio', language: 'French', status: 'Processing', progress: 30 },
]

const todaySession = {
  items: 10,
  completed: 4,
  estimatedMinutes: 20,
  pillars: [
    { name: 'Vocabulary', count: 4, done: 2 },
    { name: 'Speaking', count: 3, done: 1 },
    { name: 'Grammar', count: 3, done: 1 },
  ],
}

const overviewCards = [
  { label: 'Active Languages', value: '2', change: 'German, French', icon: '🌍' },
  { label: 'Vocabulary Items', value: '342', change: '+24 today', icon: '📖' },
  { label: 'Speaking Sessions', value: '8', change: '78% avg score', icon: '🎤' },
  { label: 'Mastery Rate', value: '72%', change: '+5% this week', icon: '📈' },
  { label: 'Study Streak', value: '5 days', change: 'Best: 12 days', icon: '🔥' },
  { label: 'Patterns Mastered', value: '23', change: '4 in progress', icon: '◇' },
]

const recentActivity = [
  { type: 'speaking', label: 'Audio Recall — Restaurant', score: 88, time: '5 min ago' },
  { type: 'vocabulary', label: 'Vocabulary Review — Food', score: 92, time: '15 min ago' },
  { type: 'grammar', label: 'Grammar Drill — Dative Case', score: 75, time: '1 hour ago' },
  { type: 'pattern', label: 'Pattern Mastery — "Ich möchte..."', score: 95, time: '2 hours ago' },
]

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted text-sm mt-1">Your language mastery overview for today.</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-wood-600 hover:bg-wood-500 text-white text-sm font-medium transition-colors"
        >
          ↑ Upload Textbook
        </Link>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {overviewCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="text-lg">{card.icon}</span>
              <span className="text-xs text-muted">{card.change}</span>
            </div>
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="text-xs text-muted mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Today's Session */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Today's Language Session</h2>
            <span className="text-xs text-muted">
              {todaySession.completed}/{todaySession.items} completed
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-lighter mb-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-wood-500 transition-all"
              style={{ width: `${(todaySession.completed / todaySession.items) * 100}%` }}
            />
          </div>

          <div className="space-y-2">
            {todaySession.pillars.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <span className="text-muted">{p.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-surface-lighter overflow-hidden">
                    <div
                      className="h-full rounded-full bg-wood-500"
                      style={{ width: `${(p.done / p.count) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-8 text-right">
                    {p.done}/{p.count}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-border text-xs text-muted">
            Estimated time remaining: {todaySession.estimatedMinutes} min
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Activity</h2>
          </div>

          <div className="space-y-2">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-lighter">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {a.type === 'speaking' ? '🎤' : a.type === 'vocabulary' ? '📖' : a.type === 'grammar' ? '📝' : '◇'}
                  </span>
                  <div>
                    <div className="text-sm">{a.label}</div>
                    <div className="text-xs text-muted">{a.time}</div>
                  </div>
                </div>
                <span className="text-sm font-medium text-wood-400">{a.score}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Materials */}
      <div className="rounded-xl border border-border bg-surface p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Your Language Materials</h2>
          <Link href="/materials" className="text-xs text-wood-400 hover:underline">View all</Link>
        </div>

        <div className="space-y-3">
          {recentMaterials.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-lighter">
              <div className="flex items-center gap-3">
                <span className="text-lg">{m.type === 'Book' ? '📚' : '🎵'}</span>
                <div>
                  <div className="text-sm font-medium">{m.title}</div>
                  <div className="text-xs text-muted mt-0.5">{m.language}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-16 h-1.5 rounded-full bg-surface-light overflow-hidden">
                  <div className="h-full rounded-full bg-wood-500" style={{ width: `${m.progress}%` }} />
                </div>
                <span className="text-sm font-semibold text-wood-400">{m.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          <Link href="/speaking" className="p-3 rounded-lg bg-wood-600/10 border border-wood-600/20 text-center hover:bg-wood-600/20 transition-colors">
            <div className="text-lg mb-1">🎤</div>
            <div className="text-xs font-medium">Speaking Practice</div>
          </Link>
          <Link href="/cycles" className="p-3 rounded-lg bg-surface-lighter border border-border text-center hover:bg-surface-light transition-colors">
            <div className="text-lg mb-1">⟳</div>
            <div className="text-xs font-medium">Review Cycles</div>
          </Link>
          <Link href="/upload" className="p-3 rounded-lg bg-surface-lighter border border-border text-center hover:bg-surface-light transition-colors">
            <div className="text-lg mb-1">↑</div>
            <div className="text-xs font-medium">Upload More</div>
          </Link>
          <Link href="/materials" className="p-3 rounded-lg bg-surface-lighter border border-border text-center hover:bg-surface-light transition-colors">
            <div className="text-lg mb-1">📚</div>
            <div className="text-xs font-medium">Library</div>
          </Link>
        </div>
      </div>
    </div>
  )
}