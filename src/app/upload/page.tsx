'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Upload,
  BookOpen,
  Mic,
  FileText,
  File as FileIcon,
  Sparkles,
  CheckCircle2,
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
  FolderOpen,
  Library,
  RefreshCw,
  LayoutDashboard,
  Check,
  ShieldCheck,
  Cloud,
  HardDrive,
  Link2,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { detectKind, parseAsset, isFake, fakeContent } from '@/lib/parse'
import { saveCourse, loadCourse, refreshFromServer } from '@/lib/storage'
import CourseDashboard from '@/components/CourseDashboard'
import { DirectoryTree, buildFileTree } from '@/components/upload/DirectoryTree'
import type { AssetKind, Course, JobPhase, UploadedAsset } from '@/lib/types'

const phases: { id: JobPhase; label: string; desc: string; icon: typeof Search }[] = [
  { id: 'queued', label: 'Queued', desc: 'Waiting to start', icon: Loader2 },
  { id: 'content-discovery', label: 'Content Discovery', desc: 'Extracting chapters, vocabulary, grammar and objectives', icon: Search },
  { id: 'structure-reconstruction', label: 'Course Structure', desc: 'Rebuilding modules and lessons in learning order', icon: Layers },
  { id: 'knowledge-graph', label: 'Knowledge Graph', desc: 'Linking concepts with prerequisites', icon: Network },
  { id: 'duplicate-detection', label: 'Duplicate Detection', desc: 'Merging duplicate lessons and vocabulary', icon: GitMerge },
  { id: 'material-generation', label: 'Material Generation', desc: 'Creating cards, grammar, reading, listening & speaking', icon: MessageSquare },
  { id: 'dependency-mapping', label: 'Dependency Mapping', desc: 'Determining what to learn before what', icon: MapIcon },
  { id: 'master-tree', label: 'Master Learning Tree', desc: 'Assembling the course with reviews', icon: ListTree },
  { id: 'done', label: 'Complete', desc: 'Your course is ready', icon: CheckCircle2 },
]

interface ParseEntry {
  file: File
  path?: string
  kind?: AssetKind
  asset?: UploadedAsset
  status: 'pending' | 'parsing' | 'ok' | 'empty' | 'failed'
  reused?: boolean
  storedKey?: string
}

const HIDDEN_NAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini', '.gitkeep', '.gitignore'])

