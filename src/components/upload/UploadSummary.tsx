'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Folder,
  FileText,
  Mic,
  Video,
  Image as ImageIcon,
  File as FileIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  BookOpen,
  HelpCircle,
} from 'lucide-react'
import type { AssetKind, UploadedAsset, JobPhase } from '@/lib/types'
import { FileNode, buildFileTree } from './DirectoryTree'

const phasesList: { id: JobPhase; label: string; desc: string }[] = [
  { id: 'queued', label: 'Queued', desc: 'Waiting to start' },
  { id: 'content-discovery', label: 'Content Discovery', desc: 'Extracting chapters, vocabulary, grammar and objectives' },
  { id: 'structure-reconstruction', label: 'Course Structure', desc: 'Rebuilding modules and lessons' },
  { id: 'knowledge-graph', label: 'Knowledge Graph', desc: 'Linking concepts with prerequisites' },
  { id: 'duplicate-detection', label: 'Duplicate Detection', desc: 'Merging duplicate lessons and vocabulary' },
  { id: 'material-generation', label: 'Material Generation', desc: 'Creating cards, grammar and exercises' },
  { id: 'dependency-mapping', label: 'Dependency Mapping', desc: 'Determining learning order' },
  { id: 'master-tree', label: 'Master Learning Tree', desc: 'Assembling the course' },
]

interface UploadSummaryProps {
  entries: { file: File; path?: string; kind?: AssetKind; asset?: UploadedAsset; status?: FileNode['status']; reused?: boolean }[]
  onStartTransform: () => void
  disabled?: boolean
  stage: 'idle' | 'parsing' | 'starting' | 'transforming' | 'done' | 'error'
  job?: { phase: JobPhase; progress: number; message: string; detail: string }
}

const KIND_LABELS: Record<AssetKind, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  epub: 'EPUB',
  pptx: 'PPTX',
  text: 'Text',
  audio: 'Audio',
  video: 'Video',
  image: 'Image',
  unknown: 'Unknown',
}

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

const MATERIAL_LABELS: Record<string, string> = {
  textbook: 'Course Books',
  workbook: 'Workbooks',
  'teacher-handbook': 'Teacher Handbooks',
  reference: 'Reference Materials',
  audio: 'Audio Files',
  video: 'Video Files',
  image: 'Images',
  other: 'Other Files',
}

