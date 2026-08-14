'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  BookOpen,
  Mic,
  FileText,
  File as FileIcon,
  X,
  Sparkles,
  CheckCircle2,
  Zap,
  Layers,
  MessageSquare,
  Network,
  GitMerge,
  ListTree,
  Map as MapIcon,
  AlertTriangle,
  Loader2,
  Search,
  Folder as FolderIcon,
} from 'lucide-react'
import { detectKind, parseAsset, isFake, fakeContent } from '@/lib/parse'
import { groupFiles, stemOf } from '@/lib/grouping'
import { saveCourse, loadCourse, clearCourse } from '@/lib/storage'
import CourseDashboard from '@/components/CourseDashboard'
import type { AssetKind, Course, JobPhase, UploadedAsset } from '@/lib/types'

const examples = [
  { label: 'German A1 Textbook', icon: BookOpen, desc: 'PDF textbook', languages: 'German' },
  { label: 'French Dialogues', icon: Mic, desc: 'Audio course', languages: 'French' },
  { label: 'Spanish Vocabulary', icon: FileText, desc: 'Word list', languages: 'Spanish' },
  { label: 'Italian Grammar Notes', icon: FileIcon, desc: 'Study notes', languages: 'Italian' },
]

const phases: { id: JobPhase; label: string; desc: string; icon: typeof Search }[] = [
  { id: 'queued', label: 'Queued', desc: 'Waiting to start', icon: Loader2 },
  { id: 'content-discovery', label: 'Content Discovery', desc: 'Extracting chapters, vocabulary, grammar, skills and objectives from every file', icon: Search },
  { id: 'structure-reconstruction', label: 'Course Structure', desc: 'Rebuilding modules and lessons in optimal learning order — ignoring file names', icon: Layers },
  { id: 'knowledge-graph', label: 'Knowledge Graph', desc: 'Linking concepts with prerequisites, parents and relationships', icon: Network },
  { id: 'duplicate-detection', label: 'Duplicate Detection', desc: 'Merging duplicate lessons, explanations and vocabulary', icon: GitMerge },
  { id: 'material-generation', label: 'Material Generation', desc: 'Creating vocabulary cards, grammar rules, reading, listening, speaking, writing and exercises', icon: MessageSquare },
  { id: 'dependency-mapping', label: 'Dependency Mapping', desc: 'Determining what must be learned before what', icon: MapIcon },
  { id: 'master-tree', label: 'Master Learning Tree', desc: 'Assembling the course with reviews and final assessment', icon: ListTree },
  { id: 'done', label: 'Complete', desc: 'Your course is ready', icon: CheckCircle2 },
]

interface ParseEntry {
  file: File
  path?: string
  kind?: AssetKind
  asset?: UploadedAsset
  status: 'pending' | 'parsing' | 'ok' | 'empty' | 'failed'
  message?: string
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

const HIDDEN_NAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini', '.gitkeep', '.gitignore'])

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function UploadPage() {
  const [entries, setEntries] = useState<ParseEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [stage, setStage] = useState<'idle' | 'parsing' | 'transforming' | 'done' | 'error'>('idle')
  const [job, setJob] = useState<{ phase: JobPhase; progress: number; message: string; detail: string; mode: 'ai' | 'local' } | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedCourse, setSavedCourse] = useState<Course | null>(() => loadCourse())
  const [skipped, setSkipped] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const entriesRef = useRef<ParseEntry[]>([])

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const parseEntry = useCallback(async (entry: ParseEntry): Promise<UploadedAsset | null> => {
    setEntries((prev) => prev.map((e) => (e.file === entry.file ? { ...e, status: 'parsing' } : e)))
    try {
      let file = entry.file
      if (isFake(file)) {
        file = new File([fakeContent(file.name)], file.name, { type: 'application/pdf' })
      }
      const asset = await parseAsset(file)
      asset.path = entry.path
      setEntries((prev) =>
        prev.map((e) =>
          e.file === entry.file
            ? { ...e, asset, status: asset.text ? 'ok' : 'empty', message: asset.text ? undefined : 'Metadata only — will use context' }
            : e
        )
      )
      return asset
    } catch {
      setEntries((prev) => prev.map((e) => (e.file === entry.file ? { ...e, status: 'failed' } : e)))
      return null
    }
  }, [])

  const autoParse = useCallback(
    async (list: ParseEntry[]) => {
      for (const entry of list) {
        await parseEntry(entry)
      }
    },
    [parseEntry]
  )

