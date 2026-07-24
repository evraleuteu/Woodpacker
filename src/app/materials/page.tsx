'use client'

import Link from 'next/link'

const materials = [
  {
    id: '1',
    title: 'German A1 Textbook',
    type: 'Book',
    language: 'German',
    status: 'Active',
    progress: 65,
    uploaded: '2 weeks ago',
    stats: { chapters: 12, lessons: 24, vocabulary: 186, grammar: 48, speaking: 48 },
  },
  {
    id: '2',
    title: 'French Dialogue Course',
    type: 'Audio',
    language: 'French',
    status: 'Processing',
    progress: 30,
    uploaded: '3 days ago',
    stats: { chapters: 0, lessons: 6, vocabulary: 94, grammar: 22, speaking: 31 },
  },
  {
    id: '3',
    title: 'Spanish Verb Conjugation Notes',
    type: 'Notes',
    language: 'Spanish',
    status: 'Pending',
    progress: 0,
    uploaded: '1 day ago',
    stats: { chapters: 0, lessons: 8, vocabulary: 67, grammar: 31, speaking: 12 },
  },
]

export default function MaterialsPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Language Materials</h1>
          <p className="text-muted text-sm mt-1">Your uploaded textbooks, courses, and notes.</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-wood-600 hover:bg-wood-500 text-white text-sm font-medium transition-colors"
        >
          ↑ Upload New
        </Link>
      </div>

      <div className="space-y-4">
        {materials.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-border bg-surface p-5 hover:border-wood-500/30 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-surface-lighter flex items-center justify-center text-lg shrink-0">
                  {m.type === 'Book' ? '📚' : m.type === 'Audio' ? '🎵' : '📝'}
                </div>
                <div>
                  <h3 className="font-semibold">{m.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                    <span>{m.type}</span>
                    <span>·</span>
                    <span>{m.language}</span>
                    <span>·</span>
                    <span>Uploaded {m.uploaded}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    m.status === 'Active'
                      ? 'bg-wood-600/20 text-wood-400 border border-wood-600/30'
                      : m.status === 'Processing'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                      : 'bg-amber-600/20 text-amber-400 border border-amber-600/30'
                  }`}
                >
                  {m.status}
                </span>
                <span className="text-sm font-semibold text-wood-400">{m.progress}%</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-surface-lighter mb-4 overflow-hidden">
              <div
                className="h-full rounded-full bg-wood-500 transition-all"
                style={{ width: `${m.progress}%` }}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Lessons', value: m.stats.lessons },
                { label: 'Vocabulary Items', value: m.stats.vocabulary },
                { label: 'Grammar Points', value: m.stats.grammar },
                { label: 'Speaking Prompts', value: m.stats.speaking },
                { label: 'Patterns', value: m.stats.chapters },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-2 rounded-lg bg-surface-lighter">
                  <div className="text-sm font-bold">{stat.value}</div>
                  <div className="text-xs text-muted">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-3 border-t border-border">
              <Link
                href="/speaking"
                className="px-3 py-1.5 rounded-lg bg-wood-600/10 border border-wood-600/20 text-wood-400 text-xs font-medium hover:bg-wood-600/20 transition-colors"
              >
                🎤 Start Speaking
              </Link>
              <Link
                href="/cycles"
                className="px-3 py-1.5 rounded-lg bg-surface-lighter border border-border text-xs text-muted hover:text-foreground transition-colors"
              >
                ⟳ Review Cycles
              </Link>
              <button className="px-3 py-1.5 rounded-lg bg-surface-lighter border border-border text-xs text-muted hover:text-foreground transition-colors">
                📊 Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Knowledge Mastery Premium Teaser */}
      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-600/5 p-4 flex items-center gap-3">
        <span className="text-lg">🧠</span>
        <div>
          <div className="text-sm font-medium">Need to study Medicine, Engineering, or Law?</div>
          <div className="text-xs text-muted">Knowledge Mastery is coming soon as a premium feature.</div>
        </div>
        <span className="text-xs text-amber-400 ml-auto">Mastery Plan</span>
      </div>
    </div>
  )
}