export function UploadSummary({ entries, onStartTransform, disabled, stage, job }: UploadSummaryProps) {
  const tree = buildFileTree(entries)

  const folderCount = countNodes(tree, true)
  const fileCount = countNodes(tree, false)

  const kindCounts = countByKind(tree)
  const materialCounts = countByMaterial(tree)

  const hasTextbook = (materialCounts.textbook ?? 0) > 0
  const hasWorkbook = (materialCounts.workbook ?? 0) > 0

  const packageConfidence = calculatePackageConfidence(materialCounts)

  const allParsed = entries.every((e) => e.status === 'ok' || e.status === 'empty')
  const anyFailed = entries.some((e) => e.status === 'failed')
  const anyParsing = entries.some((e) => e.status === 'parsing')
  const reusedCount = entries.filter((e) => e.reused).length

  const validationChecks = [
    { label: 'Folder structure scanned', pass: folderCount >= 0 },
    { label: 'Files indexed', pass: fileCount > 0 },
    { label: 'Metadata extracted', pass: allParsed && !anyParsing },
    { label: 'Structure reconstructed', pass: true },
    { label: 'No corrupted files', pass: !anyFailed },
    { label: 'Course package detected', pass: hasTextbook || hasWorkbook },
  ]

  const allChecksPass = validationChecks.every((c) => c.pass)
  const [confirmTransform, setConfirmTransform] = useState(false)

  const failedChecks = validationChecks.filter((c) => !c.pass)

  return (
    <motion.div className="space-y-6">
      <motion.div className="glass-card rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <Sparkles size={14} className="text-[#10B981]" />
          Upload Summary
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Folders" value={folderCount} icon={<Folder size={16} className="text-[#F59E0B]" />} />
          <StatCard label="Files" value={fileCount} icon={<FileText size={16} className="text-[#10B981]" />} />
          <StatCard label="Course Books" value={materialCounts.textbook ?? 0} icon={<BookOpen size={16} className="text-[#059669]" />} />
          <StatCard label="Package Confidence" value={`${packageConfidence}%`} icon={<HelpCircle size={16} className="text-[#8B5CF6]" />} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(['pdf', 'docx', 'epub', 'pptx', 'text', 'audio', 'video', 'image'] as AssetKind[]).map((kind) => {
            const count = kindCounts[kind] ?? 0
            if (count === 0) return null
            const Icon = KIND_ICONS[kind]
            const color = KIND_COLORS[kind]
            return (
              <div
                key={kind}
                className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-2"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}1A`, color }}>
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#6B7280]">{KIND_LABELS[kind]}</div>
                  <div className="text-sm font-semibold">{count}</div>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

      <motion.div className="glass-card rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-[#10B981]" />
          Validation Checks
        </h3>
        <div className="space-y-2">
          {validationChecks.map((check, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-2">
              {check.pass ? (
                <CheckCircle2 size={14} className="text-[#10B981] shrink-0" />
              ) : (
                <AlertCircle size={14} className="text-[#EF4444] shrink-0" />
              )}
              <span className="text-xs font-medium">{check.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div className="glass-card rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <BookOpen size={14} className="text-[#059669]" />
          Detected Materials
        </h3>
        <div className="space-y-2">
          {Object.entries(MATERIAL_LABELS).map(([key, label]) => {
            const count = materialCounts[key] ?? 0
            if (count === 0) return null
            const color = key === 'textbook' ? '#059669' : key === 'workbook' ? '#3B82F6' : key === 'teacher-handbook' ? '#8B5CF6' : key === 'reference' ? '#14B8A6' : key === 'audio' ? '#10B981' : key === 'video' ? '#EC4899' : key === 'image' ? '#F97316' : '#6B7280'
            return (
              <div key={key} className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${color}1A`, color }}>
                    {key === 'textbook' && <BookOpen size={12} />}
                    {key === 'workbook' && <FileText size={12} />}
                    {key === 'teacher-handbook' && <HelpCircle size={12} />}
                    {key === 'reference' && <FileText size={12} />}
                    {key === 'audio' && <Mic size={12} />}
                    {key === 'video' && <Video size={12} />}
                    {key === 'image' && <ImageIcon size={12} />}
                    {key === 'other' && <FileIcon size={12} />}
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <span className="text-sm font-semibold" style={{ color }}>{count}</span>
              </div>
            )
          })}
        </div>
      </motion.div>

      {stage === 'transforming' && job && (
        <motion.div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[#A8A29E]">{job.message ?? 'Starting transformation'}</span>
            <span className="text-[#10B981] font-medium">{Math.round(job.progress * 100)}%</span>
          </div>
          <div className="progress-bar h-2 mb-3">
            <div className="progress-bar-fill" style={{ width: `${Math.round(job.progress * 100)}%` }} />
          </div>
          <div className="space-y-1.5">
            {phasesList.map((phase, i) => {
              const done = i < phasesList.findIndex((p) => p.id === job.phase)
              const active = phase.id === job.phase
              return (
                <div key={phase.id} className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      done ? 'bg-[#1F7A4C]' : active ? 'border border-[#BBF7D0] bg-[#F0FDF4]' : 'border border-[#E5E7EB] bg-[#FAFBFC]'
                    }`}
                  >
                    {done ? <CheckCircle2 size={10} className="text-white" /> : <Loader2 size={10} className={active ? 'animate-spin text-[#1F7A4C]' : 'text-[#6B7280]'} />}
                  </div>
                  <span className={`flex-1 ${done ? 'text-[#1F7A4C]' : active ? 'text-[#111827]' : 'text-[#6B7280]'}`}>{phase.label}</span>
                  {active && job.detail && <span className="text-[#6B7280] truncate max-w-[200px]">{job.detail}</span>}
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {reusedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-[#F59E0B] px-1">
          <CheckCircle2 size={13} />
          {reusedCount} file{reusedCount === 1 ? '' : 's'} already uploaded — will be reused, not re-uploaded.
        </div>
      )}

      <button
        onClick={() => {
          if (allChecksPass) {
            onStartTransform()
          } else {
            setConfirmTransform(true)
          }
        }}
        disabled={disabled || stage === 'parsing' || stage === 'starting' || stage === 'transforming' || fileCount === 0}
        className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
          disabled || stage === 'parsing' || stage === 'starting' || stage === 'transforming' || fileCount === 0
            ? 'bg-[#BBF7D0] text-[#1F7A4C] cursor-not-allowed'
            : 'bg-[#1F7A4C] text-white hover:bg-[#16643D] hover:shadow-[0_4px_12px_rgba(31,122,76,0.2)]'
        }`}
      >
        {stage === 'parsing' ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Parsing files…
          </span>
        ) : stage === 'starting' ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Starting AI transformation…
          </span>
        ) : stage === 'transforming' ? (
          <span className="flex items-center justify-center gap-2">
            <Sparkles size={14} className="animate-spin-slow" />
            Transforming with AI…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Sparkles size={14} />
            Start AI Transformation
          </span>
        )}
      </button>

      <AnimatePresence>
        {confirmTransform && !allChecksPass && fileCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4"
          >
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle size={14} className="text-[#B91C1C] mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium text-[#B91C1C]">Some validation checks failed</div>
                <div className="text-xs text-[#6B7280] mt-0.5">
                  {failedChecks.map((c) => c.label).join(', ')}.{' '}
                  The course may be incomplete or contain issues. Do you still want to transform it with AI?
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onStartTransform}
                className="flex-1 rounded-lg bg-[#1F7A4C] px-4 py-2 text-xs font-medium text-white transition-all hover:bg-[#16643D]"
              >
                Yes, transform with AI
              </button>
              <button
                onClick={() => setConfirmTransform(false)}
                className="flex-1 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] px-4 py-2 text-xs font-medium text-[#374151] transition-all hover:bg-[#F3F4F6]"
              >
                No, let me review
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!allChecksPass && fileCount > 0 && (
        <div className="text-center text-xs text-[#6B7280]">
          Some validation checks failed — you can still transform, but the result may be incomplete.
        </div>
      )}
    </motion.div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactElement }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-[#6B7280]">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-[#111827]">{value}</div>
    </div>
  )
}

function countNodes(nodes: FileNode[], countDirs: boolean): number {
  let count = 0
  for (const node of nodes) {
    if (node.isDirectory === countDirs) count++
    if (node.children) count += countNodes(node.children, countDirs)
  }
  return count
}

function countByKind(nodes: FileNode[]): Record<AssetKind, number> {
  const counts: Record<AssetKind, number> = {
    pdf: 0,
    docx: 0,
    epub: 0,
    pptx: 0,
    text: 0,
    audio: 0,
    video: 0,
    image: 0,
    unknown: 0,
  }
  for (const node of nodes) {
    if (!node.isDirectory && node.kind) counts[node.kind]++
    if (node.children) {
      const childCounts = countByKind(node.children)
      for (const k of Object.keys(counts) as AssetKind[]) counts[k] += childCounts[k]
    }
  }
  return counts
}

function countByMaterial(nodes: FileNode[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const node of nodes) {
    if (!node.isDirectory && node.materialType) {
      counts[node.materialType] = (counts[node.materialType] ?? 0) + 1
    }
    if (node.children) {
      const childCounts = countByMaterial(node.children)
      for (const k of Object.keys(childCounts)) counts[k] = (counts[k] ?? 0) + childCounts[k]
    }
  }
  return counts
}

function calculatePackageConfidence(materials: Record<string, number>): number {
  let score = 0
  if (materials.textbook) score += 40
  if (materials.workbook) score += 25
  if (materials['teacher-handbook']) score += 20
  if (materials.audio) score += 10
  if (materials.video) score += 5
  return Math.min(99, score)
}