'use client'

import { FileText, HelpCircle, Zap, Trophy, Globe, BookOpen, Volume2, Mic, Code, type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

interface ExerciseMetadata {
  xp?: number
  practice?: string
  difficulty?: string
  locale?: string
  lessonTitle?: string
  requiredAudio?: string[]
  requiredVideo?: string[]
}

interface ExerciseData {
  exerciseType: string
  page: number
  prompt: string
  instructions?: string
  blanks?: Array<{ text: string; expected?: string[] }>
  options?: string[]
  answer?: string
  metadata: ExerciseMetadata
}

interface ExerciseViewerProps {
  exercise: ExerciseData
}

export function ExerciseViewer({ exercise }: ExerciseViewerProps) {
  const renderBlanks = () => {
    if (!exercise.blanks || exercise.blanks.length === 0) return null
    return (
      <div className="space-y-2">
        <h5 className="font-medium text-[#FAF8F5] flex items-center gap-2">
          <HelpCircle size={16} />
          Blanks
        </h5>
        <div className="space-y-1 ml-4">
          {exercise.blanks.map((blank, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-[rgba(250,248,245,0.02)] rounded-lg border border-[rgba(250,248,245,0.06)]">
              <span className="text-xs text-[#6B7280] font-mono w-16">Blank {i + 1}</span>
              <span className="flex-1 text-[#FAF8F5]">{blank.text || '(empty)'}</span>
              {blank.expected && blank.expected.length > 0 && (
                <span className="text-xs text-[#10B981] font-mono">
                  Expected: {blank.expected.join(', ')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderOptions = () => {
    if (!exercise.options || exercise.options.length === 0) return null
    return (
      <div className="space-y-2">
        <h5 className="font-medium text-[#FAF8F5] flex items-center gap-2">
          <Code size={16} />
          Options
        </h5>
        <div className="space-y-1 ml-4">
          {exercise.options.map((opt: string, i: number) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-[rgba(250,248,245,0.02)] rounded-lg border border-[rgba(250,248,245,0.06)]">
              <span className="w-6 text-center text-[#6B7280] font-mono">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1 text-[#FAF8F5]">{opt}</span>
              {exercise.answer === opt && (
                <span className="text-[#10B981]">✓ Correct</span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          exercise.exerciseType.includes('choice') ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30' :
          exercise.exerciseType.includes('blank') ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30' :
          exercise.exerciseType.includes('translation') || exercise.exerciseType.includes('completion') ? 'bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/30' :
          exercise.exerciseType.includes('speak') || exercise.exerciseType.includes('roleplay') ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30' :
          exercise.exerciseType.includes('listen') ? 'bg-[#EC4899]/20 text-[#EC4899] border border-[#EC4899]/30' :
          'bg-[#6B7280]/20 text-[#6B7280] border border-[#6B7280]/30'
        }`}>
          {exercise.exerciseType}
        </span>
        <span className="text-xs text-[#A8A29E] flex items-center gap-1">
          <FileText size={10} />
          Page {exercise.page}
        </span>
        <span className="text-xs text-[#A8A29E] flex items-center gap-1">
          <Trophy size={10} />
          {exercise.metadata?.xp || 0} XP
        </span>
        <span className="text-xs text-[#A8A29E] flex items-center gap-1">
          <Zap size={10} />
          {exercise.metadata?.practice}
        </span>
        {exercise.metadata?.difficulty && (
          <span className="text-xs text-[#A8A29E] flex items-center gap-1">
            <Zap size={10} />
            {exercise.metadata.difficulty}
          </span>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="p-4 bg-[rgba(250,248,245,0.02)] rounded-xl border border-[rgba(250,248,245,0.06)]">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-[#8B5CF6]" />
            <h4 className="font-medium text-[#FAF8F5]">Prompt</h4>
          </div>
          <p className="text-[#FAF8F5] whitespace-pre-wrap ml-6">{exercise.prompt}</p>
        </div>

        {exercise.instructions && (
          <div className="p-4 bg-[rgba(16,185,129,0.05)] rounded-xl border border-[rgba(16,185,129,0.1)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#10B981]">ℹ</span>
              <h4 className="font-medium text-[#10B981]">Explanation / Hint</h4>
            </div>
            <p className="text-[#FAF8F5] whitespace-pre-wrap ml-6">{exercise.instructions}</p>
          </div>
        )}

        {renderBlanks()}
        {renderOptions()}

        {exercise.answer && (
          <div className="p-4 bg-[rgba(16,185,129,0.05)] rounded-xl border border-[rgba(16,185,129,0.1)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#10B981]">✓</span>
              <h4 className="font-medium text-[#10B981]">Expected Answer</h4>
            </div>
            <pre className="ml-6 text-[#10B981] whitespace-pre-wrap font-mono text-sm">{exercise.answer}</pre>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetadataCard icon={Globe} label="Locale" value={exercise.metadata?.locale || 'de-DE'} />
          <MetadataCard icon={BookOpen} label="Lesson" value={exercise.metadata?.lessonTitle || 'N/A'} />
          <MetadataCard icon={Volume2} label="Audio Required" value={exercise.metadata?.requiredAudio?.length || 0} />
          <MetadataCard icon={Mic} label="Video Required" value={exercise.metadata?.requiredVideo?.length || 0} />
        </div>

        <div className="pt-4 border-t border-[rgba(250,248,245,0.06)]">
          <h5 className="font-medium text-[#FAF8F5] mb-2 flex items-center gap-2">
            <Code size={16} />
            Metadata
          </h5>
          <pre className="bg-[#0C0C0C] p-4 rounded-lg border border-[rgba(250,248,245,0.06)] text-xs text-[#A8A29E] overflow-x-auto max-h-64">
            {JSON.stringify(exercise.metadata, null, 2)}
          </pre>
        </div>
      </motion.div>
    </div>
  )
}

function MetadataCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="p-3 bg-[rgba(250,248,245,0.02)] rounded-lg border border-[rgba(250,248,245,0.06)]">
      <div className="flex items-center gap-2 text-xs text-[#A8A29E] mb-1">
        <Icon size={12} />
        {label}
      </div>
      <p className="font-mono text-[#FAF8F5]">{value}</p>
    </div>
  )
}