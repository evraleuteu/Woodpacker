'use client'

import Link from 'next/link'

const cycles = [
  {
    id: '1',
    material: 'German A1 Textbook',
    language: 'German',
    cycleNumber: 1,
    durationDays: 30,
    progress: 65,
    status: 'Active',
    startDate: 'Jul 10, 2026',
    endDate: 'Aug 9, 2026',
    pillars: [
      { name: 'Vocabulary', total: 120, completed: 78, mastered: 45 },
      { name: 'Grammar', total: 80, completed: 52, mastered: 30 },
      { name: 'Speaking', total: 48, completed: 22, mastered: 8 },
    ],
  },
  {
    id: '2',
    material: 'French Dialogue Course',
    language: 'French',
    cycleNumber: 1,
    durationDays: 30,
    progress: 30,
    status: 'Active',
    startDate: 'Jul 21, 2026',
    endDate: 'Aug 20, 2026',
    pillars: [
      { name: 'Vocabulary', total: 94, completed: 28, mastered: 15 },
      { name: 'Speaking', total: 31, completed: 8, mastered: 3 },
      { name: 'Listening', total: 22, completed: 6, mastered: 2 },
    ],
  },
]

const cycleProgression = [
  { cycle: 1, duration: '30 Days', support: 'Full audio + transcript + translation + hints', icon: '📖' },
  { cycle: 2, duration: '15 Days', support: 'Audio + keywords only', icon: '📝' },
  { cycle: 3, duration: '7 Days', support: 'Audio only, no transcript', icon: '🎧' },
  { cycle: 4, duration: '3 Days', support: 'Question only, no audio', icon: '💬' },
  { cycle: 5, duration: '1 Day', support: 'Real-world scenario, no hints, full spontaneous', icon: '🎯' },
]

const languageMilestones = [
  { name: 'Pattern: Ich möchte...', language: 'German', status: 'Mastered', score: 96 },
  { name: 'Pattern: Je voudrais...', language: 'French', status: 'In Progress', score: 72 },
  { name: 'Audio Recall: Restaurant', language: 'German', status: 'Cycle 2', score: 88 },
  { name: 'Voice Response: Weekend', language: 'German', status: 'Needs Review', score: 65 },
]

export default function CyclesPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Woodpecker Language Cycles</h1>
        <p className="text-muted text-sm mt-1">
          Each language exercise progresses through five cycles of decreasing support until recall is automatic.
        </p>
      </div>

      {/* Cycle Progression */}
      <div className="rounded-xl border border-border bg-surface p-5 mb-8">
        <h2 className="font-semibold mb-4">How Language Cycles Work</h2>
        <div className="grid grid-cols-5 gap-3">
          {cycleProgression.map((c, i) => (
            <div key={c.cycle} className="text-center p-3 rounded-lg bg-surface-lighter">
              <div className="text-lg mb-1">{c.icon}</div>
              <div className="text-sm font-bold text-wood-400">Cycle {c.cycle}</div>
              <div className="text-xs text-muted mb-1">{c.duration}</div>
              <div className="text-[10px] text-muted leading-tight">{c.support}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Cycles */}
      <h2 className="font-semibold mb-4">Active Language Cycles</h2>
      <div className="space-y-4 mb-8">
        {cycles.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold">{c.material}</h3>
                <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                  <span>{c.language}</span>
                  <span>·</span>
                  <span>Cycle {c.cycleNumber} of 5</span>
                  <span>·</span>
                  <span>{c.durationDays} days</span>
                  <span>·</span>
                  <span>{c.startDate} → {c.endDate}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-wood-600/20 text-wood-400 border border-wood-600/30">
                  Active
                </span>
                <span className="text-sm font-bold text-wood-400">{c.progress}%</span>
              </div>
            </div>

            <div className="w-full h-1.5 rounded-full bg-surface-lighter mb-4 overflow-hidden">
              <div
                className="h-full rounded-full bg-wood-500"
                style={{ width: `${c.progress}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {c.pillars.map((p) => (
                <div key={p.name} className="p-3 rounded-lg bg-surface-lighter">
                  <div className="text-xs text-muted mb-1">{p.name}</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold">{p.completed}/{p.total}</span>
                    <span className="text-wood-400 text-xs">{p.mastered} mastered</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-surface-light mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-wood-500"
                      style={{ width: `${(p.completed / p.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t border-border">
              <Link
                href="/speaking"
                className="px-3 py-1.5 rounded-lg bg-wood-600/10 border border-wood-600/20 text-wood-400 text-xs font-medium hover:bg-wood-600/20 transition-colors"
              >
                🎤 Continue Speaking Practice
              </Link>
              <button className="px-3 py-1.5 rounded-lg bg-surface-lighter border border-border text-xs text-muted hover:text-foreground transition-colors">
                📊 View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Speak Until Mastered Summary */}
      <div className="rounded-xl border border-wood-500/30 bg-wood-600/5 p-5">
        <h3 className="font-semibold text-sm mb-3">🏆 Speak Until Mastered — Language Progress</h3>
        <div className="space-y-2">
          {languageMilestones.map((item) => (
            <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-surface-lighter text-sm">
              <div className="flex items-center gap-2">
                <span>{item.name}</span>
                <span className="text-xs text-muted">({item.language})</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    item.status === 'Mastered'
                      ? 'bg-wood-600/20 text-wood-400'
                      : item.status === 'In Progress' || item.status === 'Cycle 2'
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'bg-amber-600/20 text-amber-400'
                  }`}
                >
                  {item.status}
                </span>
                <span className="text-xs font-medium">{item.score}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Mastery Premium Teaser */}
      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-600/5 p-4 flex items-center gap-3">
        <span className="text-lg">🧠</span>
        <div>
          <div className="text-sm font-medium">Knowledge Mastery Cycles — Coming Soon</div>
          <div className="text-xs text-muted">Adaptive repetition cycles for Medicine, Engineering, Law, and more.</div>
        </div>
        <span className="text-xs text-amber-400 ml-auto">Premium Feature</span>
      </div>
    </div>
  )
}