  const addFiles = useCallback(
    (files: File[]) => {
      const keys = new Set(entriesRef.current.map((e) => `${e.path ?? ''}|${e.file.name}|${e.file.size}`))
      const fresh: ParseEntry[] = []
      let skippedCount = 0
      for (const raw of files) {
        const path = (raw as File & { webkitRelativePath?: string }).webkitRelativePath ?? ''
        const base = path ? path.split('/').pop() ?? raw.name : raw.name
        if (base.startsWith('.') || HIDDEN_NAMES.has(base.toLowerCase())) {
          skippedCount++
          continue
        }
        const kind = detectKind(raw)
        if (kind === 'unknown') {
          skippedCount++
          continue
        }
        const key = `${path}|${raw.name}|${raw.size}`
        if (keys.has(key)) continue
        keys.add(key)
        fresh.push({ file: raw, path: path || undefined, kind, status: 'pending' })
      }
      if (skippedCount) setSkipped((s) => s + skippedCount)
      if (fresh.length) {
        setEntries((prev) => [...prev, ...fresh])
        void autoParse(fresh)
      }
    },
    [autoParse]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      addFiles(Array.from(e.dataTransfer.files))
    },
    [addFiles]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const removeEntry = (file: File) => {
    setEntries((prev) => prev.filter((e) => e.file !== file))
  }

  const getFileIcon = (entry: ParseEntry) => {
    const kind = entry.kind ?? entry.asset?.kind
    if (kind === 'audio' || kind === 'video') return <Mic size={14} className="text-[#10B981]" />
    if (kind === 'pdf') return <BookOpen size={14} className="text-[#059669]" />
    if (kind === 'image') return <FileIcon size={14} className="text-[#8B5CF6]" />
    return <FileText size={14} className="text-[#F59E0B]" />
  }

  const entryStatusText = (entry: ParseEntry) => {
    if (entry.status === 'parsing') return 'Detecting content…'
    if (entry.status === 'failed') return 'Failed'
    if (entry.status === 'empty') return 'No text extracted'
    if (entry.asset?.kind === 'audio') return `${entry.asset.durationSec ? Math.round(entry.asset.durationSec / 60) + ' min audio' : 'Audio'}`
    if (entry.asset?.kind === 'video') return `${entry.asset.durationSec ? Math.round(entry.asset.durationSec / 60) + ' min video' : 'Video'}`
    if (entry.asset?.kind === 'image') return 'Image'
    if (entry.asset?.words) return `${entry.asset.words.toLocaleString()} words`
    if (entry.kind) return `${KIND_LABELS[entry.kind]} detected`
    return 'Ready'
  }