export default function UploadPage() {
  const [entries, setEntries] = useState<ParseEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [stage, setStage] = useState<'idle' | 'parsing' | 'starting' | 'transforming' | 'done' | 'error'>('idle')
  const [job, setJob] = useState<{ phase: JobPhase; progress: number; message: string; detail: string; mode: 'ai' | 'local' } | null>(null)
  const [course, setCourse] = useState<Course | null>(() => loadCourse())
  const [error, setError] = useState<string | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [parseComplete, setParseComplete] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number; name: string } | null>(null)
  const reusedIndexRef = useRef<Map<string, string>>(new Map())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const entriesRef = useRef<ParseEntry[]>([])

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])
  useEffect(() => {
    let cancelled = false
    void refreshFromServer().then(() => {
      if (cancelled) return
      const saved = loadCourse()
      if (saved && !course) { setCourse(saved); setStage('done') }
    })
    return () => { cancelled = true }
  }, [course])
  useEffect(() => {
    let cancelled = false
    void fetch('/api/materials').then((res) => (res.ok ? res.json() : null)).then((data) => {
      if (cancelled || !data?.materials) return
      const index = new Map<string, string>()
      for (const m of data.materials as { title: string; size: number | null; objectKey: string | null }[]) {
        if (m.size != null && m.objectKey) index.set(`${m.title}|${m.size}`, m.objectKey)
      }
      reusedIndexRef.current = index
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const parseEntry = useCallback(async (entry: ParseEntry): Promise<UploadedAsset | null> => {
    setEntries((prev) => prev.map((e) => (e.file === entry.file ? { ...e, status: 'parsing' } : e)))
    try {
      let file = entry.file
      if (isFake(file)) file = new File([fakeContent(file.name)], file.name, { type: 'application/pdf' })
      const asset = await parseAsset(file)
      asset.path = entry.path
      setEntries((prev) => prev.map((e) => e.file === entry.file ? { ...e, asset, status: asset.text ? 'ok' : 'empty' } : e))
      return asset
    } catch {
      setEntries((prev) => prev.map((e) => (e.file === entry.file ? { ...e, status: 'failed' } : e)))
      return null
    }
  }, [])

  const autoParse = useCallback(async (list: ParseEntry[]) => {
    for (const entry of list) await parseEntry(entry)
    setParseComplete(true)
  }, [parseEntry])

  const addFiles = useCallback(async (files: File[]) => {
    const keys = new Set(entriesRef.current.map((e) => `${e.path ?? ''}|${e.file.name}|${e.file.size}`))
    const fresh: ParseEntry[] = []
    let skippedCount = 0
    for (const raw of files) {
      const path = (raw as File & { webkitRelativePath?: string }).webkitRelativePath ?? ''
      const base = path ? path.split('/').pop() ?? raw.name : raw.name
      if (base.startsWith('.') || HIDDEN_NAMES.has(base.toLowerCase())) { skippedCount++; continue }
      const kind = detectKind(raw)
      if (kind === 'unknown') { skippedCount++; continue }
      const key = `${path}|${raw.name}|${raw.size}`
      if (keys.has(key)) continue
      keys.add(key)
      const storedKey = reusedIndexRef.current.get(`${raw.name}|${raw.size}`)
      fresh.push({ file: raw, path: path || undefined, kind, status: 'pending', reused: Boolean(storedKey), storedKey })
    }
    if (skippedCount) setSkipped((s) => s + skippedCount)
    if (fresh.length) {
      setParseComplete(false)
      setEntries((prev) => [...prev, ...fresh])
      void autoParse(fresh)
    }
  }, [autoParse])

  const scanFolderEntries = useCallback(async (items: DataTransferItemList): Promise<File[]> => {
    if (!items || !items.length) return []
    const results: File[] = []
    const processEntry = (entry: FileSystemEntry, path = ''): Promise<void> => new Promise((resolve) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file((file) => {
          Object.defineProperty(file, 'webkitRelativePath', { value: path ? `${path}/${file.name}` : file.name, writable: false, configurable: true })
          results.push(file); resolve()
        })
      } else if (entry.isDirectory) {
        const dirReader = (entry as FileSystemDirectoryEntry).createReader()
        const readAll = () => dirReader.readEntries((entries) => {
          if (!entries.length) { resolve(); return }
          Promise.all(entries.map((e) => processEntry(e, path ? `${path}/${entry.name}` : entry.name))).then(() => readAll())
        })
        readAll()
      } else resolve()
    })
    await Promise.all(Array.from(items).filter((i) => i.kind === 'file').map((item) => processEntry(item.webkitGetAsEntry()!, '')))
    return results
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const files = await scanFolderEntries(e.dataTransfer.items)
    if (files.length > 0) addFiles(files); else addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles, scanFolderEntries])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }

  const uploadToMinio = useCallback(async (): Promise<Map<File, string>> => {
    const keyMap = new Map<File, string>()
    const realFiles = entriesRef.current.filter((e) => e.asset && !isFake(e.file))
    if (!realFiles.length) return keyMap
    const CHUNK_BYTES = 64 * 1024 * 1024
    const SINGLE_MAX = 30 * 1024 * 1024
    const total = realFiles.length; let done = 0
    const postUpload = async (form: FormData, url: string): Promise<Record<string, unknown>> => {
      let res: Response
      try { res = await fetch(url, { method: 'POST', body: form }) } catch { throw new Error('Could not reach the upload service.') }
      if (!res.ok) { let detail = `Upload failed (HTTP ${res.status})`; try { const body = await res.json(); if (body?.error) detail = body.error } catch {} throw new Error(detail) }
      return res.json()
    }
    const uploadWithRetry = async (form: FormData, url: string) => {
      let lastError: unknown
      for (let attempt = 0; attempt < 3; attempt++) { try { return await postUpload(form, url) } catch (err) { lastError = err; if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1))) } }
      throw lastError
    }
    const uploadOne = async (entry: (typeof realFiles)[number]): Promise<{ file: File; objectKey: string }> => {
      const { file } = entry
      if (entry.reused && entry.storedKey) return { file, objectKey: entry.storedKey }
      let objectKey: string
      if (file.size <= SINGLE_MAX) {
        const form = new FormData(); form.append('files', file)
        const data = await uploadWithRetry(form, '/api/upload')
        const f = (data.files as { objectKey?: string }[] | undefined)?.[0]
        if (!f?.objectKey) throw new Error('Upload to storage failed')
        objectKey = f.objectKey
      } else {
        const chunkTotal = Math.ceil(file.size / CHUNK_BYTES); const uploadId = crypto.randomUUID(); let finalKey: string | undefined; const cancelled = { value: false }
        const uploadChunk = async (c: number) => {
          if (cancelled.value) return
          const blob = file.slice(c * CHUNK_BYTES, Math.min((c + 1) * CHUNK_BYTES, file.size))
          const form = new FormData()
          form.append('fileName', file.name); form.append('uploadId', uploadId); form.append('chunkIndex', String(c)); form.append('chunkTotal', String(chunkTotal)); form.append('size', String(file.size)); form.append('mime', file.type || 'application/octet-stream'); form.append('chunk', blob, file.name)
          const data = await uploadWithRetry(form, '/api/upload/chunk')
          if (data.duplicate) { cancelled.value = true; finalKey = data.objectKey as string | undefined }
        }
        let cursor = 0
        const workers = Array.from({ length: Math.min(3, chunkTotal) }, async () => { while (!cancelled.value) { const c = cursor++; if (c >= chunkTotal) break; await uploadChunk(c) } })
        await Promise.all(workers)
        if (!cancelled.value) {
          const res = await fetch('/api/upload/finalize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, uploadId, chunkTotal, mime: file.type || 'application/octet-stream', size: file.size }) })
          if (!res.ok) throw new Error('Finalize failed')
          const data = (await res.json()) as { objectKey?: string }; finalKey = data.objectKey as string | undefined
        }
        if (!finalKey) throw new Error('Chunk finalize returned no key'); objectKey = finalKey
      }
      return { file, objectKey }
    }
    const fileResults: { file: File; objectKey: string }[] = []; let failed: unknown = null; let cursor = 0
    const workers = Array.from({ length: Math.min(4, realFiles.length) }, async () => {
      while (!failed) { const i = cursor++; if (i >= realFiles.length) break; try { const r = await uploadOne(realFiles[i]); done++; setUploadProgress({ done, total, name: realFiles[i].file.name }); fileResults.push(r) } catch (err) { failed = err } }
    })
    await Promise.all(workers); if (failed) throw failed
    for (const r of fileResults) keyMap.set(r.file, r.objectKey)
    return keyMap
  }, [])

  const handleTransform = async () => {
    if (!entries.length || stage === 'transforming' || stage === 'starting') return
    setError(null); setStage('parsing')
    const parsed: UploadedAsset[] = []
    for (const entry of entries) { if (entry.asset) { parsed.push(entry.asset); continue } const asset = await parseEntry(entry); if (asset) parsed.push(asset) }
    if (!parsed.length) { setStage('error'); setError('No readable content was extracted.'); return }
    setStage('starting'); setUploadProgress(null)
    try {
      const objectKeys = await uploadToMinio()
      const assetsWithStorage = parsed.map((a) => {
        const entry = entries.find((e) => e.asset === a); const objectKey = entry ? objectKeys.get(entry.file) : undefined
        const payload = { id: a.id, name: a.name, kind: a.kind, mime: a.mime, size: a.size, path: a.path, text: a.text, durationSec: a.durationSec, words: a.words, pageCount: a.pageCount }
        return objectKey ? { ...payload, objectKey } : payload
      })
      const res = await fetch('/api/transform', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assets: assetsWithStorage }) })
      if (!res.ok) throw new Error('Failed to start transformation')
      const { id } = await res.json(); setStage('transforming')
      const poll = async () => {
        const statusRes = await fetch(`/api/transform?id=${id}`); if (!statusRes.ok) return
        const data = await statusRes.json(); setJob({ phase: data.phase, progress: data.progress, message: data.message, detail: data.detail, mode: data.mode })
        if (data.status === 'done' && data.result) {
          if (pollRef.current) clearInterval(pollRef.current)
          const result = data.result as Course
          const mediaByAssetId = new Map<string, string>(); let mediaBytes = 0
          for (const a of parsed) { if (!a.dataUrl || a.dataUrl.length > 2 * 1024 * 1024) continue; mediaBytes += a.dataUrl.length; if (mediaBytes > 12 * 1024 * 1024) break; mediaByAssetId.set(a.id, a.dataUrl) }
          const restored: Course = { ...result, sourceFiles: (result.sourceFiles ?? []).map((f) => ({ ...f, dataUrl: f.dataUrl ?? mediaByAssetId.get(f.id) })) }
          setCourse(restored); saveCourse(restored); setStage('done')
        } else if (data.status === 'error') { if (pollRef.current) clearInterval(pollRef.current); setStage('error'); setError(data.error ?? 'Transformation failed') }
      }
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(poll, 1200); void poll()
    } catch (err) { setStage('error'); setError(err instanceof Error ? err.message : 'Transformation failed') }
  }

  const tree = buildFileTree(entries.map((e) => ({ file: e.file, path: e.path, kind: e.kind, asset: e.asset, status: e.status, reused: e.reused })))
  const allParsed = entries.length > 0 && entries.every((e) => e.status === 'ok' || e.status === 'empty')
  const isReady = allParsed && parseComplete
  const phaseIndex = job ? phases.findIndex((p) => p.id === job.phase) : -1
  const completedPhases = phaseIndex >= 0 ? phaseIndex : 0
  const progressPercent = stage === 'parsing' ? 0 : job ? Math.round(job.progress * 100) : 0
  const totalBytes = entries.reduce((n, e) => n + e.file.size, 0)

  if (stage === 'done' && course) {
    return (
      <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
        <div className="rounded-[20px] border border-[#BBF7D0] bg-[#F0FDF4] p-4 flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-[#1F7A4C] flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#111827]">Your learning system is ready</div>
            <div className="text-xs text-[#16643D]">{course.title} · {course.modules.length} modules · {course.stats.lessons} lessons — explore your course</div>
          </div>
          <Link href="/dashboard" className="ml-auto hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1F7A4C] text-white text-xs font-semibold hover:bg-[#16643D]">
            Go to Dashboard <ArrowRight size={12} />
          </Link>
        </div>
        <CourseDashboard course={course} />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
      {/* Header – premium cloud storage feel */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
            Upload Center
          </h1>
          <p className="text-sm leading-relaxed text-[#6B7280] mt-1 max-w-[640px]">
            Premium cloud storage for your learning materials. Drop an entire course folder or individual files — Woodpacker scans every subfolder, keeps relationships, and rebuilds your course.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E5E7EB] text-xs font-medium text-[#6B7280]">
            <Cloud size={12} className="text-[#1F7A4C]" /> Secure & private
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-xs font-semibold text-[#1F7A4C]">
            <ShieldCheck size={12} /> GDPR ready
          </span>
        </div>
      </div>

      {/* Checklist + Stats */}
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="text-xs font-semibold tracking-wide uppercase text-[#6B7280] flex items-center gap-1.5">
            <HardDrive size={12} className="text-[#1F7A4C]" /> Storage
          </div>
          <div className="text-sm font-bold text-[#111827] mt-1">{entries.length} files</div>
          <div className="text-xs text-[#6B7280]">{(totalBytes / (1024 * 1024)).toFixed(1)} MB · {skipped ? `${skipped} skipped` : 'All validated'}</div>
        </div>
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="text-xs font-semibold tracking-wide uppercase text-[#6B7280] flex items-center gap-1.5">
            <Link2 size={12} className="text-[#1F7A4C]" /> Relationship detection
          </div>
          <div className="text-sm font-bold text-[#111827] mt-1">{tree.length} material groups</div>
          <div className="text-xs text-[#6B7280]">Audio · Text · Exercises linked</div>
        </div>
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="text-xs font-semibold tracking-wide uppercase text-[#6B7280] flex items-center gap-1.5">
            <Clock size={12} className="text-[#F4B942]" /> Progress
          </div>
          <div className="text-sm font-bold text-[#111827] mt-1">{stage === 'idle' ? 'Ready to upload' : stage === 'parsing' ? 'Parsing' : stage === 'starting' ? 'Uploading' : stage === 'transforming' ? `${progressPercent}%` : stage}</div>
          <div className="text-xs text-[#6B7280]">{isReady ? 'Ready to transform' : entries.length ? 'Scanning files…' : 'Awaiting files'}</div>
        </div>
      </div>

      {/* Dropzone – premium */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-[24px] border-2 border-dashed p-8 md:p-10 text-center transition-all bg-white ${dragging ? 'border-[#1F7A4C] bg-[#F0FDF4] shadow-sm' : 'border-[#D1D5DB] hover:border-[#9CA3AF] hover:bg-[#FAFBFC]'}`}
      >
        <div className="w-16 h-16 rounded-2xl bg-[#1F7A4C] flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Upload size={22} className="text-white" />
        </div>
        <h3 className="text-lg font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
          {dragging ? 'Drop your folder or files here' : 'Drop your course folder here'}
        </h3>
        <p className="text-sm text-[#6B7280] mt-1">Drag & drop a folder or files, or choose manually</p>
        <p className="text-xs text-[#9CA3AF] mt-1">PDF, EPUB, DOCX, PPTX, TXT, MP3, WAV, M4A, MP4, Images — nested folders fully supported</p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
          <button
            onClick={() => document.getElementById('folder-input')?.click()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold hover:bg-[#16643D] shadow-sm transition-colors"
          >
            <FolderOpen size={14} /> Upload a folder
          </button>
          <button
            onClick={() => document.getElementById('file-input')?.click()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-colors"
          >
            <FileText size={14} /> Upload individual files
          </button>
        </div>
        <input id="file-input" type="file" multiple onChange={handleFileSelect} className="hidden" />
        <input id="folder-input" type="file" {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)} multiple onChange={handleFolderSelect} className="hidden" />

        <div className="mt-6 flex flex-wrap justify-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-[#6B7280]">Full folder scan</span>
          <span className="px-2.5 py-1 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-[#6B7280]">Relation detection</span>
          <span className="px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C]">Checklist validation</span>
        </div>
      </div>

      {/* Parsing / Progress */}
      <AnimatePresence mode="wait">
        {(stage === 'parsing' || stage === 'starting' || (stage === 'transforming' && job)) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 rounded-[20px] border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-[#1F7A4C]" />
                {stage === 'parsing' ? 'Parsing files…' : job?.message ?? 'Starting AI transformation…'}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {stage === 'parsing' ? `${entries.filter((e) => e.status === 'ok' || e.status === 'empty').length}/${entries.length}` : job ? `${progressPercent}%` : '…'}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-[#1F7A4C] transition-all"
                style={{ width: stage === 'parsing' ? `${entries.length ? (entries.filter((e) => e.status === 'ok' || e.status === 'empty').length / entries.length) * 100 : 0}%` : job ? `${progressPercent}%` : '12%' }}
              />
            </div>
            {!job && stage !== 'parsing' && (
              <div className="flex items-center gap-2 text-xs text-[#6B7280] mt-3">
                <Loader2 size={12} className="animate-spin text-[#1F7A4C]" />
                {uploadProgress ? `Uploading (${uploadProgress.done}/${uploadProgress.total}) — ${uploadProgress.name}…` : 'Uploading files to secure storage…'}
              </div>
            )}
            {job && (
              <div className="mt-4 grid gap-2">
                {phases.slice(0, phases.length - 1).map((phase, i) => {
                  const done = i < completedPhases; const active = i === completedPhases
                  return (
                    <div key={phase.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${active ? 'bg-[#F0FDF4] border-[#BBF7D0]' : done ? 'bg-[#FAFBFC] border-[#E5E7EB]' : 'bg-[#FAFBFC] border-transparent opacity-60'}`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${done ? 'bg-[#1F7A4C] border-[#1F7A4C] text-white' : active ? 'bg-white border-[#1F7A4C] text-[#1F7A4C]' : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'}`}>
                        {done ? <Check size={12} strokeWidth={3} /> : <phase.icon size={12} className={active ? 'animate-pulse' : ''} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold ${done ? 'text-[#1F7A4C]' : active ? 'text-[#111827]' : 'text-[#6B7280]'}`}>{phase.label}</div>
                        {active && job.detail && <div className="text-[11px] text-[#6B7280] truncate">{job.detail}</div>}
                      </div>
                      {active && <span className="w-2 h-2 rounded-full bg-[#1F7A4C] animate-pulse" />}
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-[#EF4444] mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-[#991B1B]">Transformation failed</div>
            <div className="text-xs text-[#B91C1C] mt-0.5 leading-relaxed">{error}</div>
          </div>
          <button onClick={() => void handleTransform()} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1F7A4C] text-white text-xs font-semibold hover:bg-[#16643D]">
            Retry
          </button>
        </motion.div>
      )}

      {/* File list & validation */}
      {entries.length > 0 && stage !== 'transforming' && stage !== 'starting' && (
        <div className="mt-6 grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                  <FolderIcon size={14} className="text-[#F4B942]" /> Directory Tree
                </h3>
                <span className="text-xs px-2 py-1 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-[#6B7280]">
                  {entries.length} file{entries.length === 1 ? '' : 's'} {skipped ? `· ${skipped} skipped` : ''}
                </span>
              </div>
              <DirectoryTree roots={tree} />
              <div className="mt-3 flex items-center gap-2 text-xs text-[#6B7280]">
                <Check size={12} className="text-[#1F7A4C]" /> Material relationship detection groups related files automatically
              </div>
            </div>

            {/* Validation checklist */}
            <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2 mb-3">
                <ShieldCheck size={14} className="text-[#1F7A4C]" /> Upload checklist
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Folder structure scanned', ok: true },
                  { label: 'Files indexed', ok: entries.length > 0 },
                  { label: 'Metadata extracted', ok: allParsed },
                  { label: 'No corrupted files', ok: !entries.some((e) => e.status === 'failed') },
                  { label: 'Ready for AI transformation', ok: isReady },
                ].map((c) => (
                  <div key={c.label} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${c.ok ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center ${c.ok ? 'bg-[#1F7A4C] text-white' : 'bg-white border border-[#FECACA] text-[#EF4444]'}`}>
                      {c.ok ? <Check size={10} strokeWidth={3} /> : <AlertTriangle size={10} />}
                    </span>
                    <span className={`text-xs font-medium ${c.ok ? 'text-[#16643D]' : 'text-[#991B1B]'}`}>{c.label}</span>
                    {c.ok && <span className="ml-auto text-[11px] font-medium text-[#1F7A4C]">Done</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5">
              <h3 className="text-sm font-bold text-[#111827] mb-3 flex items-center gap-2">
                <Sparkles size={14} className="text-[#1F7A4C]" /> Ready to transform
              </h3>
              <p className="text-xs leading-relaxed text-[#6B7280] mb-4">
                Woodpacker will extract chapters, vocabulary, grammar and exercises, link audio & solutions, and build your mastery system.
              </p>
              <div className="rounded-xl bg-[#FAFBFC] border border-[#E5E7EB] p-3 flex items-center justify-between mb-4">
                <span className="text-xs text-[#6B7280]">Files ready</span>
                <span className="text-sm font-bold text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {entries.filter((e) => e.status === 'ok').length} / {entries.length}
                </span>
              </div>
              <button
                onClick={() => void handleTransform()}
                disabled={!isReady}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#16643D] shadow-sm transition-colors"
              >
                <Sparkles size={14} /> Start AI Transformation
              </button>
              {!isReady && <p className="text-xs text-center text-[#9CA3AF] mt-2">Parsing files… please wait</p>}
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#6B7280]">
                <Cloud size={12} /> Secure upload · Progress tracked
              </div>
            </div>

            <div className="rounded-[20px] border border-[#E5E7EB] bg-[#FAFBFC] p-5">
              <h4 className="text-xs font-bold tracking-wide uppercase text-[#6B7280] mb-3">Try an example</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'German A1 Textbook', icon: BookOpen },
                  { label: 'French Dialogues', icon: Mic },
                  { label: 'Spanish Vocabulary', icon: FileText },
                  { label: 'Italian Grammar Notes', icon: FileIcon },
                ].map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => {
                      const fakeFile = new File([], ex.label + '.pdf', { type: 'application/pdf' })
                      setEntries((prev) => [...prev, { file: fakeFile, status: 'pending' }])
                      void (async () => {
                        const entry = { file: fakeFile, status: 'pending' as const }
                        const asset = await parseAsset(fakeFile)
                        setEntries((prev) => prev.map((e) => (e.file === fakeFile ? { ...e, asset, status: 'ok' as const } : e)))
                      })()
                    }}
                    className="p-3 rounded-xl bg-white border border-[#E5E7EB] text-left hover:border-[#1F7A4C]/30 hover:shadow-sm transition-all"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mb-2">
                      <ex.icon size={12} className="text-[#1F7A4C]" />
                    </div>
                    <div className="text-xs font-semibold text-[#111827] leading-tight">{ex.label}</div>
                    <div className="text-[11px] text-[#6B7280]">Sample file</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {entries.length === 0 && stage === 'idle' && (
        <div className="mt-6 grid md:grid-cols-4 gap-3">
          {[
            { label: 'German A1 Textbook', icon: BookOpen, desc: 'PDF textbook' },
            { label: 'French Dialogues', icon: Mic, desc: 'Audio course' },
            { label: 'Spanish Vocabulary', icon: FileText, desc: 'Word list' },
            { label: 'Italian Grammar Notes', icon: FileIcon, desc: 'Study notes' },
          ].map((ex) => (
            <button
              key={ex.label}
              onClick={() => {
                const fakeFile = new File([], ex.label + '.pdf', { type: 'application/pdf' })
                setEntries((prev) => [...prev, { file: fakeFile, status: 'pending' }])
              }}
              className="p-4 rounded-2xl bg-white border border-[#E5E7EB] text-left hover:border-[#1F7A4C]/30 hover:shadow-sm hover:-translate-y-px transition-all"
            >
              <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mb-2">
                <ex.icon size={14} className="text-[#1F7A4C]" />
              </div>
              <div className="text-sm font-semibold text-[#111827]">{ex.label}</div>
              <div className="text-xs text-[#6B7280]">{ex.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* Bottom actions */}
      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]">
          <LayoutDashboard size={14} /> Dashboard
        </Link>
        <Link href="/materials" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]">
          <Library size={14} /> Library
        </Link>
        <Link href="/cycles" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]">
          <RefreshCw size={14} /> Cycles
        </Link>
      </div>
    </div>
  )
}
