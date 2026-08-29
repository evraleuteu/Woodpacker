'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  BookOpen,
  FileText,
  Mic,
  Video,
  Image as ImageIcon,
  File as FileIcon,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react'
import type { AssetKind, UploadedAsset } from '@/lib/types'
import { classifyFileRole, type FileRole } from '@/lib/heuristics'
import type { AssetClassification } from '@/lib/classify'

export const ROLE_OPTIONS: { value: FileRole; label: string; hint: string }[] = [
  { value: 'textbook', label: 'Kursbuch — lesson book', hint: 'The main coursebook (spine)' },
  { value: 'workbook', label: 'Übungsbuch — exercise book', hint: 'Exercises / practice book' },
  { value: 'handbook', label: 'Lehrerhandbuch — teacher handbook', hint: 'Teacher manual or Lösungen (answers)' },
  { value: 'reference', label: 'Reference', hint: 'Glossar, Wortschatz, vocabulary lists, grammar extras' },
  { value: 'audio', label: 'Audio track', hint: 'Listening material' },
  { value: 'video', label: 'Video', hint: 'Film / video material' },
  { value: 'image', label: 'Image', hint: 'Picture or graphic' },
  { value: 'other', label: 'Other', hint: 'Anything else' },
]

const KIND_ICONS: Record<AssetKind, typeof FileText> = {
  pdf: BookOpen,
  docx: FileText,
  epub: BookOpen,
  pptx: FileText,
  text: FileText,
  audio: Mic,
  video: Video,
  image: ImageIcon,
  unknown: FileIcon,
}

const KIND_COLORS: Record<AssetKind, string> = {
  pdf: '#059669',
  docx: '#3B82F6',
  epub: '#8B5CF6',
  pptx: '#F59E0B',
  text: '#14B8A6',
  audio: '#10B981',
  video: '#EC4899',
  image: '#F97316',
  unknown: '#6B7280',
}

const LOCKED_ROLES: ReadonlySet<FileRole> = new Set(['audio', 'video', 'image'])

interface RoleReviewProps {
  entries: { file: File; path?: string; kind?: AssetKind; asset?: UploadedAsset }[]
  /** AI classifications by asset id. Missing ids fall back to name heuristics. */
  classifications?: Record<string, AssetClassification> | null
  onConfirm: (roles: Record<string, FileRole>) => void
  onSkip: () => void
  onBack: () => void
}

function confidenceTone(confidence: number): string {
  if (confidence >= 80) return 'bg-[rgba(16,185,129,0.12)] text-[#34D399] border border-[rgba(16,185,129,0.25)]'
  if (confidence >= 55) return 'bg-[rgba(245,158,11,0.12)] text-[#FBBF24] border border-[rgba(245,158,11,0.25)]'
  return 'bg-[rgba(239,68,68,0.12)] text-[#F87171] border border-[rgba(239,68,68,0.25)]'
}

export function RoleReview({ entries, classifications, onConfirm, onSkip, onBack }: RoleReviewProps) {
  const parsed = useMemo(
    () =>
      entries
        .filter((e) => e.asset)
        .map((e) => ({
          id: e.asset!.id,
          name: e.file.name,
          path: e.path ?? '',
          kind: e.asset!.kind,
          asset: e.asset!,
        })),
    [entries]
  )
  const [roles, setRoles] = useState<Record<string, FileRole>>(() => {
    const initial: Record<string, FileRole> = {}
    for (const e of parsed) initial[e.id] = classifications?.[e.id]?.role ?? classifyFileRole(e.asset)
    return initial
  })

  const setRole = (id: string, role: FileRole) => setRoles((prev) => ({ ...prev, [id]: role }))

  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} initial="hidden" animate="visible" className="glass-card rounded-xl p-5">
      <div className="flex items-start gap-2 mb-1">
        <Sparkles size={14} className="text-[#10B981] mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold text-sm">Confirm material classification</h3>
          <p className="text-xs text-[#A8A29E] mt-0.5">
            The AI read each uploaded file and classified what it is below. Correct anything that is wrong — the transformation will use your choices to connect books, audio and video into one learning system.
          </p>
        </div>
      </div>

      <div className="space-y-1.5 mt-4 max-h-[340px] overflow-y-auto pr-1">
        {parsed.map((entry) => {
          const Icon = KIND_ICONS[entry.kind] ?? FileIcon
          const color = KIND_COLORS[entry.kind] ?? '#6B7280'
          const current = roles[entry.id]
          const locked = LOCKED_ROLES.has(current)
          const cls = classifications?.[entry.id]
          const tone = cls ? confidenceTone(cls.confidence) : null
          return (
            <div key={entry.id} className="flex items-center gap-3 p-2 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A`, color }}>
                <Icon size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{entry.name}</div>
                <div className="text-[10px] text-[#6B7280] truncate">
                  {entry.path || entry.kind}
                  {locked && ' · fixed by file type'}
                </div>
                {cls && tone && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[9px] px-1.5 py-px rounded font-medium shrink-0 ${tone}`}>
                      {cls.confidence}% sure
                    </span>
                    {cls.reason && <span className="text-[10px] text-[#6B7280] truncate">{cls.reason}</span>}
                  </div>
                )}
              </div>
              <select
                value={current}
                disabled={locked}
                onChange={(e) => setRole(entry.id, e.target.value as FileRole)}
                className={`shrink-0 max-w-[220px] text-xs rounded-lg px-2 py-1.5 border transition-all ${
                  locked
                    ? 'bg-[rgba(250,248,245,0.02)] text-[#A8A29E] border-transparent cursor-default'
                    : 'bg-[rgba(250,248,245,0.04)] text-[#FAF8F5] border-[rgba(250,248,245,0.1)] hover:border-[rgba(16,185,129,0.4)] cursor-pointer'
                }`}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#1A1915] text-[#FAF8F5]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      {parsed.some((e) => {
        const r = roles[e.id]
        const cls = classifications?.[e.id]
        return !LOCKED_ROLES.has(r) && cls && cls.confidence < 80
      }) && (
        <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-[11px] text-[#6B7280]">
          <AlertTriangle size={12} className="text-[#F59E0B] shrink-0" />
          The AI is uncertain about some files — double-check the books, the Lösungen/Lehrerhandbuch and any ambiguous PDFs.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <button
          onClick={() => onConfirm(roles)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-gradient-to-r from-[#059669] to-[#10B981] text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
        >
          <CheckCircle2 size={14} />
          Confirm & Transform
        </button>
        <button
          onClick={onSkip}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-[rgba(250,248,245,0.04)] border border-[rgba(250,248,245,0.1)] hover:border-[rgba(16,185,129,0.4)] hover:bg-[rgba(16,185,129,0.05)] text-[#A8A29E] transition-all"
        >
          <RotateCcw size={14} className="text-[#10B981]" />
          Skip — trust the AI
        </button>
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-transparent border border-transparent hover:border-[rgba(250,248,245,0.1)] text-[#6B7280] transition-all"
        >
          <ArrowLeft size={14} />
          Back
        </button>
      </div>
      <p className="text-[10px] text-[#6B7280] mt-2">
        <HelpCircle size={10} className="inline mr-1" />
        Skip gives the AI full confidence in its own content-based classification. Audio, video and images are fixed by their file type.
      </p>
    </motion.div>
  )
}