  const handleTransform = async () => {
    if (!entries.length || stage === 'transforming') return
    setError(null)
    setStage('parsing')
    const parsed: UploadedAsset[] = []
    for (const entry of entries) {
      if (entry.asset) {
        parsed.push(entry.asset)
        continue
      }
      const asset = await parseEntry(entry)
      if (asset) parsed.push(asset)
    }
    const successful = parsed
    if (!successful.length) {
      setStage('error')
      setError('No readable content was extracted from the selected files.')
      return
    }
    setStage('transforming')
    try {
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: successful }),
      })
      if (!res.ok) throw new Error('Failed to start transformation')
      const { id } = await res.json()
      const poll = async () => {
        const statusRes = await fetch(`/api/transform?id=${id}`)
        if (!statusRes.ok) return
        const data = await statusRes.json()
        setJob({ phase: data.phase, progress: data.progress, message: data.message, detail: data.detail, mode: data.mode })
        if (data.status === 'done' && data.result) {
          if (pollRef.current) clearInterval(pollRef.current)
          const result = data.result as Course
          setCourse(result)
          saveCourse(result)
          setSavedCourse(null)
          setStage('done')
        } else if (data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current)
          setStage('error')
          setError(data.error ?? 'Transformation failed')
        }
      }
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(poll, 1200)
      void poll()
    } catch (err) {
      setStage('error')
      setError(err instanceof Error ? err.message : 'Transformation failed')
    }
  }

  const phaseIndex = job ? phases.findIndex((p) => p.id === job.phase) : -1
  const completedPhases = phaseIndex >= 0 ? phaseIndex : 0
  const progressPercent = stage === 'parsing' ? 4 : job ? Math.round(job.progress * 96) + 4 : 0

  const restoreCourse = (c: Course) => {
    setCourse(c)
    setStage('done')
  }

  const startNew = () => {
    setStage('idle')
    setCourse(null)
    setEntries([])
    setJob(null)
    setSkipped(0)
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-8 max-w-5xl mx-auto">
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Upload Learning Material</h1>
        <p className="text-[#A8A29E] text-sm mt-1">
          Upload your textbook, PDF, workbook, audio or notes. Woodpecker reconstructs them into one interconnected learning system.
        </p>
      </motion.div>

      {savedCourse && stage !== 'done' && (
        <motion.div variants={itemVariants} className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-[rgba(16,185,129,0.04)] border border-[rgba(16,185,129,0.15)]">
          <Sparkles size={16} className="text-[#10B981]" />
          <div className="flex-1">
            <div className="text-sm font-medium">Saved course: {savedCourse.title}</div>
            <div className="text-xs text-[#A8A29E]">Created {new Date(savedCourse.createdAt).toLocaleString()}</div>
          </div>
          <button onClick={() => restoreCourse(savedCourse)} className="btn-primary text-xs px-3 py-1.5">
            View Course
          </button>
          <button onClick={clearCourse} className="btn-secondary text-xs px-3 py-1.5">
            Discard
          </button>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {stage !== 'done' ? (
          <motion.div key="upload" variants={itemVariants} exit={{ opacity: 0, y: -10 }}>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
              className={`rounded-2xl p-16 text-center cursor-pointer transition-all border-2 border-dashed ${
                dragging
                  ? 'border-[#10B981] bg-[rgba(16,185,129,0.05)]'
                  : 'border-[rgba(250,248,245,0.06)] glass hover:border-[rgba(16,185,129,0.3)] hover:bg-[rgba(250,248,245,0.05)]'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto mb-4 ai-glow">
                <Upload size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-1">
                {dragging ? 'Drop your files or folder here' : 'Upload your learning material'}
              </h3>
              <p className="text-sm text-[#A8A29E] mb-2">Drag & drop a folder or files, or click to browse</p>
              <p className="text-xs text-[#6B7280] mb-4">PDF, EPUB, DOCX, PPTX, TXT, Markdown, MP3, WAV, M4A, MP4, Images</p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  document.getElementById('folder-input')?.click()
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[rgba(250,248,245,0.04)] border border-[rgba(250,248,245,0.1)] hover:border-[rgba(16,185,129,0.4)] hover:bg-[rgba(16,185,129,0.05)] transition-all"
              >
                <FolderIcon size={14} className="text-[#10B981]" />
                Upload a folder — contents detected automatically
              </button>
              <input id="file-input" type="file" multiple onChange={handleFileSelect} className="hidden" />
              <input id="folder-input" type="file" {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)} multiple onChange={handleFolderSelect} className="hidden" />
            </div>
          </motion.div>
        ) : (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            {course ? (
              <CourseDashboard course={course} />
            ) : null}
            {course && (
              <div className="mt-6 text-center">
                <button onClick={startNew} className="btn-secondary text-xs px-4 py-2">
                  Transform another set of materials
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {stage !== 'done' && (
        <motion.div variants={itemVariants} className="mt-6 glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">{entries.length} file(s) selected</h3>
            <div className="flex items-center gap-2">
              {entries.length > 0 && (
                <button onClick={() => setEntries([])} className="text-xs text-[#6B7280] hover:text-[#EF4444] transition-colors">
                  Clear all
                </button>
              )}
              <button
                onClick={handleTransform}
                disabled={!entries.length || stage === 'parsing' || stage === 'transforming'}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  !entries.length || stage === 'parsing' || stage === 'transforming'
                    ? 'bg-[rgba(16,185,129,0.3)] text-white cursor-not-allowed'
                    : 'btn-primary'
                }`}
              >
                {stage === 'parsing' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Parsing files…
                  </span>
                ) : stage === 'transforming' ? (
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} className="animate-spin-slow" />
                    Transforming…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Upload size={14} />
                    Transform with AI
                  </span>
                )}
              </button>
            </div>
          </div>

          {(stage === 'parsing' || stage === 'transforming') && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#A8A29E]">{job?.message ?? (stage === 'parsing' ? 'Parsing files' : 'Starting transformation')}</span>
                <span className="text-[#10B981] font-medium">{progressPercent}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}

          {(stage === 'parsing' || stage === 'transforming') && job && (
            <div className="space-y-2 mb-4">
              {phases.slice(0, phases.length - 1).map((phase, i) => {
                const done = i < completedPhases
                const active = i === completedPhases
                return (
                  <div
                    key={phase.id}
                    className={`flex items-center gap-3 rounded-lg p-2.5 transition-all ${
                      active ? 'bg-[rgba(16,185,129,0.05)] border border-[rgba(16,185,129,0.15)]' : ''
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        done
                          ? 'bg-gradient-to-br from-[#059669] to-[#10B981]'
                          : active
                            ? 'bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.4)]'
                            : 'bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.08)]'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 size={13} className="text-white" />
                      ) : active ? (
                        <phase.icon size={13} className="text-[#10B981] animate-pulse-soft" />
                      ) : (
                        <phase.icon size={13} className="text-[#6B7280]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium ${done ? 'text-[#34D399]' : active ? 'text-[#FAF8F5]' : 'text-[#6B7280]'}`}>
                        {phase.label}
                      </div>
                      {active && job.detail && <div className="text-[11px] text-[#A8A29E] truncate">{job.detail}</div>}
                    </div>
                    {active && <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse-soft" />}
                    {done && <span className="text-[10px] text-[#059669]">Done</span>}
                  </div>
                )
              })}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.2)] mb-3">
              <AlertTriangle size={14} className="text-[#EF4444] mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium text-[#EF4444]">Transformation failed</div>
                <div className="text-xs text-[#A8A29E]">{error}</div>
              </div>
            </div>
          )}

          {skipped > 0 && (
            <div className="text-[11px] text-[#6B7280] mt-2">
              Skipped {skipped} unsupported or hidden file(s) — only readable learning material is added.
            </div>
          )}

          {stage === 'idle' && entries.length === 0 ? (
            <div className="text-xs text-[#6B7280] text-center py-2">Selected files will be parsed and transformed into a full learning course.</div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const groups = groupFiles(entries.map((e) => ({ name: e.file.name, path: e.path })))
                return groups.map((group) => {
                  const groupEntries = entries.filter((e) => {
                    const folder = e.path ? e.path.split('/')[0] : undefined
                    return folder === group.folder && stemOf(e.file.name) === group.stem
                  })
                  const grouped = group.files.length > 1 || !!group.folder
                  return (
                    <div key={group.key}>
                      {grouped && (
                        <div className="flex items-center gap-2 px-1 pb-1.5">
                          <FolderIcon size={12} className="text-[#F59E0B]" />
                          <span className="text-[11px] font-semibold text-[#A8A29E]">{group.display}</span>
                          <span className="text-[10px] text-[#6B7280]">{group.files.length} file(s)</span>
                        </div>
                      )}
                      <div className="space-y-2">
                        {groupEntries.map((entry) => (
                          <div key={entry.file.name} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(250,248,245,0.02)]">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-[rgba(250,248,245,0.03)] flex items-center justify-center shrink-0">
                                {getFileIcon(entry)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{entry.file.name}</div>
                                <div className="text-[#6B7280] text-xs flex items-center gap-2">
                                  {entry.path && <span className="truncate max-w-[220px]">{entry.path.replace(`${group.folder}/`, '')}</span>}
                                  <span>({(entry.file.size / 1024 / 1024).toFixed(1)} MB)</span>
                                  <span className="flex items-center gap-1">
                                    {entry.status === 'parsing' && <Loader2 size={10} className="animate-spin text-[#F59E0B]" />}
                                    {entry.status === 'ok' && <CheckCircle2 size={10} className="text-[#10B981]" />}
                                    {entry.status === 'empty' && <Zap size={10} className="text-[#8B5CF6]" />}
                                    {entry.status === 'failed' && <AlertTriangle size={10} className="text-[#EF4444]" />}
                                    {entryStatusText(entry)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button onClick={() => removeEntry(entry.file)} className="text-[#6B7280] hover:text-[#ef4444] transition-colors p-1 shrink-0">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {stage === 'idle' && (
            <>
              <div className="h-px bg-[rgba(250,248,245,0.06)] my-4" />
              <h3 className="font-semibold text-sm mb-3">Try uploading something like</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {examples.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => {
                      const fakeFile = new File([], ex.label + '.pdf', { type: 'application/pdf' })
                      setEntries((prev) => [...prev, { file: fakeFile, status: 'pending' }])
                    }}
                    className="p-4 rounded-xl bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-left transition-all hover:border-[rgba(16,185,129,0.3)] hover:bg-[rgba(250,248,245,0.04)]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mb-2">
                      <ex.icon size={14} className="text-white" />
                    </div>
                    <div className="text-sm font-medium">{ex.label}</div>
                    <div className="text-xs text-[#6B7280]">{ex.desc}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
