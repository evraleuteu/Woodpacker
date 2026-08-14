'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  Diamond,
  Headphones,
  Trophy,
  ArrowLeft,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Zap,
  Volume2,
} from 'lucide-react'

type SpeakingMode = 'audio-recall' | 'pattern-mastery' | 'voice-response' | null

const modes = [
  {
    id: 'audio-recall' as const,
    title: 'Audio Recall',
    description: 'Listen, comprehend, respond aloud.',
    icon: Headphones,
    gradient: 'from-[#059669] to-[#10B981]',
    tag: 'Listening & Speaking',
    exercises: [
      { prompt: 'Anna fährt morgen nach Berlin.', question: 'Wohin fährt Anna?' },
      { prompt: 'Ich hätte gern eine Pizza.', question: 'Was möchte der Kunde?' },
      { prompt: 'Kann ich bitte die Speisekarte sehen?', question: 'Was möchte der Gast?' },
    ],
  },
  {
    id: 'pattern-mastery' as const,
    title: 'Pattern Mastery',
    description: 'Automate sentence structures until they feel natural.',
    icon: Diamond,
    gradient: 'from-[#10B981] to-[#34D399]',
    tag: 'Grammar & Structure',
    patterns: [
      { pattern: 'Ich möchte...', examples: ['Ich möchte einen Kaffee.', 'Ich möchte Deutsch lernen.', 'Ich möchte nach Berlin fahren.'] },
      { pattern: 'Könnten Sie...', examples: ['Könnten Sie mir helfen?', 'Könnten Sie das wiederholen?', 'Könnten Sie langsamer sprechen?'] },
      { pattern: 'Wenn ich...', examples: ['Wenn ich Zeit habe, lerne ich Deutsch.', 'Wenn ich Geld hätte, würde ich reisen.', 'Wenn ich müde bin, gehe ich schlafen.'] },
    ],
  },
  {
    id: 'voice-response' as const,
    title: 'Conversation Simulation',
    description: 'AI tutor speaks. You respond naturally. Get instant feedback.',
    icon: MessageSquare,
    gradient: 'from-[#D97706] to-[#F59E0B]',
    tag: 'Free Speaking',
    prompts: [
      'Was machen Sie normalerweise am Wochenende?',
      'Bestellen Sie Ihr Abendessen in einem Restaurant.',
      'Erzählen Sie mir etwas über Ihre Familie.',
      'Was sind Ihre Hobbys?',
    ],
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function SpeakingPage() {
  const [activeMode, setActiveMode] = useState<SpeakingMode>(null)
  const [currentExercise, setCurrentExercise] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [mastered, setMastered] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [hasAnswered, setHasAnswered] = useState(false)

  const mode = modes.find((m) => m.id === activeMode)

  const handleSubmit = () => {
    setHasAnswered(true)
    setAttempts((a) => a + 1)
    setShowFeedback(true)
    if (attempts >= 1) {
      setMastered(true)
    }
  }

  const handleRetry = () => {
    setShowFeedback(false)
    setMastered(false)
  }

  const handleNext = () => {
    if (!mode) return
    const length = mode.id === 'audio-recall' ? mode.exercises.length
      : mode.id === 'pattern-mastery' ? mode.patterns.length
      : mode.prompts.length
    if (currentExercise < length - 1) {
      setCurrentExercise((i) => i + 1)
    }
    setAttempts(0)
    setMastered(false)
    setShowFeedback(false)
    setHasAnswered(false)
  }

  const handleBack = () => {
    setActiveMode(null)
    setShowFeedback(false)
    setAttempts(0)
    setMastered(false)
    setCurrentExercise(0)
    setHasAnswered(false)
  }

  const getLength = () => {
    if (!mode) return 0
    if (mode.id === 'audio-recall') return mode.exercises.length
    if (mode.id === 'pattern-mastery') return mode.patterns.length
    return mode.prompts.length
  }

  const feedbackCriteria = [
    { label: 'Pronunciation', score: 82, threshold: 85 },
    { label: 'Grammar', score: 75, threshold: 80 },
    { label: 'Fluency', score: 68, threshold: 75 },
    { label: 'Vocabulary', score: 80, threshold: 80 },
    { label: 'Naturalness', score: 70, threshold: 75 },
  ]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight">Speaking Mastery</h1>
        <p className="text-[#A8A29E] text-sm mt-1">
          Convert passive knowledge into automatic spoken production.
        </p>
      </motion.div>

      {!activeMode ? (
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4 mb-8">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveMode(m.id)}
                className="group glass-card rounded-xl p-6 text-left"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.gradient} flex items-center justify-center mb-4`}>
                  <m.icon size={22} className="text-white" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-[#6B7280] font-medium">{m.tag}</span>
                <h3 className="font-semibold mt-1 mb-1 group-hover:text-[#10B981] transition-colors">{m.title}</h3>
                <p className="text-xs text-[#A8A29E] leading-relaxed">{m.description}</p>
              </button>
            ))}
          </motion.div>

          <motion.div variants={itemVariants} className="rounded-xl border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.03)] p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center shrink-0">
                <Trophy size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Speak Until Mastered</h3>
                <p className="text-xs text-[#A8A29E] leading-relaxed">
                  Every exercise requires true mastery before advancing. Instant retry with no punishment — only progress.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : mode ? (
        <div>
          {/* Exercise Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-6"
          >
            <button onClick={handleBack} className="text-[#6B7280] hover:text-[#FAF8F5] transition-colors p-1">
              <ArrowLeft size={18} />
            </button>
            <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${mode.gradient} text-white text-xs font-medium`}>
              {mode.title}
            </div>
            <span className="text-xs text-[#6B7280]">
              Exercise {currentExercise + 1} of {getLength()}
            </span>
            <div className="flex-1" />
            <div className="flex items-center gap-1 text-xs text-[#6B7280]">
              {[1, 2, 3, 4, 5].map((c) => (
                <div
                  key={c}
                  className={`w-6 h-1.5 rounded-full ${
                    c === 1 ? 'bg-[#10B981]' : 'bg-[rgba(250,248,245,0.06)]'
                  }`}
                />
              ))}
              <span className="ml-1">Cycle 1/5</span>
            </div>
          </motion.div>

          {/* Exercise Card */}
          <motion.div
            key={currentExercise}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="glass-card rounded-xl p-8 mb-6"
          >
            {mode.id === 'audio-recall' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center">
                    <Volume2 size={24} className="text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Step 1: Listen</div>
                    <div className="text-sm font-medium">Audio Recall Exercise</div>
                  </div>
                </div>
                <div className="p-5 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-[rgba(16,185,129,0.1)] flex items-center justify-center">
                      <Headphones size={16} className="text-[#10B981]" />
                    </div>
                    <div>
                      <div className="text-xs text-[#6B7280]">Playing audio from your textbook</div>
                      <div className="text-sm font-medium text-[#A8A29E]">{mode.exercises[currentExercise].prompt}</div>
                    </div>
                  </div>
                </div>
                <div className="text-xl font-bold mb-3">{mode.exercises[currentExercise].question}</div>
                <p className="text-sm text-[#A8A29E] mb-6">Say your answer aloud, then tap submit.</p>

                {!hasAnswered ? (
                  <button onClick={handleSubmit} className="btn-primary">
                    <Mic size={16} />
                    Submit Answer
                  </button>
                ) : (
                  <div className="flex gap-3">
                    {!mastered ? (
                      <button onClick={handleRetry} className="btn-primary">
                        <RefreshCw size={16} />
                        Practice Again
                      </button>
                    ) : (
                      <button onClick={handleNext} className="btn-primary">
                        Next Exercise
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode.id === 'pattern-mastery' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#10B981] to-[#34D399] flex items-center justify-center">
                    <Zap size={24} className="text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Step 2: Pattern Drill</div>
                    <div className="text-sm font-medium">Pattern Mastery Exercise</div>
                  </div>
                </div>
                <div className="text-sm text-[#A8A29E] mb-2">Complete the sentence pattern:</div>
                <div className="text-3xl font-bold text-gradient mb-6">
                  {mode.patterns[currentExercise].pattern}
                </div>
                <div className="space-y-2 mb-6">
                  <div className="text-xs text-[#A8A29E] mb-2">Examples from your textbook:</div>
                  {mode.patterns[currentExercise].examples.map((ex, i) => (
                    <div key={i} className="p-3 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-sm flex items-center gap-2">
                      <Diamond size={10} className="text-[#10B981] shrink-0" />
                      {ex}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-[#A8A29E] mb-6">Now create your own sentence using this pattern. Say it aloud.</p>

                {!hasAnswered ? (
                  <button onClick={handleSubmit} className="btn-primary">
                    <Mic size={16} />
                    Submit Answer
                  </button>
                ) : (
                  <div className="flex gap-3">
                    {!mastered ? (
                      <button onClick={handleRetry} className="btn-primary">
                        <RefreshCw size={16} />
                        Practice Again
                      </button>
                    ) : (
                      <button onClick={handleNext} className="btn-primary">
                        Next Exercise
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode.id === 'voice-response' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D97706] to-[#F59E0B] flex items-center justify-center">
                    <MessageSquare size={24} className="text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Step 3: Free Conversation</div>
                    <div className="text-sm font-medium">AI Conversation Simulation</div>
                  </div>
                </div>
                <div className="p-5 rounded-xl bg-[rgba(245,158,11,0.04)] border border-[rgba(245,158,11,0.15)] mb-6">
                  <div className="text-xs text-[#F59E0B] mb-2">AI Tutor says:</div>
                  <div className="text-xl font-bold text-gradient-gold">{mode.prompts[currentExercise]}</div>
                </div>
                <p className="text-sm text-[#A8A29E] mb-6">Respond naturally. The AI will evaluate your pronunciation, grammar, and fluency.</p>

                {!hasAnswered ? (
                  <button onClick={handleSubmit} className="btn-gold">
                    <Mic size={16} />
                    Start Speaking
                  </button>
                ) : (
                  <div className="flex gap-3">
                    {!mastered ? (
                      <button onClick={handleRetry} className="btn-gold">
                        <RefreshCw size={16} />
                        Try Again
                      </button>
                    ) : (
                      <button onClick={handleNext} className="btn-gold">
                        Next Exercise
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Feedback Panel */}
          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Mastered Banner */}
                {mastered && (
                  <div className="rounded-xl bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] p-4 flex items-center gap-3">
                    <Trophy size={20} className="text-[#10B981]" />
                    <div>
                      <div className="font-semibold text-[#10B981]">Exercise Mastered!</div>
                      <div className="text-xs text-[#A8A29E]">This exercise advances to the next Woodpecker cycle.</div>
                    </div>
                    <span className="ml-auto text-xs bg-[rgba(16,185,129,0.15)] text-[#10B981] px-2 py-1 rounded-full font-medium">
                      +30 XP
                    </span>
                  </div>
                )}

                {/* Feedback Grid */}
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm">AI Feedback</h3>
                    <div className="text-xs text-[#6B7280]">Attempt {attempts}/3</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {feedbackCriteria.map((item) => {
                      const passed = item.score >= item.threshold
                      return (
                        <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(250,248,245,0.02)]">
                          <div className="flex items-center gap-2">
                            {passed ? (
                              <CheckCircle2 size={14} className="text-[#10B981]" />
                            ) : (
                              <XCircle size={14} className="text-[#6B7280]" />
                            )}
                            <span className="text-xs text-[#A8A29E]">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 progress-bar h-1.5">
                              <div
                                className={passed ? 'progress-bar-fill-success' : 'progress-bar-fill'}
                                style={{ width: `${item.score}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${passed ? 'text-[#10B981]' : 'text-[#A8A29E]'}`}>
                              {item.score}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Correction */}
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-semibold text-sm mb-3">Correction</h3>
                  <div className="p-3 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] mb-2">
                    <div className="text-xs text-[#6B7280] mb-1">You said:</div>
                    <div className="text-sm">Ich spiele Fußball mit meine Freunde.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.15)]">
                    <div className="text-xs text-[#10B981] mb-1">Correction:</div>
                    <div className="text-sm text-[#10B981]">Ich spiele Fußball mit meinen Freunden.</div>
                    <div className="text-xs text-[#6B7280] mt-1">Use the dative case after &quot;mit&quot;: mit meinen Freunden.</div>
                  </div>
                </div>

                {/* Retry / Next */}
                <div className="flex gap-3">
                  {!mastered ? (
                    <button onClick={handleRetry} className="btn-primary">
                      <RefreshCw size={14} />
                      Practice Again
                    </button>
                  ) : (
                    <button onClick={handleNext} className="btn-primary">
                      Next Exercise
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  )
}
