'use client'

import { useState } from 'react'

type SpeakingMode = 'audio-recall' | 'pattern-mastery' | 'voice-response' | null

const modes = [
  {
    id: 'audio-recall' as const,
    title: 'Audio Recall',
    description: 'Listen to audio from your material, then answer questions aloud.',
    icon: '🎧',
    color: 'from-blue-500 to-blue-600',
    exercises: [
      { prompt: 'Anna fährt morgen nach Berlin.', question: 'Wohin fährt Anna?' },
      { prompt: 'Ich hätte gern eine Pizza.', question: 'Was möchte der Kunde?' },
      { prompt: 'Kann ich bitte die Speisekarte sehen?', question: 'Was möchte der Gast?' },
    ],
  },
  {
    id: 'pattern-mastery' as const,
    title: 'Pattern Mastery',
    description: 'Automate reusable sentence structures from your textbook.',
    icon: '◇',
    color: 'from-wood-500 to-wood-600',
    patterns: [
      { pattern: 'Ich möchte...', examples: ['Ich möchte einen Kaffee.', 'Ich möchte Deutsch lernen.', 'Ich möchte nach Berlin fahren.'] },
      { pattern: 'Könnten Sie...', examples: ['Könnten Sie mir helfen?', 'Könnten Sie das wiederholen?', 'Könnten Sie langsamer sprechen?'] },
      { pattern: 'Wenn ich...', examples: ['Wenn ich Zeit habe, lerne ich Deutsch.', 'Wenn ich Geld hätte, würde ich reisen.', 'Wenn ich müde bin, gehe ich schlafen.'] },
    ],
  },
  {
    id: 'voice-response' as const,
    title: 'Voice Response',
    description: 'Answer real-world prompts aloud with AI feedback.',
    icon: '🎤',
    color: 'from-purple-500 to-purple-600',
    prompts: [
      'Was machen Sie normalerweise am Wochenende?',
      'Bestellen Sie Ihr Abendessen in einem Restaurant.',
      'Erzählen Sie mir etwas über Ihre Familie.',
      'Was sind Ihre Hobbys?',
    ],
  },
]

const feedbackExample = {
  pronunciation: 82,
  grammar: 75,
  fluency: 68,
  vocabulary: 80,
  naturalness: 70,
  confidence: 65,
  meaning: 100,
  pattern: 85,
  overall: 76,
}

