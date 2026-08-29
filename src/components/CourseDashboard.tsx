'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Network,
  Map as MapIcon,
  ListTree,
  FileText,
  BookMarked,
  Copy,
  GraduationCap,
  Lightbulb,
  Eye,
  Brain,
  Mic,
  Pencil,
  RefreshCw,
  Trophy,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Cpu,
  CheckCircle2,
  GitMerge,
} from 'lucide-react'
import type { Course, Difficulty, Lesson, Module, VocabularyItem } from '@/lib/types'
import { groupFiles } from '@/lib/grouping'
import { roleLabel } from '@/lib/package'

const difficultyColor: Record<Difficulty, string> = {
  beginner: '#10B981',
  intermediate: '#F59E0B',
  advanced: '#EF4444',
}

const difficultyLabel: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border"
      style={{ color: difficultyColor[difficulty], borderColor: `${difficultyColor[difficulty]}44`, background: `${difficultyColor[difficulty]}11` }}
    >
      {difficultyLabel[difficulty]}
    </span>
  )
}

function KnowledgeGraph({ course }: { course: Course }) {
  const layout = useMemo(() => {
    const concepts = course.concepts.slice(0, 48)
    const byId = new Map(concepts.map((c) => [c.id, c]))
    const incoming = new Map<string, Set<string>>()
    for (const edge of course.edges) {
      if (edge.type === 'related') continue
      if (!byId.has(edge.from) || !byId.has(edge.to)) continue
      const set = incoming.get(edge.to) ?? new Set<string>()
      set.add(edge.from)
      incoming.set(edge.to, set)
    }
    const depthOf = new Map<string, number>()
    const computeDepth = (id: string): number => {
      const cached = depthOf.get(id)
      if (cached !== undefined) return cached
      const parents = incoming.get(id) ?? new Set<string>()
      if (!parents.size) {
        depthOf.set(id, 0)
        return 0
      }
      let maxDepth = 0
      for (const p of parents) {
        maxDepth = Math.max(maxDepth, computeDepth(p) + 1)
      }
      depthOf.set(id, maxDepth)
      return maxDepth
    }
    for (const c of concepts) computeDepth(c.id)
    const levels = new Map<number, typeof concepts>()
    for (const c of concepts) {
      const depth = depthOf.get(c.id) ?? 0
      const list = levels.get(depth) ?? []
      list.push(c)
      levels.set(depth, list)
    }
    const rows = [...levels.keys()].sort((a, b) => a - b)
    const rowHeight = 96
    const colGap = 190
    const positions = new Map<string, { x: number; y: number }>()
    const width = Math.max(920, rows.length ? (Math.max(...rows.map((r) => (levels.get(r)?.length ?? 0))) + 1) * colGap : 920)
    const height = Math.max(320, rows.length * rowHeight + 90)
    for (const row of rows) {
      const nodes = levels.get(row) ?? []
      const gap = Math.min(150, (width - 80) / Math.max(nodes.length, 1))
      nodes.forEach((node, i) => {
        positions.set(node.id, { x: 60 + i * gap + gap / 2, y: 70 + row * rowHeight })
      })
    }
    const edges = course.edges.filter((e) => byId.has(e.from) && byId.has(e.to))
    return { positions, edges, width, height }
  }, [course])

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] overflow-x-auto">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-[#E5E7EB]">
        <span className="text-xs text-[#6B7280]">Node color = difficulty</span>
        <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Beginner
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Intermediate
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" /> Advanced
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#6B7280] ml-auto">
          <span className="w-4 h-0.5 bg-[#10B981]" /> Parent
          <span className="w-4 h-0.5 bg-[#F59E0B]" /> Prerequisite
          <span className="w-4 h-0.5 bg-[#3B82F6]" /> Related
        </span>
      </div>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="w-full" style={{ minWidth: 640 }}>
        {layout.edges.map((edge, i) => {
          const from = layout.positions.get(edge.from)
          const to = layout.positions.get(edge.to)
          if (!from || !to) return null
          const color = edge.type === 'parent' ? '#10B981' : edge.type === 'prerequisite' ? '#F59E0B' : '#3B82F6'
          const mx = (from.x + to.x) / 2
          return (
            <path
              key={`${edge.from}-${edge.to}-${i}`}
              d={`M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`}
              fill="none"
              stroke={color}
              strokeOpacity={0.35}
              strokeWidth={1.5}
            />
          )
        })}
        {course.concepts.slice(0, 48).map((c) => {
          const pos = layout.positions.get(c.id)
          if (!pos) return null
          const color = difficultyColor[c.difficulty]
          return (
            <g key={c.id}>
              <circle cx={pos.x} cy={pos.y} r={16} fill={`${color}1f`} stroke={color} strokeWidth={1.5} />
              <circle cx={pos.x} cy={pos.y} r={5} fill={color} />
              <text x={pos.x} y={pos.y + 34} textAnchor="middle" fontSize={11} fill="#A8A29E" className="select-none">
                {c.name.length > 26 ? `${c.name.slice(0, 25)}…` : c.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function LearningPath({ course }: { course: Course }) {
  const steps = course.path.length ? course.path : [{ id: 'root', title: course.title, type: 'module' as const, prerequisites: [] }]
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-2 shrink-0">
          <div
            className={`w-44 rounded-xl p-3 border transition-all ${
              step.type === 'assessment'
                ? 'border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.05)]'
                : step.type === 'review'
                  ? 'border-[#BBF7D0] bg-[#F0FDF4]'
                  : 'rounded-[20px] border border-[#E5E7EB] bg-white shadow-sm'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {step.type === 'assessment' ? (
                <Trophy size={12} className="text-[#F59E0B]" />
              ) : step.type === 'review' ? (
                <RefreshCw size={12} className="text-[#10B981]" />
              ) : (
                <BookOpen size={12} className="text-[#10B981]" />
              )}
              <span className="text-[10px] uppercase tracking-wider text-[#6B7280] font-semibold">{step.type}</span>
            </div>
            <div className="text-xs font-medium text-[#111827] leading-snug">{step.title}</div>
          </div>
          {i < steps.length - 1 && (
            <div className="flex items-center text-[#10B981]">
              <ChevronRight size={16} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function VocabularyRow({ item }: { item: VocabularyItem }) {
  return (
    <div className="p-4 rounded-xl bg-[#FAFBFC] border border-[#E5E7EB]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-[#111827]">{item.term}</span>
        {item.pronunciation && <span className="text-xs text-[#6B7280]">/{item.pronunciation}/</span>}
        <span className="text-[10px] text-[#6B7280] ml-auto">×{item.frequency}</span>
      </div>
      {item.definition && <div className="text-xs text-[#6B7280] mb-2">{item.definition}</div>}
      {item.examples.slice(0, 1).map((ex, i) => (
        <div key={i} className="text-xs text-[#10B981]/80 italic border-l-2 border-[rgba(16,185,129,0.3)] pl-2">
          {ex}
        </div>
      ))}
      {item.synonyms.length > 0 && <div className="text-[11px] text-[#6B7280] mt-1">Synonyms: {item.synonyms.join(', ')}</div>}
    </div>
  )
}

function GrammarCard({ rule }: { rule: Lesson['grammar'][number] }) {
  return (
    <div className="p-4 rounded-xl bg-[#FAFBFC] border border-[#E5E7EB]">
      <div className="flex items-center gap-2 mb-1.5">
        <BookMarked size={14} className="text-[#F59E0B]" />
        <span className="text-sm font-semibold text-[#111827]">{rule.name}</span>
        <DifficultyBadge difficulty={rule.difficulty} />
      </div>
      {rule.explanation && <div className="text-xs text-[#6B7280] mb-2">{rule.explanation}</div>}
      {rule.examples.length > 0 && (
        <div className="space-y-1 mb-2">
          {rule.examples.slice(0, 3).map((ex, i) => (
            <div key={i} className="text-xs text-[#10B981]/80 italic border-l-2 border-[rgba(16,185,129,0.3)] pl-2">
              {ex}
            </div>
          ))}
        </div>
      )}
      {rule.commonMistakes.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-[#EF4444]/80 font-medium">Common mistakes</div>
          {rule.commonMistakes.slice(0, 3).map((m, i) => (
            <div key={i} className="text-xs text-[#EF4444]/70">— {m}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExerciseList({ exercises, accent }: { exercises: Lesson['exercises']; accent?: string }) {
  if (!exercises.length) return <div className="text-xs text-[#6B7280] py-2">No exercises generated for this section.</div>
  return (
    <div className="space-y-2">
      {exercises.map((ex) => (
        <div key={ex.id} className="p-3 rounded-lg bg-[#FAFBFC] border border-[#E5E7EB]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-[#6B7280] font-semibold border border-[#E5E7EB] rounded px-1.5 py-0.5">
              {ex.type}
            </span>
            {accent && <span className="text-[10px] font-medium" style={{ color: accent }}>{accent}</span>}
          </div>
          <div className="text-xs text-[#111827]">{ex.prompt}</div>
          {ex.options && ex.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ex.options.map((opt, i) => (
                <span key={i} className="text-[11px] text-[#6B7280] bg-[#F9FAFB] border border-[#E5E7EB] rounded px-2 py-0.5">
                  {opt}
                </span>
              ))}
            </div>
          )}
          {ex.answer && <div className="text-[11px] text-[#10B981]/70 mt-1">Answer: {ex.answer}</div>}
        </div>
      ))}
    </div>
  )
}

const engineTabs = [
  { id: 'learn', label: 'Learn', icon: Lightbulb, accent: '#10B981' },
  { id: 'understand', label: 'Understand', icon: Eye, accent: '#34D399' },
  { id: 'recall', label: 'Recall', icon: Brain, accent: '#3B82F6' },
  { id: 'speak', label: 'Speak', icon: Mic, accent: '#F59E0B' },
  { id: 'apply', label: 'Apply', icon: Pencil, accent: '#8B5CF6' },
  { id: 'review', label: 'Review', icon: RefreshCw, accent: '#FBBF24' },
  { id: 'master', label: 'Master', icon: Trophy, accent: '#F59E0B' },
] as const

type EngineTabId = (typeof engineTabs)[number]['id']

function LessonDetail({ lesson, module }: { lesson: Lesson; module: Module }) {
  const [tab, setTab] = useState<EngineTabId>('learn')
  const vocabulary = lesson.vocabulary
  const grammar = lesson.grammar
  const exercises = lesson.exercises
  const recall = exercises.filter((e) => e.type === 'recall' || e.type === 'translation')
  const apply = exercises.filter((e) => e.type !== 'recall' && e.type !== 'translation')

  const content: Record<EngineTabId, React.ReactNode> = {
    learn: (
      <div className="space-y-4">
        {lesson.objectives.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Learning objectives</div>
            <ul className="space-y-1">
              {lesson.objectives.map((o, i) => (
                <li key={i} className="text-xs text-[#111827] flex gap-2">
                  <span className="text-[#10B981]">›</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}
        {grammar.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Grammar concepts</div>
            <div className="space-y-2">
              {grammar.map((g) => (
                <div key={g.id} className="p-3 rounded-lg bg-[#FAFBFC] border border-[#E5E7EB]">
                  <div className="text-xs font-semibold text-[#111827] mb-0.5">{g.name}</div>
                  <div className="text-xs text-[#6B7280]">{g.explanation}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {vocabulary.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Core vocabulary ({vocabulary.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {vocabulary.map((v) => (
                <span key={v.id} className="text-[11px] text-[#111827] bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-2.5 py-1">
                  {v.term}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    ),
    understand: (
      <div className="space-y-4">
        {grammar.filter((g) => g.examples.length).length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Demonstrated with examples</div>
            {grammar.filter((g) => g.examples.length).map((g) => (
              <div key={g.id} className="mb-2 p-3 rounded-lg bg-[#FAFBFC] border border-[#E5E7EB]">
                <div className="text-xs font-semibold text-[#111827] mb-1">{g.name}</div>
                {g.examples.slice(0, 3).map((ex, i) => (
                  <div key={i} className="text-xs text-[#10B981]/80 italic pl-2 border-l-2 border-[rgba(16,185,129,0.3)] mb-1">
                    {ex}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {lesson.materials.reading && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Reading</div>
            <div className="p-3 rounded-lg bg-[#FAFBFC] border border-[#E5E7EB]">
              <div className="text-xs font-semibold text-[#111827] mb-1">{lesson.materials.reading.title}</div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{lesson.materials.reading.passage}</p>
            </div>
          </div>
        )}
        {lesson.materials.listening && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Listening transcript</div>
            <div className="p-3 rounded-lg bg-[#FAFBFC] border border-[#E5E7EB]">
              <div className="text-xs font-semibold text-[#111827] mb-1">{lesson.materials.listening.title}</div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{lesson.materials.listening.transcript}</p>
            </div>
          </div>
        )}
        {lesson.materials.solutions && lesson.materials.solutions.content.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Solutions ({lesson.materials.solutions.content.length})</div>
            <div className="space-y-1.5">
              {lesson.materials.solutions.content.map((s, i) => (
                <div key={i} className="text-xs text-[#10B981]/80 border-l-2 border-[rgba(16,185,129,0.3)] pl-2">
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}
        {lesson.materials.teacherNotes && lesson.materials.teacherNotes.content.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Teacher&apos;s notes ({lesson.materials.teacherNotes.content.length})</div>
            <div className="space-y-1.5">
              {lesson.materials.teacherNotes.content.map((n, i) => (
                <div key={i} className="text-xs text-[#6B7280] border-l-2 border-[rgba(245,158,11,0.3)] pl-2">
                  {n}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    ),
    recall: (
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold">Active recall questions</div>
        <ExerciseList exercises={recall.length ? recall : vocabulary.slice(0, 6).map((v, i) => ({ id: `rc-${i}`, type: 'recall', prompt: `What does "${v.term}" mean? Use it in a sentence.`, sourceAssets: [] }))} accent="Active recall" />
      </div>
    ),
    speak: (
      <div className="space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Voice practice</div>
          <ExerciseList
            exercises={lesson.materials.speaking.recalls.map((r, i) => ({ id: `sr-${i}`, type: 'recall', prompt: r, sourceAssets: [] }))}
            accent="Say it aloud"
          />
        </div>
        {lesson.materials.speaking.drills.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Pattern drills</div>
            <ExerciseList exercises={lesson.materials.speaking.drills.map((d, i) => ({ id: `sd-${i}`, type: 'pattern-drill', prompt: d, sourceAssets: [] }))} accent="Drill" />
          </div>
        )}
        {lesson.materials.speaking.roleplays.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Roleplays</div>
            <ExerciseList exercises={lesson.materials.speaking.roleplays.map((r, i) => ({ id: `srp-${i}`, type: 'roleplay', prompt: r, sourceAssets: [] }))} accent="Roleplay" />
          </div>
        )}
      </div>
    ),
    apply: (
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold">Exercises & scenarios</div>
        <ExerciseList exercises={apply.length ? apply : exercises} accent="Apply" />
      </div>
    ),
    review: (
      <div className="space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Spaced repetition — vocabulary</div>
          <div className="flex flex-wrap gap-1.5">
            {vocabulary.map((v) => (
              <span key={v.id} className="text-[11px] text-[#FBBF24] bg-[rgba(245,158,11,0.07)] border border-[rgba(245,158,11,0.2)] rounded-full px-2.5 py-1">
                {v.term}
              </span>
            ))}
          </div>
        </div>
        {module.review && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold mb-2">Module review exercises</div>
            <ExerciseList exercises={module.review.exercises} accent="Review" />
          </div>
        )}
      </div>
    ),
    master: (
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-semibold">Final mastery assessment</div>
        <ExerciseList
          exercises={exercises.length ? exercises : [{ id: 'm0', type: 'assessment', prompt: `Write a paragraph using at least 5 words from this lesson: ${vocabulary.slice(0, 5).map((v) => v.term).join(', ')}.`, sourceAssets: [] }]}
          accent="Mastery"
        />
      </div>
    ),
  }

  return (
    <div className="p-4">
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {engineTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              tab === t.id
                ? 'text-[#1F7A4C] border-[#BBF7D0] bg-[#F0FDF4]'
                : 'text-[#6B7280] border-transparent hover:text-[#111827] hover:bg-[#F9FAFB]'
            }`}
          >
            <t.icon size={12} style={{ color: tab === t.id ? t.accent : undefined }} />
            {t.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {content[tab]}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function ModuleTree({ course }: { course: Course }) {
  const [openModule, setOpenModule] = useState<string | null>(course.modules[0]?.id ?? null)
  const [openLesson, setOpenLesson] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      {course.modules.map((module, mi) => {
        const open = openModule === module.id
        return (
          <div key={module.id} className="rounded-[20px] border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
            <button onClick={() => setOpenModule(open ? null : module.id)} className="w-full flex items-center gap-3 p-4 text-left">
              {open ? <ChevronDown size={16} className="text-[#10B981] shrink-0" /> : <ChevronRight size={16} className="text-[#6B7280] shrink-0" />}
              <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center text-[10px] font-bold text-[#1F7A4C] shrink-0">
                M{mi + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#111827]">{module.title}</div>
                <div className="text-xs text-[#6B7280] truncate">{module.description}</div>
              </div>
              <DifficultyBadge difficulty={module.difficulty} />
              <span className="text-xs text-[#6B7280] shrink-0">{module.lessons.length} lessons</span>
            </button>
            <AnimatePresence>
              {open && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="border-t border-[#E5E7EB] px-4 py-2 space-y-2">
                    {module.lessons.map((lesson, li) => {
                      const lessonOpen = openLesson === lesson.id
                      const attached = course.sourceFiles.filter((f) => lesson.sourceAssets.includes(f.id))
                      const media = attached.filter((f) => f.kind === 'audio' || f.kind === 'video')
                      return (
                        <div key={lesson.id} className="rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] overflow-hidden">
                          <button onClick={() => setOpenLesson(lessonOpen ? null : lesson.id)} className="w-full flex items-center gap-2 p-3 text-left">
                            {lessonOpen ? <ChevronDown size={14} className="text-[#10B981] shrink-0" /> : <ChevronRight size={14} className="text-[#6B7280] shrink-0" />}
                            <span className="text-[10px] text-[#6B7280] w-6 shrink-0">L{li + 1}</span>
                            <span className="text-xs font-medium text-[#111827] flex-1">{lesson.title}</span>
                            {media.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#10B981] shrink-0">
                                {media.length} audio/video
                              </span>
                            )}
                            <DifficultyBadge difficulty={lesson.difficulty} />
                          </button>
                          <AnimatePresence>
                            {lessonOpen && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[#E5E7EB]">
                                <LessonDetail lesson={lesson} module={module} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                    {module.review && (
                      <div className="p-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] flex items-center gap-2">
                        <RefreshCw size={12} className="text-[#10B981]" />
                        <span className="text-xs text-[#6B7280]">{module.review.title}</span>
                        <span className="text-[10px] text-[#6B7280] ml-auto">{module.review.exercises.length} exercises</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

type TabId = 'graph' | 'path' | 'modules' | 'vocabulary' | 'grammar' | 'duplicates'

const tabs: { id: TabId; label: string; icon: typeof Network }[] = [
  { id: 'graph', label: 'Knowledge Graph', icon: Network },
  { id: 'path', label: 'Learning Path', icon: MapIcon },
  { id: 'modules', label: 'Modules & Lessons', icon: ListTree },
  { id: 'vocabulary', label: 'Vocabulary', icon: FileText },
  { id: 'grammar', label: 'Grammar', icon: BookMarked },
  { id: 'duplicates', label: 'Duplicates Merged', icon: GitMerge },
]

export default function CourseDashboard({ course }: { course: Course }) {
  const [tab, setTab] = useState<TabId>('modules')
  const allVocabulary = useMemo(() => {
    const seen = new Set<string>()
    return course.modules.flatMap((m) => m.lessons.flatMap((l) => l.vocabulary)).filter((v) => {
      const key = v.term.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [course])
  const allGrammar = useMemo(() => {
    const seen = new Set<string>()
    return course.modules.flatMap((m) => m.lessons.flatMap((l) => l.grammar)).filter((g) => {
      const key = g.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [course])
  const statItems = [
    { label: 'Modules', value: course.modules.length, icon: ListTree, color: '#10B981' },
    { label: 'Lessons', value: course.stats.lessons, icon: BookOpen, color: '#34D399' },
    { label: 'Concepts', value: course.stats.concepts, icon: Network, color: '#3B82F6' },
    { label: 'Vocabulary', value: course.stats.vocabulary, icon: FileText, color: '#F59E0B' },
    { label: 'Grammar Rules', value: course.stats.grammar, icon: BookMarked, color: '#8B5CF6' },
    { label: 'Exercises', value: course.stats.exercises, icon: GraduationCap, color: '#FBBF24' },
  ]

  const folderGroups = groupFiles(course.sourceFiles)
  const nameOfAsset = (id: string) => course.sourceFiles.find((f) => f.id === id)?.name
  const displayDup = (item: string) => {
    const idx = item.indexOf(':')
    if (idx > 0) {
      const name = nameOfAsset(item.slice(0, idx))
      if (name) return `${name} · ${item.slice(idx + 1)}`
    }
    return item
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center shrink-0">
          <Sparkles size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-[#111827]">{course.title}</h2>
            {course.mode === 'ai' ? (
              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F0FDF4] border border-[rgba(16,185,129,0.3)] text-[#10B981]">
                <Sparkles size={10} /> AI Transformation
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#3B82F6]">
                <Cpu size={10} /> Local Extraction
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B7280] mt-0.5">{course.description}</p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-[#6B7280]">
            {course.language && <span>{course.language}</span>}
            <span>{new Date(course.createdAt).toLocaleString()}</span>
            <span>{folderGroups.length} material(s) · {course.sourceFiles.length} file(s)</span>
          </div>
          {groupFiles(course.sourceFiles).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {groupFiles(course.sourceFiles).map((group) => (
                <span key={group.key} className="text-[10px] px-2 py-0.5 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-[#6B7280]">
                  {group.files[0].role ? `${roleLabel(group.files[0].role)} · ` : ''}
                  {group.display}
                  {group.files.length > 1 ? ` (${group.files.length})` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {statItems.map((stat) => (
          <div key={stat.label} className="text-center p-3 rounded-xl bg-[#FAFBFC] border border-[#E5E7EB]">
            <div className="text-lg font-bold text-gradient">{stat.value}</div>
            <div className="text-[11px] text-[#6B7280] mt-1 flex items-center justify-center gap-1">
              <stat.icon size={10} style={{ color: stat.color }} />
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {course.publishReport && (course.publishReport.cleaned > 0 || course.publishReport.rejected > 0) && (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FBBF24] mb-2">
            <Sparkles size={13} />
            Exercise publish check — {course.publishReport.cleaned + course.publishReport.rejected} of {course.publishReport.extracted} exercises were cleaned or rejected
          </div>
          <p className="text-[11px] text-[#6B7280] mb-2">
            {course.publishReport.published} published · {course.publishReport.cleaned} cleaned · {course.publishReport.rejected} rejected
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(course.publishReport.reasons).map(([reason, count]) => (
              <span key={reason} className="text-[10px] px-2 py-0.5 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-[#6B7280]">
                {reason} × {count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              tab === t.id
                ? 'text-[#1F7A4C] border-[#BBF7D0] bg-[#F0FDF4]'
                : 'text-[#6B7280] border-transparent hover:text-[#111827] hover:bg-[#F9FAFB]'
            }`}
          >
            <t.icon size={13} />
            {t.label}
            {t.id === 'duplicates' && course.duplicates.length > 0 && (
              <span className="text-[10px] bg-[#FFFBEB] text-[#92400E] rounded-full px-1.5">{course.duplicates.length}</span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {tab === 'graph' && <KnowledgeGraph course={course} />}
          {tab === 'path' && <LearningPath course={course} />}
          {tab === 'modules' && <ModuleTree course={course} />}
          {tab === 'vocabulary' && (
            <div>
              <div className="text-xs text-[#6B7280] mb-3">{allVocabulary.length} unique terms across all lessons</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {allVocabulary.map((v) => (
                  <VocabularyRow key={v.id} item={v} />
                ))}
              </div>
            </div>
          )}
          {tab === 'grammar' && (
            <div>
              <div className="text-xs text-[#6B7280] mb-3">{allGrammar.length} unique grammar rules across all lessons</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {allGrammar.map((g) => (
                  <GrammarCard key={g.id} rule={g} />
                ))}
              </div>
            </div>
          )}
          {tab === 'duplicates' && (
            <div className="space-y-3">
              {course.duplicates.length === 0 && (
                <div className="p-6 text-center rounded-xl bg-[#FAFBFC] border border-[#E5E7EB]">
                  <CheckCircle2 size={20} className="text-[#10B981] mx-auto mb-2" />
                  <div className="text-sm text-[#6B7280]">No duplicate content detected across your materials.</div>
                </div>
              )}
              {course.duplicates.map((dup) => (
                <div key={dup.id} className="p-4 rounded-xl bg-[#FAFBFC] border border-[#E5E7EB]">
                  <div className="flex items-center gap-2 mb-2">
                    <GitMerge size={14} className="text-[#F59E0B]" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">{dup.kind}</span>
                    <span className="text-[11px] text-[#6B7280] ml-auto">{dup.items.length} occurrences → 1</span>
                  </div>
                  <div className="text-xs text-[#6B7280] mb-2">{dup.rationale}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {dup.items.map((item, i) => (
                      <span
                        key={i}
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          item === dup.kept
                            ? 'text-[#10B981] border-[rgba(16,185,129,0.3)] bg-[#F0FDF4]'
                            : 'text-[#6B7280] border-[#E5E7EB] bg-[#FAFBFC] line-through'
                        }`}
                      >
                        {displayDup(item)}
                        {item === dup.kept && <span className="ml-1">· kept</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between p-4 rounded-xl bg-[#F0FDF4] border border-[rgba(16,185,129,0.12)]">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={20} className="text-[#10B981]" />
          <div>
            <div className="text-sm font-medium text-[#111827]">Course saved locally</div>
            <div className="text-xs text-[#6B7280]">Open the Woodpecker engine on any lesson to start learning.</div>
          </div>
        </div>
        <Copy size={14} className="text-[#6B7280]" />
      </div>
    </div>
  )
}