export default function SpeakingPage() {
  const [activeMode, setActiveMode] = useState<SpeakingMode>(null)
  const [currentExercise, setCurrentExercise] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [mastered, setMastered] = useState(false)
  const [feedback, setFeedback] = useState(false)

  const mode = modes.find((m) => m.id === activeMode)

  const handleSubmit = () => {
    setAttempts((a) => a + 1)
    setFeedback(true)
    if (attempts >= 2) {
      setMastered(true)
    }
  }

  const handleNext = () => {
    if (!mode) return
    if (mode.id === 'audio-recall' && currentExercise < mode.exercises.length - 1) {
      setCurrentExercise((i) => i + 1)
    } else if (mode.id === 'pattern-mastery' && currentExercise < mode.patterns.length - 1) {
      setCurrentExercise((i) => i + 1)
    } else if (mode.id === 'voice-response' && currentExercise < mode.prompts.length - 1) {
      setCurrentExercise((i) => i + 1)
    }
    setAttempts(0)
    setMastered(false)
    setFeedback(false)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Speaking Mastery</h1>
        <p className="text-muted text-sm mt-1">
          Convert passive textbook knowledge into automatic spoken production. Every exercise comes from your learning
          material.
        </p>
      </div>

      {!activeMode ? (
        <>
          {/* Mode Selection */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveMode(m.id)}
                className="rounded-xl border border-border bg-surface p-6 text-left hover:border-wood-500/30 transition-all group"
              >
                <div className="text-3xl mb-3">{m.icon}</div>
                <h3 className="font-semibold mb-1 group-hover:text-wood-400 transition-colors">{m.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{m.description}</p>
              </button>
            ))}
          </div>

          {/* Speak Until Mastered Info */}
          <div className="rounded-xl border border-wood-500/30 bg-wood-600/5 p-5">
            <div className="flex items-start gap-3">
              <span className="text-lg">🏆</span>
              <div>
                <h3 className="font-semibold text-sm mb-1">Speak Until Mastered</h3>
                <p className="text-xs text-muted leading-relaxed">
                  Every speaking exercise requires true mastery before advancing. You repeat until you meet all criteria:
                  Pronunciation ≥ 90%, Grammar ≥ 95%, Fluency ≥ 85%, Meaning 100%.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : mode ? (
        <div>
          {/* Mode Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => { setActiveMode(null); setFeedback(false); setAttempts(0); setMastered(false); setCurrentExercise(0) }}
              className="text-muted hover:text-foreground transition-colors"
            >
              ← Back
            </button>
            <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${mode.color} text-white text-xs font-medium`}>
              {mode.title}
            </div>
            <span className="text-xs text-muted">
              Exercise {currentExercise + 1} of {mode.id === 'audio-recall' ? mode.exercises.length : mode.id === 'pattern-mastery' ? mode.patterns.length : mode.prompts.length}
            </span>
          </div>

          {/* Exercise Card */}
          <div className="rounded-xl border border-border bg-surface p-8 mb-6">
            {mode.id === 'audio-recall' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-xl">🎧</div>
                  <div>
                    <div className="text-xs text-muted">Listen to the audio</div>
                    <div className="text-sm font-medium">Audio Recall Exercise</div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-surface-lighter border border-border mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm">🔊</span>
                    <div className="text-xs text-muted">Audio: {mode.exercises[currentExercise].prompt}</div>
                  </div>
                </div>
                <div className="text-lg font-medium mb-4">{mode.exercises[currentExercise].question}</div>
                <div className="text-xs text-muted mb-6">Say your answer aloud, then submit.</div>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2.5 rounded-xl bg-wood-600 hover:bg-wood-500 text-white text-sm font-medium transition-colors"
                >
                  {attempts === 0 ? 'Submit Answer' : 'Try Again'}
                </button>
              </div>
            )}

            {mode.id === 'pattern-mastery' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-wood-600/20 flex items-center justify-center text-xl">◇</div>
                  <div>
                    <div className="text-xs text-muted">Pattern drill</div>
                    <div className="text-sm font-medium">Pattern Mastery Exercise</div>
                  </div>
                </div>
                <div className="text-sm text-muted mb-2">Complete the sentence pattern:</div>
                <div className="text-2xl font-bold text-wood-400 mb-4">
                  {mode.patterns[currentExercise].pattern}
                </div>
                <div className="space-y-2 mb-6">
                  <div className="text-xs text-muted mb-1">Examples from your textbook:</div>
                  {mode.patterns[currentExercise].examples.map((ex, i) => (
                    <div key={i} className="p-2 rounded-lg bg-surface-lighter text-sm">
                      {ex}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted mb-6">Now create your own sentence using this pattern. Say it aloud.</div>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2.5 rounded-xl bg-wood-600 hover:bg-wood-500 text-white text-sm font-medium transition-colors"
                >
                  {attempts === 0 ? 'Submit Answer' : 'Try Again'}
                </button>
              </div>
            )}

            {mode.id === 'voice-response' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-purple-600/20 flex items-center justify-center text-xl">🎤</div>
                  <div>
                    <div className="text-xs text-muted">Speak freely</div>
                    <div className="text-sm font-medium">Voice Response Exercise</div>
                  </div>
                </div>
                <div className="text-lg font-medium mb-2">AI Prompt:</div>
                <div className="text-xl font-bold mb-4 text-purple-400">{mode.prompts[currentExercise]}</div>
                <div className="text-xs text-muted mb-6">Answer the question aloud. Speak naturally.</div>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2.5 rounded-xl bg-wood-600 hover:bg-wood-500 text-white text-sm font-medium transition-colors"
                >
                  {attempts === 0 ? 'Submit Answer' : 'Try Again'}
                </button>
              </div>
            )}
          </div>

          {/* Feedback */}
          {feedback && (
            <div className="space-y-4 animate-slide-up">
              {/* Score Card */}
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">AI Feedback</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Attempt {attempts}</span>
                    <span className={`text-lg font-bold ${mastered ? 'text-wood-400' : 'text-amber-400'}`}>
                      {mastered ? '✓ Mastered' : `${feedbackExample.overall}%`}
                    </span>
                  </div>
                </div>

                {mastered && (
                  <div className="p-3 rounded-lg bg-wood-600/10 border border-wood-600/20 text-wood-400 text-sm mb-4">
                    🏆 All mastery criteria met! This exercise advances to the next Woodpecker cycle.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Pronunciation', score: feedbackExample.pronunciation, threshold: 90 },
                    { label: 'Grammar', score: feedbackExample.grammar, threshold: 95 },
                    { label: 'Fluency', score: feedbackExample.fluency, threshold: 85 },
                    { label: 'Vocabulary', score: feedbackExample.vocabulary, threshold: 80 },
                    { label: 'Naturalness', score: feedbackExample.naturalness, threshold: 80 },
                    { label: 'Confidence', score: feedbackExample.confidence, threshold: 70 },
                    { label: 'Meaning', score: feedbackExample.meaning, threshold: 100 },
                    { label: 'Pattern Usage', score: feedbackExample.pattern, threshold: 80 },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-2 rounded-lg bg-surface-lighter">
                      <span className="text-xs text-muted">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-surface-light overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.score >= item.threshold ? 'bg-wood-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            item.score >= item.threshold ? 'text-wood-400' : 'text-amber-400'
                          }`}
                        >
                          {item.score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Correction */}
              <div className="rounded-xl border border-border bg-surface p-5">
                <h3 className="font-semibold text-sm mb-3">Corrections</h3>
                <div className="p-3 rounded-lg bg-surface-lighter mb-3">
                  <div className="text-xs text-muted mb-1">You said:</div>
                  <div className="text-sm">Ich spiele Fußball mit meine Freunde.</div>
                </div>
                <div className="p-3 rounded-lg bg-wood-600/10 border border-wood-600/20">
                  <div className="text-xs text-wood-400 mb-1">Correction:</div>
                  <div className="text-sm text-wood-400">Ich spiele Fußball mit meinen Freunden.</div>
                  <div className="text-xs text-muted mt-1">Use the dative case after "mit": mit meinen Freunden.</div>
                </div>
              </div>

              {/* Next / Continue */}
              <div className="flex gap-3">
                {!mastered ? (
                  <button
                    onClick={handleSubmit}
                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors"
                  >
                    ⟳ Practice Again
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="px-6 py-2.5 rounded-xl bg-wood-600 hover:bg-wood-500 text-white text-sm font-medium transition-colors"
                  >
                    Next Exercise →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Woodpecker Cycle Indicator */}
          <div className="mt-6 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted">Woodpecker Speaking Cycle</h3>
              <span className="text-xs text-wood-400">Cycle 1 of 5</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((cycle) => (
                <div
                  key={cycle}
                  className={`flex-1 h-2 rounded-full ${
                    cycle === 1 ? 'bg-wood-500' : 'bg-surface-lighter'
                  }`}
                />
              ))}
            </div>
            <div className="text-xs text-muted mt-2">
              Cycle 1: Full audio + transcript + translation + hints
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}