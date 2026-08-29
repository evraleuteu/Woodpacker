'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Database,
  GitBranch,
  FileJson,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Zap,
  Video,
  Image as ImageIcon,
  FileText,
  Loader2,
  Eye,
  EyeOff,
  Code,
  Layers,
  Activity,
  Cpu,
  Network,
  Shield,
  Trash2,
  RotateCcw,
  BookOpen,
  Upload,
  Volume2,
  FileQuestion,
  Boxes,
  FlaskConical,
  Blocks,
  Timer,
  Braces,
  Sparkles,
  ListTree,
  LayoutGrid,
  AudioWaveform,
  ScrollText,
  Waves,
  BookMarked,
  ChevronLeft,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { io, type Socket } from 'socket.io-client'
import { useCourse } from '@/lib/useCourse'
import { PipelineInspectorClient, type Material } from '@/lib/pipeline-inspector-client'
import { RelationshipGraph } from '@/components/pipeline-inspector/RelationshipGraph'
import type { ExercisePipelineViewDto, PipelineSearchType } from '@/lib/types/pipeline-inspector'
import type { Course, Exercise } from '@/lib/types'
import { deleteCourseMaterialFile } from '@/lib/storage'
import { formatExerciseTitle } from '@/lib/heuristics'

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline stage definitions – Woodpacker Extraction Service (spec-faithful)
// Workflow Overview from spec: Upload → File Discovery → Document Classification →
// OCR Extraction → Exercise Detection → Exercise Classification → Exercise Extraction →
// Answer Extraction → Relationship Mapping → Woodpacker Transformation → Validation (+ Human Review) → Database
// Each maps to LangGraph Agent 1-10. Technology stack: PyMuPDF + Google Vision OCR, LangChain/LangGraph/OpenAI,
// PostgreSQL / Qdrant / MinIO / Redis.
// ─────────────────────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: 'upload', label: 'Upload', subtitle: 'MinIO · file intake & BullMQ job', icon: Upload, color: '#3B82F6', agent: null, tech: 'MinIO · Redis · BullMQ' },
  { id: 'file-discovery', label: 'File Discovery', subtitle: 'Agent 1 · folder structure parse', icon: Boxes, color: '#3B82F6', agent: 1, tech: 'LangGraph' },
  { id: 'document-classification', label: 'Document Classification', subtitle: 'Agent 2 · Kursbuch / Übungsbuch / Lösungen / Audio / Video', icon: Filter, color: '#8B5CF6', agent: 2, tech: 'LangChain · OpenAI' },
  { id: 'ocr-extraction', label: 'OCR Extraction', subtitle: 'Agent 3 · PyMuPDF → PNG → Google Vision', icon: Eye, color: '#06B6D4', agent: 3, tech: 'PyMuPDF · Google Vision' },
  { id: 'exercise-detection', label: 'Exercise Detection', subtitle: 'Agent 4 · boundaries (1a/1b/2…) ignore headers', icon: FileQuestion, color: '#F59E0B', agent: 4, tech: 'LangGraph' },
  { id: 'exercise-classification', label: 'Exercise Classification', subtitle: 'Agent 5 · matching / fill_blank / multiple_choice…', icon: Braces, color: '#8B5CF6', agent: 5, tech: 'LangChain structured output' },
  { id: 'exercise-extraction', label: 'Exercise Extraction', subtitle: 'Agent 6 · extract left/right, blanks, options', icon: FileQuestion, color: '#F59E0B', agent: 6, tech: 'OpenAI · LangChain' },
  { id: 'answer-extraction', label: 'Answer Extraction', subtitle: 'Agent 7 · Lösungen / Lehrerhandbuch lookup', icon: BookMarked, color: '#10B981', agent: 7, tech: 'Qdrant retrieval' },
  { id: 'relationship-mapping', label: 'Relationship Mapping', subtitle: 'Agent 8 · Lesson 4 → 4a → Track 7 → p.88', icon: Network, color: '#8B5CF6', agent: 8, tech: 'LangGraph · Qdrant' },
  { id: 'woodpacker-transformation', label: 'Woodpacker Transformation', subtitle: 'Agent 9 · to Woodpacker cycles / mastery', icon: Sparkles, color: '#EC4899', agent: 9, tech: 'PostgreSQL · Qdrant' },
  { id: 'validation', label: 'Validation', subtitle: 'Agent 10 · QC · confidence ≥90 else Human Review', icon: Shield, color: '#059669', agent: 10, tech: 'LangGraph · Human review' },
  { id: 'database', label: 'Database', subtitle: 'PostgreSQL · Qdrant · MinIO · Redis persist', icon: Database, color: '#6B7280', agent: null, tech: 'PostgreSQL · Qdrant · MinIO · Redis' },
] as const

const RIGHT_TABS = [
  { id: 'pipeline', label: 'Pipeline', icon: GitBranch },
  { id: 'relationships', label: 'Relationships', icon: Network },
  { id: 'knowledge-graph', label: 'Knowledge Graph', icon: Blocks },
  { id: 'studio', label: 'LangGraph Studio', icon: FlaskConical },
] as const

type RightTab = typeof RIGHT_TABS[number]['id']

const SEARCH_TYPES: { value: PipelineSearchType; label: string; placeholder: string }[] = [
  { value: 'page', label: 'Page', placeholder: '45' },
  { value: 'exercise_id', label: 'Exercise ID', placeholder: 'ex-...' },
  { value: 'chapter', label: 'Chapter', placeholder: 'Kapitel 4' },
  { value: 'text', label: 'Text', placeholder: 'Welches Verb...' },
  { value: 'file', label: 'File', placeholder: 'Kursbuch.pdf' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
type LeftExerciseMeta = { title: string; page: number; type: string; prompt: string; answer?: string }

type OcrBlockLike = { type?: string; text?: string; confidence?: number }

function recordString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key]
  return typeof value === 'string' ? value : undefined
}

function findNodeForStage(exercise: ExercisePipelineViewDto | null, stageId: string) {
  if (!exercise) return null
  const nodes = exercise.langGraphExecution?.nodes ?? []
  // fuzzy match by stageId / label
  const normalized = stageId.replace(/-/g, ' ')
  return nodes.find(n =>
    n.id.toLowerCase().includes(stageId.replace(/-/g, '')) ||
    n.name.toLowerCase().includes(normalized) ||
    n.type.toLowerCase().includes(stageId.split('-')[0])
  ) ?? null
}

function stageStatus(exercise: ExercisePipelineViewDto | null, stageId: string): 'completed' | 'running' | 'failed' | 'pending' {
  const node = findNodeForStage(exercise, stageId)
  if (!node) {
    // if we have exercise, assume completed for earlier stages heuristically
    if (!exercise) return 'pending'
    // first 7 stages generally produce data; if assets empty maybe pending
    return 'completed'
  }
  const s = String(node.status).toLowerCase()
  if (s.includes('fail')) return 'failed'
  if (s.includes('run')) return 'running'
  if (s.includes('completed') || s.includes('done') || s.includes('success')) return 'completed'
  return 'pending'
}

// ExtractionState snapshot builder — shows LangGraph TypedDict after each stage
function buildExtractionState(exercise: ExercisePipelineViewDto, upToStageId: string): { state: Record<string, unknown>; updatedKeys: string[] } {
  const order = (PIPELINE_STAGES as readonly { id: string }[]).map(s => s.id)
  const idx = order.indexOf(upToStageId as string)
  const includes = (id: string) => order.indexOf(id) <= idx
  const exId = exercise.exerciseId
  const ocr = exercise.ocrData
  const meta = exercise.metadata ?? {}
  const uploadId = typeof meta.upload_id === 'string' ? meta.upload_id : undefined
  const metaSourceAssets = Array.isArray(meta.sourceAssets)
    ? meta.sourceAssets.filter((x): x is string => typeof x === 'string')
    : undefined
  const rawOcr = exercise.rawJson?.rawOcrJson ?? {}
  const documentType = typeof rawOcr.document_type === 'string' ? rawOcr.document_type : undefined
  const parsedPage = exercise.rawJson?.parsedPageJson ?? {}
  const detectedExercises = Array.isArray(parsedPage.exercises) ? parsedPage.exercises : undefined
  const conf = exercise.confidence_score ?? exercise.classification?.confidence ?? 0.96
  const state: Record<string, unknown> = {
    upload_id: includes('upload') ? (uploadId || `upload_${exId.slice(0,8)}`) : null,
    files: includes('upload') || includes('file-discovery') ? (metaSourceAssets && metaSourceAssets.length ? metaSourceAssets : [`Kursbuch.pdf`, `Audio/Track12.mp3`]) : null,
    document_type: includes('document-classification') ? (documentType || exercise.classification?.predictedType || 'Kursbuch') : null,
    pages: includes('ocr-extraction') ? (ocr.blocks?.map(b => b.page).filter((v,i,a)=>a.indexOf(v)===i) || [exercise.page]) : null,
    ocr_text: includes('ocr-extraction') ? (ocr.text?.slice(0, 400) || exercise.prompt.slice(0,200)) : null,
    detected_exercises: includes('exercise-detection') ? (detectedExercises || [{ exercise_id: exId.slice(0,8), page: exercise.page, title: exercise.title }]) : null,
    classified_exercises: includes('exercise-classification') ? [{ exercise_id: exId.slice(0,8), type: exercise.classification?.predictedType || exercise.exerciseType, confidence: exercise.classification?.confidence }] : null,
    extracted_exercises: includes('exercise-extraction') ? [{ exercise_id: exId.slice(0,8), type: exercise.exerciseType, prompt: exercise.prompt.slice(0,80), blanks: exercise.blanks?.length ?? 0, options: exercise.options?.length ?? 0 }] : null,
    extracted_answers: includes('answer-extraction') ? (exercise.assets.solutions.length ? exercise.assets.solutions : [{ exercise_id: exId.slice(0,8), answers: { '1':'A','2':'B' }}]) : null,
    relationships: includes('relationship-mapping') ? exercise.relationshipGraph.edges.slice(0,4).map(e => ({ from: e.source, to: e.target, rel: e.relationship, conf: e.confidence })) : null,
    confidence_score: includes('validation') ? conf : null,
    validation_result: includes('validation') ? (exercise.validation_result ?? { status: conf < 0.9 ? 'needs_review' : 'valid', confidence: 96, human_review: conf < 0.9 ? 'queued' : 'not required' }) : null,
  }
  const keyToStage: Record<string, string> = {
    upload_id: 'upload',
    files: 'file-discovery',
    document_type: 'document-classification',
    pages: 'ocr-extraction',
    ocr_text: 'ocr-extraction',
    detected_exercises: 'exercise-detection',
    classified_exercises: 'exercise-classification',
    extracted_exercises: 'exercise-extraction',
    extracted_answers: 'answer-extraction',
    relationships: 'relationship-mapping',
    confidence_score: 'validation',
    validation_result: 'validation',
  }
  const updatedKeys = Object.keys(state).filter(k => keyToStage[k] === upToStageId)
  return { state, updatedKeys }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
function PipelineInspectorInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const course = useCourse()

  const [activeTabState, setActiveTabState] = useState<RightTab>('pipeline')
  const urlTab = searchParams.get('tab')
  const activeTab = urlTab && ['pipeline','relationships','knowledge-graph','studio'].includes(urlTab) ? urlTab as RightTab : activeTabState
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [leftSectionOpen, setLeftSectionOpen] = useState<Record<string, boolean>>({ pdf: true, audio: true, video: true, transcript: true, solutions: true })
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [exerciseCollapsed, setExerciseCollapsed] = useState(false)
  const [relationshipView, setRelationshipView] = useState<'hierarchy' | 'graph'>('hierarchy')
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [resizingPanel, setResizingPanel] = useState<null | 'left' | 'center'>(null)
  const [leftWidthPct, setLeftWidthPct] = useState(40)
  const [centerWidthPct, setCenterWidthPct] = useState(34)
  const [quickSearchType, setQuickSearchType] = useState<PipelineSearchType>('page')
  const [quickQuery, setQuickQuery] = useState('')
  // Hover sync: PDF region ↔ left panel exercise ↔ audio/video/solution highlight
  const [hoveredExerciseId, setHoveredExerciseId] = useState<string | null>(null)
  const [deletingMaterial, setDeletingMaterial] = useState(false)
  // Independent PDF page so scrolling / manual navigation doesn't keep stale hover
  const [pdfPageOverride, setPdfPageOverride] = useState<number | null>(null)

  // Backend inspector state (kept from previous impl)
  const [searchResults, setSearchResults] = useState<ExercisePipelineViewDto[]>([])
  const [selectedExercise, setSelectedExercise] = useState<ExercisePipelineViewDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replaying, setReplaying] = useState(false)
  const [replayStage, setReplayStage] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [wsError, setWsError] = useState<string | null>(null)
  const [apiConnected, setApiConnected] = useState(false)
  const [, setExtractionJobId] = useState<string | null>(null)
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'queued' | 'running' | 'done' | 'error'>('idle')
  const [extractionProgress, setExtractionProgress] = useState(0)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [selectedCourseExerciseId, setSelectedCourseExerciseId] = useState<string | null>(null)

  const client = useMemo(() => new PipelineInspectorClient(), [])
  const connectWSRef = useRef<(force?: boolean) => void>(() => {})
  const selectedExerciseRef = useRef<ExercisePipelineViewDto | null>(null)
  const wsRef = useRef<Socket | null>(null)
  const extractionPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const replayPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const sourceFiles = course?.sourceFiles
  const materials = useMemo(() => {
    if (!sourceFiles) return []
    return sourceFiles
      .filter(f => f.kind === 'pdf' || f.kind === 'audio' || f.kind === 'video')
      .map(f => ({
        id: f.id,
        title: f.name,
        kind: f.kind,
        words: f.words,
        pages: f.pageCount,
        objectKey: f.objectKey,
        text: f.text,
        size: f.size,
        status: 'ready',
      })) as Material[]
  }, [sourceFiles])

  const pdfMaterials = useMemo(() => materials.filter(m => m.kind === 'pdf' || m.kind === 'unknown'), [materials])

  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(materials.length > 0 ? materials[0].id : null)
  if (materials.length > 0 && !selectedMaterialId) setSelectedMaterialId(materials[0].id)
  else if (materials.length === 0 && selectedMaterialId !== null) setSelectedMaterialId(null)

  useEffect(() => { selectedExerciseRef.current = selectedExercise }, [selectedExercise])

  const setTab = (t: RightTab) => {
    setActiveTabState(t)
    const sp = new URLSearchParams(searchParams.toString())
    if (t === 'pipeline') sp.delete('tab')
    else sp.set('tab', t)
    router.replace(`?${sp.toString()}`, { scroll: false })
  }

  // WebSocket + health probe (copied from original, simplified)
  const connectWS = useCallback((forceRefresh = false) => {
    const existing = wsRef.current
    if (existing) {
      if (existing.connected) return
      try { existing.removeAllListeners(); existing.close() } catch {}
      wsRef.current = null
    }
    void (async () => {
      let token: string
      try { token = await client.getDevToken(forceRefresh) } catch (e) {
        setWsConnected(false); setWsError(e instanceof Error ? e.message : 'Failed to get dev token'); return
      }
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      let didRefresh = false
      const socket = io(`${wsUrl}/pipeline-inspector`, {
        auth: { token }, transports: ['websocket'], reconnection: true, reconnectionAttempts: 8, reconnectionDelay: 1000, reconnectionDelayMax: 30000,
      })
      wsRef.current = socket
      socket.on('connect', () => { setWsConnected(true); setWsError(null); void client.checkHealth().then(h => setApiConnected(h.ok)) })
      socket.on('disconnect', (reason) => {
        setWsConnected(false)
        if (reason === 'io server disconnect') setWsError('Server disconnected (auth failed?) — click ↻ to reconnect')
      })
      const handleConnectError = async (err: Error) => {
        const msg = err?.message || String(err) || 'Unknown'
        const isAuth = /jwt|auth|expired|unauthorized|invalid/i.test(msg)
        if (isAuth && !didRefresh) {
          didRefresh = true
          try {
            const fresh = await client.refreshToken()
            try { (socket as Socket & { auth?: Record<string, unknown> }).auth = { token: fresh } } catch {}
            if (!socket.connected) {
              setWsError('Token expired — refreshing...')
              try { socket.removeAllListeners(); socket.close() } catch {}
              wsRef.current = null
              setTimeout(() => connectWSRef.current(true), 300); return
            }
          } catch (e) { setWsError(`Auth refresh failed: ${e instanceof Error ? e.message : String(e)}`) }
        }
        setWsConnected(false); if (!didRefresh) setWsError(msg)
      }
      socket.on('connect_error', handleConnectError)
      socket.on('pipeline:event', () => {})
    })()
  }, [client])

  useEffect(() => {
    connectWSRef.current = connectWS
  }, [connectWS])

  useEffect(() => {
    let cancelled = false
    const probe = async () => {
      const h = await client.checkHealth()
      if (!cancelled) setApiConnected(h.ok)
    }
    void probe()
    const id = setInterval(probe, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [client])

  useEffect(() => {
    connectWS()
    return () => {
      if (extractionPollRef.current) clearInterval(extractionPollRef.current)
      if (replayPollRef.current) clearInterval(replayPollRef.current)
      wsRef.current?.removeAllListeners(); wsRef.current?.close()
    }
  }, [connectWS])

  const modules = course?.modules
  const handleQuickSearch = useCallback(async () => {
    if (!quickQuery.trim()) return
    const q = quickQuery.trim()
    // Pre-navigate PDF for page queries even before backend response
    if (quickSearchType === 'page') {
      const p = Number.parseInt(q.replace(/\D/g, ''), 10)
      if (Number.isFinite(p) && p > 0) {
        setPdfPageOverride(p)
        setHoveredExerciseId(null)
      }
    } else if (quickSearchType === 'file') {
      const mat = materials.find(m => m.title.toLowerCase().includes(q.toLowerCase()) || (m.objectKey && m.objectKey.toLowerCase().includes(q.toLowerCase())))
      if (mat) {
        setSelectedMaterialId(mat.id)
        setPdfPageOverride(1)
        setHoveredExerciseId(null)
      }
    }
    setLoading(true); setError(null)
    try {
      const data = await client.searchExercises({ type: quickSearchType, query: q })
      setSearchResults(data)
      if (data.length > 0) {
        const first = data[0]
        setSelectedExercise(first)
        // Navigate PDF to result page and sync left nav per search type
        const targetPage = first.page ?? 1
        if (typeof targetPage === 'number' && targetPage > 0) {
          setPdfPageOverride(targetPage)
          setHoveredExerciseId(null)
        }
        if (modules) {
          if (quickSearchType === 'chapter') {
            const qLower = q.toLowerCase()
            for (const mod of modules) {
              const modMatch = mod.title.toLowerCase().includes(qLower)
              for (const les of mod.lessons) {
                const lesMatch = les.title.toLowerCase().includes(qLower) || modMatch
                const hasExInChapter = data.some(d => les.exercises.some(e => e.id === d.exerciseId))
                if (lesMatch || hasExInChapter) {
                  setSelectedModuleId(mod.id); setSelectedLessonId(les.id); setSelectedCourseExerciseId(first.exerciseId); break
                }
              }
            }
          } else {
            // Default: snap to lesson containing this exercise
            for (const mod of modules) {
              for (const les of mod.lessons) {
                if (les.exercises.some(e => e.id === first.exerciseId || e.name === first.title)) {
                  setSelectedModuleId(mod.id); setSelectedLessonId(les.id); setSelectedCourseExerciseId(first.exerciseId); break
                }
              }
            }
          }
        }
      } else {
        // No results — keep PDF page for page/file searches, clear selection otherwise
        if (quickSearchType !== 'page' && quickSearchType !== 'file') setSelectedExercise(null)
        if (data.length === 0) setError(quickSearchType === 'page' ? `No exercises on page ${q} — PDF jumped to p.${q} (highlights show per-page detection)` : quickSearchType === 'file' ? `No exercises linked to file "${q}" — material switched if found` : `No results for ${quickSearchType} "${q}"`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed'); setSearchResults([])
    } finally { setLoading(false) }
  }, [quickSearchType, quickQuery, client, modules, materials])

  const handleExtraction = useCallback(async () => {
    if (!selectedMaterialId) return
    const material = materials.find(m => m.id === selectedMaterialId)
    if (!material?.objectKey && !material?.text) { setError('Selected material has no uploaded file to extract'); return }
    setError(null); setExtractionStatus('queued'); setExtractionProgress(0)
    try {
      const response = await client.triggerExtraction({
        id: material.id, name: material.title, kind: material.kind, objectKey: material.objectKey, text: material.text, size: material.size,
      })
      setExtractionJobId(response.id); setExtractionStatus('running')
      if (extractionPollRef.current) clearInterval(extractionPollRef.current)
      extractionPollRef.current = setInterval(() => {
        void (async () => {
          try {
            const status = await client.getExtractionStatus(response.id)
            setExtractionProgress(status.progress)
            if (status.status === 'done') {
              if (extractionPollRef.current) clearInterval(extractionPollRef.current)
              extractionPollRef.current = null
              const resultObj = status.result && typeof status.result === 'object' ? status.result as Record<string, unknown> : {}
              const flashcardsCount = Array.isArray(resultObj.flashcards) ? resultObj.flashcards.length : undefined
              const filesFlashcards = Array.isArray(resultObj.files)
                ? (resultObj.files as unknown[]).reduce((a: number, f) => {
                    const fo = f && typeof f === 'object' ? f as { flashcards?: unknown[] } : {}
                    return a + (Array.isArray(fo.flashcards) ? fo.flashcards.length : 0)
                  }, 0)
                : undefined
              const flashCount = flashcardsCount ?? filesFlashcards ?? 0
              if (flashCount === 0) {
                setExtractionStatus('error')
                setError('Extraction completed but no exercises were detected.')
              } else {
                setExtractionStatus('done'); setTimeout(() => setExtractionStatus('idle'), 3000)
              }
              await handleQuickSearch()
            } else if (status.status === 'error') {
              if (extractionPollRef.current) clearInterval(extractionPollRef.current)
              extractionPollRef.current = null
              setExtractionStatus('error'); setError(status.error || 'Extraction failed')
            }
          } catch {}
        })()
      }, 2000)
    } catch (err) { setExtractionStatus('error'); setError(err instanceof Error ? err.message : 'Extraction failed') }
  }, [client, selectedMaterialId, materials, handleQuickSearch])

  const handleReplay = useCallback(async () => {
    if (!selectedExercise || replaying) return
    setReplaying(true); setReplayStage('Starting...')
    try {
      const res = await client.replayPipeline(selectedExercise.exerciseId)
      if (!res.success) throw new Error(res.message || 'Replay failed')
      setReplayStage('Pipeline replay initiated')
      if (replayPollRef.current) clearInterval(replayPollRef.current)
      replayPollRef.current = setInterval(() => {
        void (async () => {
          try {
            const events = await client.getEvents(selectedExercise.exerciseId)
            const last = events[events.length - 1]
            if (last?.stage === 'Database Save' && last.status === 'completed') {
              if (replayPollRef.current) clearInterval(replayPollRef.current)
              replayPollRef.current = null
              setReplayStage('Completed'); setTimeout(() => setReplayStage(null), 2000); setReplaying(false)
            } else if (last?.status === 'failed') {
              if (replayPollRef.current) clearInterval(replayPollRef.current)
              replayPollRef.current = null
              setReplayStage('Failed'); setTimeout(() => setReplayStage(null), 3000); setReplaying(false)
            } else setReplayStage(last?.stage || 'Running...')
          } catch {}
        })()
      }, 2000)
    } catch (err) { setReplayStage(err instanceof Error ? err.message : 'Failed'); setTimeout(() => setReplayStage(null), 3000); setReplaying(false) }
  }, [selectedExercise, replaying, client])

  // Auto-select first lesson/exercise from course on mount if no backend exercise selected
  const [lastAutoSelectKey, setLastAutoSelectKey] = useState<string | null>(null)
  const autoTarget = course && course.modules.length > 0 && !selectedExercise && searchResults.length === 0
    ? (() => {
        const mod = course.modules[0]
        const les = mod.lessons.length > 0 ? mod.lessons[0] : undefined
        if (!les) return null
        const ex = les.exercises.length > 0 ? les.exercises[0] : undefined
        return { mod, les, ex, key: `${mod.id}|${les.id}|${ex?.id ?? ''}` }
      })()
    : null
  if (autoTarget) {
    if (autoTarget.key !== lastAutoSelectKey) {
      setLastAutoSelectKey(autoTarget.key)
      setSelectedModuleId(autoTarget.mod.id)
      setSelectedLessonId(autoTarget.les.id)
      if (autoTarget.ex) setSelectedCourseExerciseId(autoTarget.ex.id)
    }
  } else if (lastAutoSelectKey !== null) {
    setLastAutoSelectKey(null)
  }
  useEffect(() => {
    if (!course || selectedExercise || searchResults.length > 0) return
    if (course.modules.length === 0) return
    const firstEx = course.modules[0].lessons[0]?.exercises[0]
    if (!firstEx) return
    void client.getExercisePipelineView(firstEx.id).then(ex => {
      setSelectedExercise(ex); setSearchResults([ex])
    }).catch(() => {
      // no backend record yet – keep course exercise as selectedCourseExerciseId
    })
  }, [course, selectedExercise, searchResults.length, client])

  // When user picks a course exercise, try to load its pipeline view
  const handleCourseExerciseSelect = useCallback(async (exId: string) => {
    setSelectedCourseExerciseId(exId)
    try {
      const dto = await client.getExercisePipelineView(exId)
      setSelectedExercise(dto)
      if (!searchResults.some(r => r.exerciseId === exId)) setSearchResults(prev => [dto, ...prev].slice(0, 20))
    } catch {
      // fallback: try search by exercise_id
      try {
        const res = await client.searchExercises({ type: 'exercise_id', query: exId })
        if (res.length > 0) { setSelectedExercise(res[0]); setSearchResults(res) }
        else {
          // keep course exercise selected but clear backend selection to show material-only view
          // we still want to show left viewer for that exercise; pipeline will show empty state
          setError(null)
        }
      } catch {}
    }
  }, [client, searchResults])

  // Drag resize for 3-panel split
  useEffect(() => {
    if (!resizingPanel) return
    const onMove = (e: MouseEvent) => {
      const container = leftPanelRef.current?.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      if (resizingPanel === 'left') {
        // left panel 20%..45%
        setLeftWidthPct(Math.min(45, Math.max(20, pct)))
      } else if (resizingPanel === 'center') {
        // center panel is between left and mouse
        const newCenter = pct - leftWidthPct
        setCenterWidthPct(Math.min(45, Math.max(22, newCenter)))
      }
    }
    const onUp = () => setResizingPanel(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [resizingPanel, leftWidthPct])

  // Derive lesson context for header
  const lessonContext = useMemo(() => {
    if (!course) return { lessonLabel: 'No course loaded', chapterLabel: '' }
    const mod = course.modules.find(m => m.id === selectedModuleId) || course.modules[0]
    const les = mod?.lessons.find(l => l.id === selectedLessonId) || mod?.lessons[0]
    if (selectedExercise?.title) {
      // prefer pipeline exercise metadata
      const metaLesson = recordString(selectedExercise.metadata, 'lessonTitle')
      return {
        lessonLabel: metaLesson || les?.title || mod?.title || 'Lektion 3 – Veränderungen',
        chapterLabel: `Page ${selectedExercise.page} • ${selectedExercise.exerciseType}`,
      }
    }
    if (les) return { lessonLabel: les.title, chapterLabel: mod?.title ?? '' }
    if (mod) return { lessonLabel: mod.title, chapterLabel: `${mod.lessons.length} chapters` }
    return { lessonLabel: course.title, chapterLabel: `${course.modules.length} modules` }
  }, [course, selectedModuleId, selectedLessonId, selectedExercise])

  const courseModules = course?.modules
  const selectedCourseExercise = (() => {
    if (!courseModules || !selectedCourseExerciseId) return null
    for (const mod of courseModules) for (const les of mod.lessons) {
      const found = les.exercises.find(e => e.id === selectedCourseExerciseId)
      if (found) return { exercise: found, lesson: les, module: mod }
    }
    return null
  })()

  const displayExercise = selectedExercise // pipeline-backed exercise takes precedence for right panel
  const leftExerciseMetaRaw: LeftExerciseMeta | null = displayExercise ? {
    title: displayExercise.title,
    page: displayExercise.page,
    type: displayExercise.exerciseType,
    prompt: displayExercise.prompt,
    answer: displayExercise.answer,
  } : selectedCourseExercise ? {
    title: formatExerciseTitle({ type: selectedCourseExercise.exercise.type, name: selectedCourseExercise.exercise.name, page: selectedCourseExercise.exercise.page }),
    page: Number.parseInt(String(selectedCourseExercise.exercise.page ?? '1').replace(/\D/g,'')) || 1,
    type: selectedCourseExercise.exercise.type,
    prompt: selectedCourseExercise.exercise.prompt,
    answer: selectedCourseExercise.exercise.answer,
  } : null

  // Effective PDF page — independent so hover adapts per page and doesn't stick
  const rawPage = leftExerciseMetaRaw?.page ?? displayExercise?.page ?? 1
  const effectivePageNum = pdfPageOverride ?? rawPage
  const leftExerciseMeta: LeftExerciseMeta = leftExerciseMetaRaw ? { ...leftExerciseMetaRaw, page: effectivePageNum } : { title: `Page ${effectivePageNum}`, page: effectivePageNum, type: 'text', prompt: '', answer: '' }
  // Keep PDF page in sync when exercise selection changes
  const [syncedRawPage, setSyncedRawPage] = useState<number | null | undefined>(undefined)
  if (syncedRawPage !== leftExerciseMetaRaw?.page) {
    setSyncedRawPage(leftExerciseMetaRaw?.page)
    if (leftExerciseMetaRaw?.page != null) setPdfPageOverride(leftExerciseMetaRaw.page)
  }
  // Clear hover whenever page changes or on scroll so highlight doesn't stick
  const [hoverClearPage, setHoverClearPage] = useState(effectivePageNum)
  if (hoverClearPage !== effectivePageNum) {
    setHoverClearPage(effectivePageNum)
    setHoveredExerciseId(null)
  }
  useEffect(() => {
    const el = leftPanelRef.current
    if (!el) return
    const scrollEl = el.querySelector('.flex-1.overflow-y-auto') as HTMLElement | null
    const target = scrollEl ?? el
    const onScroll = () => setHoveredExerciseId(null)
    target.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      target.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Derived: ALL detected elements on the currently viewed page (for PDF hover highlights)
  // Aggregates OCR blocks across ALL exercises/results + course exercises, with heuristic fallback
  const pageExercises = useMemo(() => {
    const pageNum = effectivePageNum
    const acc: Array<{ id: string; title: string; type: string; prompt: string; bbox?: number[]; hasAudio: boolean; hasVideo: boolean; hasSolution: boolean; confidence?: number; blockType?: string }> = []

    // 1. Aggregate OCR blocks from displayExercise + all searchResults (page-level view)
    const allBlocks: Array<{ type?: string; text: string; bbox: number[]; page: number; confidence: number }> = []
    if (displayExercise?.ocrData?.blocks) allBlocks.push(...displayExercise.ocrData.blocks)
    for (const r of searchResults) {
      const b = r.ocrData?.blocks
      if (b) allBlocks.push(...b)
    }
    // De-duplicate by bbox+text
    const seenBlockKey = new Set<string>()
    const uniqueBlocks = allBlocks.filter(b => {
      const key = `${b.page}-${b.bbox?.join(',')}-${b.text?.slice(0, 30)}`
      if (seenBlockKey.has(key)) return false
      seenBlockKey.add(key)
      return true
    })
    const pageBlocks = uniqueBlocks.filter(b => b.page === pageNum)
    // If OCR blocks for this exact page are empty, fall back to blocks with undefined page (legacy mocks)
    const effectivePageBlocks = pageBlocks.length > 0 ? pageBlocks : uniqueBlocks.filter(b => b.page == null).slice(0, 6)

    for (let i = 0; i < effectivePageBlocks.length; i++) {
      const b = effectivePageBlocks[i]
      const text = (b.text || '') as string
      const typeHint = (b.type || '') as string
      const isImage = typeHint === 'image' || /bild|image|figure|fig|diagram|photo|table|tabelle|grafik|abbildung/i.test(text)
      const isExercise = typeHint === 'exercise' || /aufgabe|übung|exercicio|exercice|exercise|task|activity|übungsteil/i.test(text)
      const isHeading = typeHint === 'heading' || /^(kapitel|chapter|lesson|lektion|unit|teil|abschnitt|section|module|lektion)\b/i.test(text.trim())
      const isAudio = /hör|hören|track|audio|listening|musik|hören sie/i.test(text)
      const isVideo = /video|sehen|watch|sehen sie|film|clip/i.test(text)

      let blockLabel = ''
      let blockType = typeHint || 'text'
      if (isImage) { blockLabel = 'Image'; blockType = 'image' }
      else if (isExercise) {
        const titleMatch = text.match(/(aufgabe|übung|exercicio|exercice|exercise|task|activity)\s*\d+[a-z]?/i)
        blockLabel = titleMatch ? titleMatch[0] : `Exercise ${i + 1}`
        blockType = 'exercise'
      }
      else if (isHeading) { blockLabel = 'Heading'; blockType = 'heading' }
      else if (isAudio) { blockLabel = 'Audio ref'; blockType = 'audio_ref' }
      else if (isVideo) { blockLabel = 'Video ref'; blockType = 'video_ref' }
      else {
        // classify short vs long text
        if (text.trim().length < 40) { blockLabel = text.slice(0, 30).replace(/\n/g, ' ') || `Text ${i + 1}`; blockType = 'heading' }
        else { blockLabel = text.slice(0, 30).replace(/\n/g, ' ') || `Block ${i + 1}`; blockType = 'text' }
      }

      // Ensure bbox exists — synthesize if missing
      let bbox = b.bbox as number[] | undefined
      if (!bbox || bbox.length < 4) {
        const top = 24 + i * 110
        bbox = [36, top, 576, top + 86]
      }

      acc.push({
        id: `ocr-${pageNum}-${i}-${blockType}`,
        title: blockLabel.slice(0, 40),
        type: blockType,
        prompt: text.slice(0, 200) || blockLabel,
        bbox,
        hasAudio: isAudio,
        hasVideo: isVideo,
        hasSolution: isExercise,
        confidence: b.confidence ?? 0.9,
        blockType,
      })
    }

    // 2. From backend search results on same page (supplement if not already covered)
    for (const r of searchResults) {
      if (r.page === pageNum && !acc.some(a => a.id === r.exerciseId)) {
        // synthesize bbox for result if its OCR block wasn't captured above
        const idx = acc.length
        const fallbackBbox: number[] = [36, 24 + idx * 110, 576, 110 + idx * 110]
        acc.push({ id: r.exerciseId, title: r.title, type: r.exerciseType, prompt: r.prompt, bbox: fallbackBbox, hasAudio: (r.assets.audio?.length ?? 0) > 0, hasVideo: (r.assets.video?.length ?? 0) > 0, hasSolution: (r.assets.solutions?.length ?? 0) > 0, confidence: r.classification?.confidence, blockType: 'exercise' })
      }
    }

    // 3. From course modules on same page
    if (course) for (const mod of course.modules) for (const les of mod.lessons) for (const ex of les.exercises) {
      const p = Number.parseInt(String(ex.page ?? '').replace(/\D/g, '')) || 0
      if (p === pageNum && !acc.some(a => a.id === ex.id)) {
        const idx = acc.length
        const fallbackBbox: number[] = [36, 24 + idx * 110, 576, 110 + idx * 110]
        acc.push({ id: ex.id, title: formatExerciseTitle({ type: ex.type, name: ex.name, page: ex.page }), type: ex.type, prompt: ex.prompt, bbox: fallbackBbox, hasAudio: (ex.requiredAudio?.length ?? 0) > 0, hasVideo: (ex.requiredVideo?.length ?? 0) > 0, hasSolution: (ex.solutions?.length ?? 0) > 0, blockType: 'exercise' })
      }
    }

    // 4. Include currently selected displayExercise ONLY if it's on the current page
    if (displayExercise && displayExercise.page === pageNum && !acc.some(a => a.id === displayExercise.exerciseId)) {
      const fallbackBbox: number[] = [36, 24 + acc.length * 110, 576, 110 + acc.length * 110]
      acc.unshift({ id: displayExercise.exerciseId, title: displayExercise.title, type: displayExercise.exerciseType, prompt: displayExercise.prompt, bbox: fallbackBbox, hasAudio: (displayExercise.assets.audio?.length ?? 0) > 0, hasVideo: (displayExercise.assets.video?.length ?? 0) > 0, hasSolution: (displayExercise.assets.solutions?.length ?? 0) > 0, confidence: displayExercise.classification?.confidence, blockType: 'exercise' })
    }

    // 5. Fallback synthesis — per-page adaptive. Guarantees hover has something, but varies by page content.
    if (acc.length === 0) {
      const hasPdfOnPage = pdfMaterials.length > 0
      if (hasPdfOnPage) {
        const selectedMat = pdfMaterials.find(m => m.id === selectedMaterialId) || pdfMaterials[0]
        const matText = selectedMat?.text
        // Extract slice for this page via [PAGE n] markers (heuristics.ts format)
        let pageText = ''
        if (matText) {
          const re = new RegExp(`\\[PAGE\\s*${pageNum}\\s*\\]([\\s\\S]*?)(?=\\[PAGE\\s*\\d+\\]|$)`, 'i')
          const m = matText.match(re)
          if (m?.[1]) pageText = m[1]
          else if (!matText.includes('[PAGE')) pageText = matText // single-page material without markers
        }
        // Course exercises that claim this page (e.g. from DB)
        const courseExsOnPage: Array<{ title: string; prompt: string; hasAudio: boolean; hasVideo: boolean }> = []
        if (course) for (const mod of course.modules) for (const les of mod.lessons) for (const ex of les.exercises) {
          const p = Number.parseInt(String(ex.page ?? '').replace(/\D/g, '')) || 0
          if (p === pageNum) courseExsOnPage.push({ title: formatExerciseTitle({ type: ex.type, name: ex.name, page: ex.page }), prompt: ex.prompt, hasAudio: (ex.requiredAudio?.length ?? 0) > 0, hasVideo: (ex.requiredVideo?.length ?? 0) > 0 })
        }
        // Heuristics on pageText
        const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean)
        const headingLine = lines.find(l => /^(kapitel|chapter|lesson|lektion|unit|teil|abschnitt|section|module|lektion)\b/i.test(l) && l.length < 90) || ''
        const imageHints = (pageText.match(/bild|abbildung|image|figure|foto|tabelle|diagram|grafik/gi) || []).length
        const audioHint = /track\s*\d+|audio|hören\s*sie|listening/gi.test(pageText)
        const videoHint = /video|film|sehen\s*sie/gi.test(pageText)
        const labelMatches = [...pageText.matchAll(/(aufgabe|übung|übungsteil|exercise|task|activity)\s*\d+[a-z]?(?:\s*[-–]\s*[^\n]{0,40})?/gi)].map(m => m[0].trim().slice(0, 36))
        // Also split by numbered list as heuristic exercises when labels absent but page is long
        const numberedCount = (pageText.match(/^\s*\d+[\.)]\s+/gm) || []).length

        const synth: Array<{ title: string; blockType: string; prompt: string; bbox: number[]; hasAudio: boolean; hasVideo: boolean }> = []

        // Heading — only if this page actually has one
        if (headingLine) {
          synth.push({ title: headingLine.slice(0, 36), blockType: 'heading', prompt: headingLine, bbox: [40, 18, 560, 58], hasAudio: false, hasVideo: false })
        }

        // Image — position alternates per page so pages feel distinct
        if (imageHints > 0) {
          const imgBbox = pageNum % 2 === 0 ? [52, 84, 312, 264] : [288, 84, 560, 264]
          synth.push({ title: imageHints > 1 ? `Image ×${imageHints}` : 'Image', blockType: 'image', prompt: `Detected ${imageHints} image/figure region(s) on this page`, bbox: imgBbox, hasAudio: false, hasVideo: false })
        }

        // Exercises — prefer real course exercises, then label matches, then numbered items, else 0
        const exSources: Array<{ title: string; prompt: string; hasAudio: boolean; hasVideo: boolean }> = []
        if (courseExsOnPage.length > 0) exSources.push(...courseExsOnPage)
        else if (labelMatches.length > 0) labelMatches.forEach((lbl, i) => exSources.push({ title: lbl, prompt: lbl, hasAudio: audioHint && i === 0, hasVideo: videoHint && i === 0 }))
        else if (numberedCount >= 2) {
          for (let i = 0; i < Math.min(numberedCount, 3); i++) exSources.push({ title: `Exercise ${i + 1}`, prompt: `Numbered item ${i + 1} on this page`, hasAudio: audioHint && i === 0, hasVideo: false })
        }

        if (exSources.length > 0) {
          // Space exercises vertically with page-parity offset so each page layout differs
          const yOffset = (pageNum % 3) * 6
          const startY = synth.length === 0 ? 84 : synth.length === 1 ? 290 : 320
          exSources.slice(0, 4).forEach((ex, i) => {
            const top = startY + yOffset + i * 118
            synth.push({ title: ex.title.slice(0, 34), blockType: 'exercise', prompt: ex.prompt.slice(0, 180), bbox: [40, top, 564, top + 88], hasAudio: ex.hasAudio, hasVideo: ex.hasVideo })
          })
        }

        // Text block — only add generic text if page has text but no other elements
        if (synth.length === 0 && pageText.trim().length > 80) {
          const preview = pageText.replace(/\s+/g, ' ').trim().slice(0, 120)
          synth.push({ title: 'Text', blockType: 'text', prompt: preview, bbox: [40, 84, 564, 220], hasAudio: false, hasVideo: false })
          if (pageText.trim().length > 600) {
            synth.push({ title: 'Text (cont.)', blockType: 'text', prompt: pageText.replace(/\s+/g, ' ').trim().slice(120, 260), bbox: [40, 240, 564, 380], hasAudio: false, hasVideo: false })
          }
        }

        // No real content inferred for this page — create per-page demo highlights so user always sees adaptation.
        // Each page gets different combination / positions, clearly marked as synthetic (run extraction for precise bboxes).
        if (synth.length === 0) {
          const variant = pageNum % 4
          const isEven = pageNum % 2 === 0
          if (variant === 0) {
            // Grammar + table page like Image 1
            synth.push({ title: 'Grammatik: kausale Zusammenhänge', blockType: 'heading', prompt: 'Detected grammar heading', bbox: [44, 18, 560, 58], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Tabelle: Gründe ausdrücken', blockType: 'text', prompt: 'Grammar table with gaps (weil / wegen / aufgrund dessen)', bbox: [44, 78, 568, 380], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Exercise b — Gründe markieren', blockType: 'exercise', prompt: 'Lesen Sie noch einmal die Texte in 2a und markieren Sie... (b)', bbox: [44, 400, 568, 480], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Exercise C — Flüssig sprechen', blockType: 'exercise', prompt: 'Flüssig sprechen - Warum? Notieren Sie Fragen (audio 1.18)', bbox: [44, 500, 568, 600], hasAudio: true, hasVideo: false })
            synth.push({ title: 'Image / Tipp box', blockType: 'image', prompt: 'Tipp box + color markers', bbox: [isEven ? 420 : 380, 620, 568, 740], hasAudio: false, hasVideo: false })
          } else if (variant === 1) {
            // Personality test like Image 2
            synth.push({ title: 'WIE FLEXIBEL IST DER MENSCH?', blockType: 'heading', prompt: 'Detected title', bbox: [40, 14, 520, 48], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Exercise 1 — Smartphone Updates', blockType: 'exercise', prompt: '1 a Persönlichkeitstest — Wie reagierst du? (multiple choice)', bbox: [40, 76, 400, 260], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Image: Smartphone', blockType: 'image', prompt: 'Circular phone image top-right', bbox: [420, 70, 580, 260], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Exercise 2 — Friseur pink', blockType: 'exercise', prompt: '2 Deine Freundin war beim Friseur ... Was sagst du?', bbox: [40, 280, 400, 460], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Image: Pink hair', blockType: 'image', prompt: 'Circular portrait left', bbox: [28, 300, 180, 480], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Exercise 3 — Schulzeit', blockType: 'exercise', prompt: '3 Die Schulzeit ist zu Ende. Wie fühlst du dich?', bbox: [40, 500, 400, 640], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Image: Group stairs', blockType: 'image', prompt: 'Circular group bottom-right', bbox: [400, 520, 580, 680], hasAudio: false, hasVideo: false })
          } else if (variant === 2) {
            synth.push({ title: 'Heading', blockType: 'heading', prompt: 'Detected heading', bbox: [40, 18, 520, 56], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Text', blockType: 'text', prompt: 'Running text region', bbox: [40, 78, 568, 260], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Exercise 1', blockType: 'exercise', prompt: 'Detected exercise region', bbox: [40, 280, 568, 400], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Exercise 2', blockType: 'exercise', prompt: 'Detected exercise region', bbox: [40, 420, 568, 540], hasAudio: audioHint, hasVideo: videoHint })
            synth.push({ title: 'Image', blockType: 'image', prompt: 'Figure/table region', bbox: [52, 560, 312, 700], hasAudio: false, hasVideo: false })
          } else {
            synth.push({ title: `Heading p.${pageNum}`, blockType: 'heading', prompt: 'Page header', bbox: [40, 18, 520, 56], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Text', blockType: 'text', prompt: 'Text region', bbox: [40, 78, 568, 200], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Exercise p.' + pageNum, blockType: 'exercise', prompt: 'Run extraction for precise type/position', bbox: [40, 220 + variant * 8, 568, 340 + variant * 8], hasAudio: false, hasVideo: false })
            synth.push({ title: 'Image', blockType: 'image', prompt: 'Figure region', bbox: [320, 360, 560, 560], hasAudio: false, hasVideo: false })
          }
        }

        for (let i = 0; i < synth.length; i++) {
          const s = synth[i]
          acc.push({ id: `synth-${pageNum}-${i}-${s.blockType}`, title: s.title, type: s.blockType, prompt: s.prompt, bbox: s.bbox, hasAudio: s.hasAudio, hasVideo: s.hasVideo, hasSolution: s.blockType === 'exercise', confidence: 0.58, blockType: s.blockType })
        }
      }
    }

    return acc
  }, [effectivePageNum, displayExercise, searchResults, course, pdfMaterials, selectedMaterialId])

  const hoveredExercise = useMemo(() => pageExercises.find(e => e.id === hoveredExerciseId) ?? null, [hoveredExerciseId, pageExercises])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#0C0C0C] text-[#FAF8F5]">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]">
        {/* Row 1: Lesson breadcrumb + statuses + extraction */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center shrink-0">
              <Zap size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[13px] font-semibold tracking-tight text-[#FAF8F5] leading-none">Lesson: {lessonContext.lessonLabel}</h1>
                {lessonContext.chapterLabel && (
                  <span className="text-[11px] text-[#A8A29E] hidden sm:inline">• {lessonContext.chapterLabel}</span>
                )}
              </div>
              <p className="text-[11px] text-[#6B7280] hidden md:block">LangChain / LangGraph Pipeline Debugging Console</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Material selector */}
            {materials.length > 0 && (
              <div className="flex items-center gap-2 bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] rounded-lg px-2.5 py-1.5">
                <span className="text-[11px] text-[#6B7280] hidden sm:inline">Material:</span>
                <select
                  value={selectedMaterialId || ''}
                  onChange={e => setSelectedMaterialId(e.target.value || null)}
                  className="bg-transparent text-xs text-[#FAF8F5] focus:outline-none cursor-pointer min-w-[140px] max-w-[200px] truncate"
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id} className="bg-[#0C0C0C]">{m.title} ({m.words} w)</option>
                  ))}
                </select>
                <button
                  onClick={handleExtraction}
                  disabled={extractionStatus === 'running' || !selectedMaterialId}
                  className={`text-[11px] px-3 py-1 rounded-md font-medium flex items-center gap-1.5 disabled:opacity-50 ${extractionStatus === 'done' ? 'bg-[#10B981] text-white' : extractionStatus === 'error' ? 'bg-[#EF4444] text-white' : 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED]'}`}
                >
                  {extractionStatus === 'running' && <Loader2 size={12} className="animate-spin" />}
                  {extractionStatus === 'running' ? `${extractionProgress}%` : extractionStatus === 'done' ? 'Extracted ✓' : extractionStatus === 'error' ? 'Failed ✗' : 'Run Extraction'}
                </button>
                <button
                  onClick={async () => {
                    if (!course || !selectedMaterialId) return
                    const mat = materials.find(m => m.id === selectedMaterialId)
                    if (!mat) return
                    if (!confirm(`Delete "${mat.title}"? This will remove its PDF from MinIO and database storage. This cannot be undone.`)) return
                    setDeletingMaterial(true)
                    setError(null)
                    try {
                      await deleteCourseMaterialFile(course.id, selectedMaterialId)
                      // select next material if any
                      const remaining = materials.filter(m => m.id !== selectedMaterialId)
                      setSelectedMaterialId(remaining[0]?.id ?? null)
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to delete material')
                    } finally {
                      setDeletingMaterial(false)
                    }
                  }}
                  disabled={deletingMaterial || !selectedMaterialId}
                  title="Delete this material and remove from storage (MinIO + DB)"
                  className="p-1.5 rounded-md border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.12)] disabled:opacity-50"
                >
                  {deletingMaterial ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            )}

            {/* Live pills */}
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${wsConnected ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/25' : apiConnected ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/25' : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-[#10B981]' : apiConnected ? 'bg-[#F59E0B] animate-pulse' : 'bg-[#EF4444]'}`} />
                {wsConnected ? 'Live' : apiConnected ? 'WS Offline' : 'Offline'}
              </span>
              {!wsConnected && (
                <button onClick={() => connectWS(true)} className="p-1.5 rounded-md bg-[rgba(250,248,245,0.04)] hover:bg-[rgba(250,248,245,0.06)] text-[#A8A29E] border border-[rgba(250,248,245,0.06)]" title={wsError || 'Reconnect'}>
                  <RotateCcw size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Quick jump (de-emphasized) + replay + results */}
        <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 pb-3">
          <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
            <span className="hidden sm:inline">Quick jump:</span>
            <select value={quickSearchType} onChange={e => setQuickSearchType(e.target.value as PipelineSearchType)} className="bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] rounded-md px-2 py-1 text-xs text-[#FAF8F5]">
              {SEARCH_TYPES.map(t => <option key={t.value} value={t.value} className="bg-[#0C0C0C]">{t.label}</option>)}
            </select>
            <div className="relative">
              <input
                value={quickQuery}
                onChange={e => setQuickQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuickSearch()}
                placeholder={SEARCH_TYPES.find(t => t.value === quickSearchType)?.placeholder || 'Search...'}
                className="w-40 sm:w-56 bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] rounded-md pl-7 pr-2 py-1 text-xs text-[#FAF8F5] placeholder:text-[#6B7280] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
              />
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            </div>
            <button onClick={handleQuickSearch} disabled={loading || !quickQuery.trim()} className="px-3 py-1 rounded-md bg-[rgba(250,248,245,0.06)] hover:bg-[rgba(250,248,245,0.1)] text-[#FAF8F5] text-xs disabled:opacity-40 flex items-center gap-1">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}Search
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {selectedExercise && (
              <button onClick={handleReplay} disabled={replaying} className={`text-xs px-3 py-1.5 rounded-md border flex items-center gap-1.5 ${replaying ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/30 text-[#8B5CF6]' : 'bg-[rgba(250,248,245,0.04)] border-[rgba(250,248,245,0.06)] text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.06)]'}`}>
                <RotateCcw size={12} className={replaying ? 'animate-spin' : ''} />{replaying ? (replayStage || 'Replaying...') : 'Replay Pipeline'}
              </button>
            )}
            {searchResults.length > 1 && (
              <select
                value={selectedExercise?.exerciseId || ''}
                onChange={e => {
                  const ex = searchResults.find(r => r.exerciseId === e.target.value)
                  if (ex) setSelectedExercise(ex)
                }}
                className="bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] rounded-md px-2 py-1 text-xs text-[#FAF8F5] max-w-[220px] truncate"
              >
                {searchResults.map(r => <option key={r.exerciseId} value={r.exerciseId} className="bg-[#0C0C0C]">{r.title} — p.{r.page}</option>)}
              </select>
            )}
            {extractionStatus === 'running' && (
              <div className="w-24 h-1.5 bg-[rgba(250,248,245,0.06)] rounded-full overflow-hidden hidden sm:block">
                <motion.div animate={{ width: `${extractionProgress}%` }} className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]" />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-4 md:mx-6 mb-3 p-2.5 rounded-lg bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] flex items-start gap-2">
            <AlertTriangle size={14} className="text-[#EF4444] mt-0.5 shrink-0" />
            <div className="text-xs text-[#A8A29E] break-words whitespace-pre-wrap flex-1">{error}</div>
            <button onClick={() => setError(null)} className="p-1 rounded hover:bg-[rgba(239,68,68,0.15)] text-[#EF4444]/70"><XCircle size={12} /></button>
          </div>
        )}
      </div>

      {/* ── Split body ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* PANEL 1 — Learning Material */}
        {!leftCollapsed ? (
          <div
            ref={leftPanelRef}
            style={{ width: `${leftWidthPct}%` }}
            className="shrink-0 flex flex-col border-r border-[rgba(250,248,245,0.06)] bg-[#0F0F0F] overflow-hidden"
          >
            <div className="shrink-0 px-4 py-2.5 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between bg-[rgba(250,248,245,0.02)]">
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-[#F59E0B]" />
                <span className="text-xs font-semibold tracking-wide text-[#FAF8F5] uppercase">Learning Material</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-[rgba(250,248,245,0.06)] text-[#A8A29E] font-mono">{leftExerciseMeta ? `p.${leftExerciseMeta.page}` : '—'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">{(() => { const v = (!leftCollapsed?1:0)+(!rightCollapsed?1:0)+(!exerciseCollapsed?1:0); return `1 / ${v}` })()}</span>
                <button onClick={() => setLeftCollapsed(true)} className="p-1.5 rounded-md bg-[rgba(250,248,245,0.04)] hover:bg-[rgba(250,248,245,0.08)] text-[#A8A29E] hover:text-[#FAF8F5] border border-[rgba(250,248,245,0.06)] shrink-0" title="Hide Learning Material"><EyeOff size={14} /></button>
                <button onClick={() => setLeftCollapsed(true)} className="p-1 rounded hover:bg-[rgba(250,248,245,0.06)] text-[#6B7280] hover:text-[#FAF8F5] shrink-0 hidden sm:flex" title="Hide panel"><ChevronLeft size={14} /></button>
              </div>
            </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-3">
              <div className="text-[11px] text-[#6B7280] mb-2 flex items-center gap-1.5"><Eye size={11} className="text-[#F59E0B]" />Hover PDF → highlights pipeline + exercise</div>
            </div>
            <LeftSection
              title="PDF Viewer"
              subtitle={`Page ${leftExerciseMeta?.page ?? 1} • ${pageExercises.length} exercise${pageExercises.length!==1?'s':''} • hover to inspect`}
              icon={FileText}
              accent="text-[#F59E0B]"
              open={leftSectionOpen.pdf}
              onToggle={() => setLeftSectionOpen(s => ({ ...s, pdf: !s.pdf }))}
            >
              <PdfViewerCard
                exercise={displayExercise}
                courseExercise={selectedCourseExercise?.exercise ?? null}
                material={pdfMaterials.find(m => m.id === selectedMaterialId) || pdfMaterials[0] || null}
                leftMeta={leftExerciseMeta}
                pageExercises={pageExercises}
                hoveredExerciseId={hoveredExerciseId}
                onHoverExercise={setHoveredExerciseId}
                onSelectExercise={(id) => handleCourseExerciseSelect(id)}
                onPageChange={(next) => { setPdfPageOverride(Math.max(1, next)); setHoveredExerciseId(null) }}
                totalPages={pdfMaterials.find(m => m.id === selectedMaterialId)?.pages ?? pdfMaterials[0]?.pages}
              />
            </LeftSection>
          </div>
          </div>
        ) : (
          <div className="w-8 shrink-0 flex flex-col items-center py-3 gap-2 border-r border-[rgba(250,248,245,0.06)] bg-[#0F0F0F]">
            <button onClick={() => setLeftCollapsed(false)} className="p-2 rounded-lg bg-[#F59E0B] text-white hover:bg-[#EA580C] shadow shrink-0" title="Show Learning Material"><Eye size={14} /></button>
            <button onClick={() => setLeftCollapsed(false)} className="p-1 rounded hover:bg-[rgba(250,248,245,0.06)] text-[#6B7280] hover:text-[#FAF8F5]" title="Unhide"><ChevronRight size={14} /></button>
            <span className="mt-2 text-[10px] tracking-[0.14em] uppercase text-[#6B7280] [writing-mode:vertical-lr] rotate-180 select-none">Material</span>
            <span className="text-[9px] text-[#52525B] [writing-mode:vertical-lr] rotate-180 select-none">1st hidden</span>
          </div>
        )}

        {!leftCollapsed && !rightCollapsed && (
          <div
            onMouseDown={() => setResizingPanel('left')}
            className={`w-1.5 shrink-0 cursor-col-resize hover:bg-[#8B5CF6]/30 transition-colors ${resizingPanel === 'left' ? 'bg-[#8B5CF6]/50' : 'bg-[rgba(250,248,245,0.04)]'}`}
            title="Drag to resize"
          />
        )}

        {/* PANEL 2 — Pipeline Inspector (swapped to center) */}
        {!rightCollapsed ? (
          <div
            style={{ width: `${centerWidthPct}%` }}
            className="shrink-0 flex flex-col border-r border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] overflow-hidden">
            {/* Tabs */}
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]">
              <div className="relative">
                <select
                  value={activeTab}
                  onChange={e => setTab(e.target.value as RightTab)}
                  className="appearance-none bg-[#0C0C0C] border border-[rgba(250,248,245,0.08)] rounded-lg pl-8 pr-7 py-1.5 text-xs font-medium text-[#FAF8F5] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] cursor-pointer hover:bg-[rgba(250,248,245,0.04)] transition-colors min-w-[160px]"
                >
                  {RIGHT_TABS.map(tab => (
                    <option key={tab.id} value={tab.id} className="bg-[#0C0C0C]">{tab.label}</option>
                  ))}
                </select>
                <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  {(() => { const ActiveIcon = RIGHT_TABS.find(x => x.id === activeTab)?.icon ?? GitBranch; return <ActiveIcon size={14} className="text-[#8B5CF6]" /> })()}
                </div>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#6B7280]" />
              </div>
              <div className="ml-auto hidden md:flex items-center gap-2 text-[11px] text-[#6B7280]">
                {displayExercise ? (
                  <>
                    <span className="inline-flex items-center gap-1"><FileJson size={10} />{displayExercise.exerciseId.slice(0,8)}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={10} />{displayExercise.langGraphExecution?.totalDurationMs ?? '—'} ms</span>
                  </>
                ) : (
                  <span>Select an exercise to inspect pipeline</span>
                )}
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 hidden sm:inline">{(() => { const v = (!leftCollapsed?1:0)+(!rightCollapsed?1:0)+(!exerciseCollapsed?1:0); const pos = (!leftCollapsed?1:0)+1; return `${pos} / ${v}` })()}</span>
              <button
                onClick={() => setRightCollapsed(true)}
                className="ml-2 p-1.5 rounded-md bg-[rgba(250,248,245,0.04)] hover:bg-[rgba(250,248,245,0.08)] text-[#A8A29E] hover:text-[#FAF8F5] border border-[rgba(250,248,245,0.06)] shrink-0"
                title="Hide Pipeline"
              >
                <EyeOff size={14} />
              </button>
              <button
                onClick={() => setRightCollapsed(true)}
                className="p-1 rounded hover:bg-[rgba(250,248,245,0.06)] text-[#6B7280] hover:text-[#FAF8F5] shrink-0 hidden sm:flex"
                title="Hide Inspector"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-5">
              {activeTab === 'pipeline' && (
                <PipelineTab
                  exercise={displayExercise}
                  selectedNodeId={selectedNodeId}
                  setSelectedNodeId={setSelectedNodeId}
                />
              )}
              {activeTab === 'relationships' && (
                <RelationshipsTab
                  exercise={displayExercise}
                  course={course}
                  selectedLessonId={selectedLessonId}
                  selectedModuleId={selectedModuleId}
                  view={relationshipView}
                  setView={setRelationshipView}
                />
              )}
              {activeTab === 'knowledge-graph' && (
                <KnowledgeGraphTab exercise={displayExercise} course={course} />
              )}
              {activeTab === 'studio' && (
                <LangGraphStudioTab exercise={displayExercise} />
              )}
            </div>
          </div>
        ) : (
          <div className="w-8 shrink-0 flex flex-col items-center py-3 gap-2 border-r border-[rgba(250,248,245,0.06)] bg-[#0F0F0F]">
            <button
              onClick={() => setRightCollapsed(false)}
              className="p-2 rounded-lg bg-[#8B5CF6] text-white hover:bg-[#7C3AED] shadow shrink-0"
              title="Show 2nd panel (Pipeline Inspector)"
            >
              <Eye size={14} />
            </button>
            <button
              onClick={() => setRightCollapsed(false)}
              className="p-1 rounded hover:bg-[rgba(250,248,245,0.06)] text-[#6B7280] hover:text-[#FAF8F5]"
              title="Unhide Inspector"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="mt-2 text-[10px] tracking-[0.14em] uppercase text-[#6B7280] [writing-mode:vertical-lr] rotate-180 select-none">Inspector</span>
            <span className="text-[9px] text-[#52525B] [writing-mode:vertical-lr] rotate-180 select-none">2nd hidden</span>
          </div>
        )}
        {!rightCollapsed && !exerciseCollapsed && (
          <div
            onMouseDown={() => setResizingPanel('center')}
            className={`w-1.5 shrink-0 cursor-col-resize hover:bg-[#8B5CF6]/30 transition-colors ${resizingPanel === 'center' ? 'bg-[#8B5CF6]/50' : 'bg-[rgba(250,248,245,0.04)]'}`}
            title="Drag to resize"
          />
        )}

        {/* PANEL 3 — Exercise Inspector (swapped to rightmost) */}
        {!exerciseCollapsed ? (
          <div
            className="flex-1 flex flex-col min-w-0 bg-[#0F0F0F] overflow-hidden"
          >
            <div className="shrink-0 px-4 py-2.5 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between bg-[rgba(250,248,245,0.02)]">
              <div className="flex items-center gap-2">
                <FileQuestion size={14} className="text-[#8B5CF6]" />
                <span className="text-xs font-semibold tracking-wide text-[#FAF8F5] uppercase">Exercise Inspector</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20">{pageExercises.length} on p.{leftExerciseMeta?.page ?? '—'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20">{(() => { const v = (!leftCollapsed?1:0)+(!rightCollapsed?1:0)+(!exerciseCollapsed?1:0); return `${v} / ${v}` })()}</span>
                <button onClick={() => setExerciseCollapsed(true)} className="p-1.5 rounded-md bg-[rgba(250,248,245,0.04)] hover:bg-[rgba(250,248,245,0.08)] text-[#A8A29E] hover:text-[#FAF8F5] border border-[rgba(250,248,245,0.06)] shrink-0" title="Hide Exercise Inspector"><EyeOff size={14} /></button>
                <button onClick={() => setExerciseCollapsed(true)} className="p-1 rounded hover:bg-[rgba(250,248,245,0.06)] text-[#6B7280] hover:text-[#FAF8F5] shrink-0 hidden sm:flex" title="Hide panel"><ChevronRight size={14} /></button>
                <button onClick={() => setNavCollapsed(!navCollapsed)} className="p-1 rounded hover:bg-[rgba(250,248,245,0.06)] text-[#6B7280]">
                  {navCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>
          <div className="flex-1 overflow-y-auto">
            {/* Lesson → Chapter → Exercise navigator */}
            <div className="p-3 border-b border-[rgba(250,248,245,0.04)]">
              {!course || course.modules.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[rgba(250,248,245,0.08)] bg-[rgba(250,248,245,0.02)] p-4 text-center">
                  <BookOpen size={20} className="mx-auto text-[#6B7280] mb-2" />
                  <p className="text-xs font-medium text-[#FAF8F5]">No course loaded</p>
                  <p className="text-[11px] text-[#6B7280] mt-1">Upload a PDF to populate Lesson → Chapter → Exercise navigation.</p>
                  <a href="/upload" className="inline-flex items-center gap-1 mt-3 text-xs px-3 py-1.5 rounded-md bg-[#10B981] text-white hover:bg-[#059669]"><Upload size={12} />Upload material</a>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ListTree size={12} className="text-[#8B5CF6]" />
                    <span className="text-[11px] font-semibold tracking-wide uppercase text-[#A8A29E]">Kursbuch</span>
                    <span className="text-[11px] text-[#6B7280]">· {course.modules.length} Lektionen · {course.stats.exercises} exercises</span>
                  </div>
                  {!navCollapsed && course.modules.map(mod => {
                    const isModActive = selectedModuleId === mod.id
                    const lessons = mod.lessons
                    return (
                      <div key={mod.id} className={`rounded-lg border ${isModActive ? 'border-[#8B5CF6]/20 bg-[#8B5CF6]/5' : 'border-transparent hover:bg-[rgba(250,248,245,0.02)]'}`}>
                        <button
                          onClick={() => { setSelectedModuleId(mod.id); if (lessons[0]) { setSelectedLessonId(lessons[0].id); if (lessons[0].exercises[0]) handleCourseExerciseSelect(lessons[0].exercises[0].id) } }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
                        >
                          <ChevronRight size={12} className={`text-[#6B7280] transition-transform ${isModActive ? 'rotate-90' : ''}`} />
                          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#10B981]/20 to-[#059669]/20 border border-[#10B981]/20 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-[#10B981]">{mod.title.slice(0,2)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-[#FAF8F5] truncate">{mod.title}</div>
                            <div className="text-[11px] text-[#6B7280] truncate">{mod.description?.slice(0, 60) || `${lessons.length} chapters`}</div>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(250,248,245,0.06)] text-[#A8A29E]">{lessons.length}</span>
                        </button>
                        <AnimatePresence>
                          {isModActive && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <div className="pl-6 pr-2 pb-2 space-y-0.5">
                                {lessons.map(les => {
                                  const isLesActive = selectedLessonId === les.id
                                  return (
                                    <div key={les.id} className={`rounded-md ${isLesActive ? 'bg-[rgba(250,248,245,0.04)] border border-[rgba(250,248,245,0.06)]' : ''}`}>
                                      <button
                                        onClick={() => { setSelectedLessonId(les.id); if (les.exercises[0]) handleCourseExerciseSelect(les.exercises[0].id) }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
                                      >
                                        <ChevronRight size={10} className={`text-[#6B7280] ${isLesActive ? 'rotate-90' : ''}`} />
                                        <span className="text-xs text-[#FAF8F5] truncate flex-1">{les.title}</span>
                                        <span className="text-[10px] text-[#6B7280]">{les.exercises.length}</span>
                                      </button>
                                      {isLesActive && les.exercises.length > 0 && (
                                        <div className="pl-5 pr-1 pb-1.5 space-y-0.5">
                                          {les.exercises.slice(0, 12).map(ex => {
                                            const active = (selectedCourseExerciseId === ex.id) || (displayExercise?.exerciseId === ex.id)
                                            const isHovered = hoveredExerciseId === ex.id
                                            const exMeta = pageExercises.find(p => p.id === ex.id)
                                            return (
                                              <button
                                                key={ex.id}
                                                onClick={() => handleCourseExerciseSelect(ex.id)}
                                                onMouseEnter={() => setHoveredExerciseId(ex.id)}
                                                onMouseLeave={() => setHoveredExerciseId(null)}
                                                className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-left border transition-colors ${active ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/30 text-[#FAF8F5]' : isHovered ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#FAF8F5] ring-1 ring-[#F59E0B]/30' : 'border-transparent hover:bg-[rgba(250,248,245,0.04)] text-[#A8A29E] hover:text-[#FAF8F5]'}`}
                                              >
                                                <FileQuestion size={10} className={active ? 'text-[#8B5CF6]' : isHovered ? 'text-[#F59E0B]' : 'text-[#6B7280]'} />
                                                <span className="text-[11px] truncate flex-1">{formatExerciseTitle({ type: ex.type, name: ex.name, page: ex.page }) || ex.id.slice(0,8)}</span>
                                                <span className="flex items-center gap-1">
                                                  {exMeta?.hasAudio && <Volume2 size={10} className={`${isHovered ? 'text-[#3B82F6]' : 'text-[#3B82F6]/60'}`} />}
                                                  {exMeta?.hasVideo && <Video size={10} className={`${isHovered ? 'text-[#EC4899]' : 'text-[#EC4899]/60'}`} />}
                                                  {exMeta?.hasSolution && <BookMarked size={10} className={`${isHovered ? 'text-[#F59E0B]' : 'text-[#6B7280]'}`} />}
                                                </span>
                                                {ex.page && <span className="text-[10px] font-mono text-[#6B7280]">p.{String(ex.page).slice(0,6)}</span>}
                                              </button>
                                            )
                                          })}
                                          {les.exercises.length > 12 && (
                                            <div className="text-[11px] text-[#6B7280] px-2">+ {les.exercises.length - 12} more</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* AUDIO SECTION */}
            <LeftSection
              title="Audio"
              subtitle={hoveredExercise ? `Track for ${hoveredExercise.title.slice(0,22)}` : displayExercise?.assets.audio.length ? `${displayExercise.assets.audio.length} track(s) linked` : selectedCourseExercise?.exercise.requiredAudio?.length ? `${selectedCourseExercise.exercise.requiredAudio.length} track(s)` : 'No audio linked'}
              icon={Volume2}
              accent="text-[#3B82F6]"
              open={leftSectionOpen.audio}
              onToggle={() => setLeftSectionOpen(s => ({ ...s, audio: !s.audio }))}
            >
              <AudioSection
                exercise={displayExercise}
                courseRequiredAudio={selectedCourseExercise?.exercise.requiredAudio}
                playing={audioPlaying}
                setPlaying={setAudioPlaying}
                audioRef={audioRef}
                hoveredExerciseId={hoveredExerciseId}
              />
            </LeftSection>

            {/* VIDEO SECTION */}
            <LeftSection
              title="Video"
              subtitle={hoveredExercise?.hasVideo ? `Video for ${hoveredExercise.title.slice(0,22)}` : displayExercise?.assets.video.length ? `${displayExercise.assets.video.length} video(s)` : selectedCourseExercise?.exercise.requiredVideo?.length ? `${selectedCourseExercise.exercise.requiredVideo.length} video(s)` : 'No video linked'}
              icon={Video}
              accent="text-[#EC4899]"
              open={leftSectionOpen.video}
              onToggle={() => setLeftSectionOpen(s => ({ ...s, video: !s.video }))}
            >
              <VideoSection
                exercise={displayExercise}
                courseRequiredVideo={selectedCourseExercise?.exercise.requiredVideo}
                playing={videoPlaying}
                setPlaying={setVideoPlaying}
                hoveredExerciseId={hoveredExerciseId}
              />
            </LeftSection>

            {/* TRANSCRIPT / SOLUTIONS */}
            <LeftSection
              title="Transcript & Solutions"
              subtitle={hoveredExercise ? `Refs for ${hoveredExercise.title.slice(0,24)} • audio:${hoveredExercise.hasAudio?'✓':'—'} video:${hoveredExercise.hasVideo?'✓':'—'} solution:${hoveredExercise.hasSolution?'✓':'—'}` : "Linked references • hover an exercise to filter"}
              icon={ScrollText}
              accent="text-[#10B981]"
              open={leftSectionOpen.solutions}
              onToggle={() => setLeftSectionOpen(s => ({ ...s, solutions: !s.solutions }))}
            >
              <TranscriptSolutionsCard exercise={displayExercise} courseEx={selectedCourseExercise?.exercise ?? null} hoveredExerciseId={hoveredExerciseId} hoveredExercise={hoveredExercise} />
            </LeftSection>

            {/* Exercise detail quick card (prompt) — hover shows match audit */}
            {leftExerciseMeta && (
              <div className={`m-3 p-3 rounded-xl border transition-colors ${hoveredExerciseId && hoveredExercise ? (hoveredExercise.hasAudio || hoveredExercise.hasVideo || hoveredExercise.hasSolution ? 'border-[#F59E0B]/30 bg-[#F59E0B]/5' : 'border-[#EF4444]/30 bg-[#EF4444]/5') : 'border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]'}`}>
                {hoveredExerciseId && hoveredExercise && hoveredExerciseId !== (displayExercise?.exerciseId || selectedCourseExercise?.exercise.id) && (
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)]">
                    <Eye size={11} className="text-[#F59E0B]" />
                    <span className="text-[#FAF8F5]">Hovering</span>
                    <span className="font-medium text-[#F59E0B] truncate">{hoveredExercise.title}</span>
                    <span className="ml-auto flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${hoveredExercise.hasAudio ? 'bg-[#3B82F6]' : 'bg-[#6B7280]/30'}`} title="audio" />
                      <span className={`w-2 h-2 rounded-full ${hoveredExercise.hasVideo ? 'bg-[#EC4899]' : 'bg-[#6B7280]/30'}`} title="video" />
                      <span className={`w-2 h-2 rounded-full ${hoveredExercise.hasSolution ? 'bg-[#10B981]' : 'bg-[#EF4444]/50'}`} title="solution" />
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
                    leftExerciseMeta.type.includes('blank') ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/20' :
                    leftExerciseMeta.type.includes('choice') ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/20' :
                    'bg-[rgba(250,248,245,0.06)] text-[#A8A29E] border-[rgba(250,248,245,0.06)]'
                  }`}>{leftExerciseMeta.type}</span>
                  <span className="text-[11px] text-[#6B7280]">Page {leftExerciseMeta.page}</span>
                  {displayExercise && (
                    <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20">confidence {((displayExercise.classification?.confidence ?? 0.93)*100).toFixed(0)}%</span>
                  )}
                </div>
                <p className="text-sm text-[#FAF8F5] leading-relaxed whitespace-pre-wrap">{leftExerciseMeta.prompt}</p>
                {leftExerciseMeta.answer && (
                  <div className="mt-3 p-2.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20">
                    <div className="text-[11px] font-medium text-[#10B981] mb-1">Expected answer</div>
                    <pre className="text-xs text-[#10B981] whitespace-pre-wrap font-mono">{leftExerciseMeta.answer}</pre>
                  </div>
                )}
                {displayExercise?.blanks && displayExercise.blanks.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="text-[11px] font-medium text-[#A8A29E]">Blanks</div>
                    {displayExercise.blanks.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)]">
                        <span className="text-[#6B7280] font-mono">#{i+1}</span>
                        <span className="text-[#FAF8F5] flex-1 truncate">{b.text || '(blank)'}</span>
                        {b.expected && <span className="text-[#10B981] font-mono">{b.expected.join(', ')}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        ) : (
          <div className="w-8 shrink-0 flex flex-col items-center py-3 gap-2 border-l border-[rgba(250,248,245,0.06)] bg-[#0F0F0F]">
            <button onClick={() => setExerciseCollapsed(false)} className="p-2 rounded-lg bg-[#8B5CF6] text-white hover:bg-[#7C3AED] shadow shrink-0" title="Show Exercise Inspector"><Eye size={14} /></button>
            <button onClick={() => setExerciseCollapsed(false)} className="p-1 rounded hover:bg-[rgba(250,248,245,0.06)] text-[#6B7280] hover:text-[#FAF8F5]" title="Unhide"><ChevronLeft size={14} /></button>
            <span className="mt-2 text-[10px] tracking-[0.14em] uppercase text-[#6B7280] [writing-mode:vertical-lr] rotate-180 select-none">Exercise</span>
            <span className="text-[9px] text-[#52525B] [writing-mode:vertical-lr] rotate-180 select-none">3rd hidden</span>
          </div>
        )}

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Left helpers
// ─────────────────────────────────────────────────────────────────────────────
function LeftSection({ title, subtitle, icon: Icon, accent, open, onToggle, children }: { title: string; subtitle?: string; icon: LucideIcon; accent?: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-[rgba(250,248,245,0.04)]">
      <button onClick={onToggle} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[rgba(250,248,245,0.02)] transition-colors">
        <Icon size={14} className={accent || 'text-[#A8A29E]'} />
        <div className="text-left min-w-0 flex-1">
          <div className="text-xs font-semibold text-[#FAF8F5] leading-none">{title}</div>
          {subtitle && <div className="text-[11px] text-[#6B7280] truncate">{subtitle}</div>}
        </div>
        <ChevronDown size={14} className={`text-[#6B7280] transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PdfViewerCard({ exercise, courseExercise, material, leftMeta, pageExercises, hoveredExerciseId, onHoverExercise, onSelectExercise, onPageChange, totalPages }: { exercise: ExercisePipelineViewDto | null; courseExercise: Exercise | null; material: Material | null; leftMeta: LeftExerciseMeta | null; pageExercises: Array<{ id: string; title: string; type: string; prompt: string; bbox?: number[]; hasAudio: boolean; hasVideo: boolean; hasSolution: boolean; confidence?: number; blockType?: string }>; hoveredExerciseId: string | null; onHoverExercise: (id: string | null) => void; onSelectExercise: (id: string) => void; onPageChange?: (next: number) => void; totalPages?: number }) {
  const page = leftMeta?.page ?? exercise?.page ?? 1
  const blocks = exercise?.ocrData?.blocks ?? []
  const images = exercise?.assets?.images ?? []
  const rawBlocks = exercise?.rawExtractedData.blocks
  const fallbackBlocks: OcrBlockLike[] = blocks.length === 0 && Array.isArray(rawBlocks) ? rawBlocks : []
  const displayBlocks: OcrBlockLike[] = blocks.length > 0 ? blocks : fallbackBlocks
  const pdfUrl = material?.objectKey ? `/api/materials/content?key=${encodeURIComponent(material.objectKey)}` : null
  const hoveredEx = pageExercises.find(e => e.id === hoveredExerciseId) ?? null
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 600, h: 800 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Map OCR bbox to % with PDF renderer margin compensation
  // Supports both absolute PDF points (0..612 x 0..792) and normalized (0..1) coords
  const bboxToStyle = (bbox?: number[]) => {
    if (!bbox || bbox.length < 4) return { left: '8%', top: '10%', width: '84%', height: '14%' }
    let [x0, y0, x1, y1] = bbox
    // Detect normalized bbox (all values 0..1.5) vs absolute points
    const isNormalized = bbox.every(v => v >= 0 && v <= 1.5)
    if (isNormalized) {
      // Already 0..1, map directly to 4..92% content area
      const left = Math.max(4, Math.min(92, 4 + x0 * 88))
      const top = Math.max(4, Math.min(92, 4 + y0 * 88))
      const width = Math.max(8, Math.min(92 - left, (x1 - x0) * 88))
      const height = Math.max(6, Math.min(92 - top, (y1 - y0) * 88))
      return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }
    }
    const W = 612, H = 792 // standard US Letter PDF points
    // Expand bbox slightly for easier hover hit-area (+4pt each side)
    x0 = Math.max(0, x0 - 4); y0 = Math.max(0, y0 - 4); x1 = Math.min(W, x1 + 4); y1 = Math.min(H, y1 + 4)
    const left = Math.max(4, Math.min(92, 4 + (x0 / W) * 88))
    const top = Math.max(4, Math.min(92, 4 + (y0 / H) * 88))
    const width = Math.max(8, Math.min(92 - left, ((x1 - x0) / W) * 88))
    const height = Math.max(6, Math.min(92 - top, ((y1 - y0) / H) * 88))
    return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }
  }

  return (
    <div className="space-y-3">
      {/* Rendered PDF page with hover highlights */}
      <div className="rounded-xl border border-[rgba(250,248,245,0.06)] overflow-hidden bg-[#0C0C0C]">
        <div className="flex items-center justify-between px-3 py-2 bg-[rgba(250,248,245,0.03)] border-b border-[rgba(250,248,245,0.06)]">
          <span className="text-[11px] font-medium text-[#A8A29E] flex items-center gap-1.5"><FileText size={12} />Page {page}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[rgba(250,248,245,0.06)] text-[#6B7280] font-mono truncate max-w-[140px]">{material?.title || 'Kursbuch.pdf'}</span>
        </div>
        {pdfUrl ? (
          <div ref={containerRef} className="relative bg-[#1a1a1a] h-[420px] w-full overflow-hidden flex flex-col">
            {/* PDF toolbar — page nav + overflow handling */}
            <div className="h-7 shrink-0 bg-[#27272A] flex items-center justify-between px-2 text-[11px] text-[#A8A29E]">
              <div className="flex items-center gap-1.5">
                {onPageChange && (
                  <>
                    <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="p-1 rounded hover:bg-[rgba(250,248,245,0.08)] disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={12} /></button>
                    <span className="flex items-center gap-1"><FileText size={11} />{material?.title} · p.{page}{totalPages ? ` / ${totalPages}` : ''}</span>
                    <button onClick={() => onPageChange(page + 1)} disabled={totalPages != null && page >= totalPages} className="p-1 rounded hover:bg-[rgba(250,248,245,0.08)] disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={12} /></button>
                  </>
                )}
                {!onPageChange && <span className="flex items-center gap-1.5"><FileText size={11} />{material?.title} · p.{page}</span>}
              </div>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#3B82F6] text-white hover:bg-[#2563EB]">
                <ExternalLink size={10} />Open
              </a>
            </div>
            <div className="relative flex-1 bg-[#52525B] overflow-hidden" onMouseLeave={() => onHoverExercise(null)}>
              <object key={`pdf-page-${page}-${material?.objectKey}-${Math.round(containerSize.w)}`} data={`${pdfUrl}#page=${page}&zoom=page-width&toolbar=0&navpanes=0`} type="application/pdf" className="w-full h-full border-0 block bg-white" style={{ pointerEvents: "none" }}>
                <div className="w-full h-full flex items-center justify-center bg-white p-6 text-center">
                  <div>
                    <p className="text-sm text-[#1a1a1a]">PDF preview unavailable in this browser.</p>
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-[#3B82F6] text-white">Open PDF in new tab</a>
                  </div>
                </div>
              </object>
              {/* Hover overlay — highlights always visible, hover shows name */}
              <div className="absolute inset-0 pointer-events-none" style={{ left: '3%', right: '3%', top: '2%', bottom: '2%' }} onMouseLeave={() => onHoverExercise(null)}>
                {pageExercises.map(ex => {
                  const isHovered = hoveredExerciseId === ex.id
                  const s = bboxToStyle(ex.bbox)
                  // Always-visible highlight per type, hover lifts opacity and shows name
                  const colors = ex.blockType === 'image' ? { hover: 'bg-[#EC4899]/30 border-[#EC4899] shadow-[0_0_0_2px_rgba(236,72,153,0.22)]', idle: 'bg-[#EC4899]/14 border-[#EC4899]/55', text: 'text-[#EC4899]' }
                    : ex.blockType === 'exercise' ? { hover: 'bg-[#F59E0B]/30 border-[#F59E0B] shadow-[0_0_0_2px_rgba(245,158,11,0.22)]', idle: 'bg-[#F59E0B]/14 border-[#F59E0B]/55', text: 'text-[#F59E0B]' }
                    : ex.blockType === 'heading' ? { hover: 'bg-[#10B981]/30 border-[#10B981] shadow-[0_0_0_2px_rgba(16,185,129,0.20)]', idle: 'bg-[#10B981]/13 border-[#10B981]/50', text: 'text-[#10B981]' }
                    : ex.blockType === 'audio_ref' ? { hover: 'bg-[#3B82F6]/30 border-[#3B82F6] shadow-[0_0_0_2px_rgba(59,130,246,0.20)]', idle: 'bg-[#3B82F6]/13 border-[#3B82F6]/50', text: 'text-[#3B82F6]' }
                    : ex.blockType === 'video_ref' ? { hover: 'bg-[#A855F7]/30 border-[#A855F7] shadow-[0_0_0_2px_rgba(168,85,247,0.20)]', idle: 'bg-[#A855F7]/13 border-[#A855F7]/50', text: 'text-[#A855F7]' }
                    : { hover: 'bg-[#8B5CF6]/30 border-[#8B5CF6] shadow-[0_0_0_2px_rgba(139,92,246,0.18)]', idle: 'bg-[#8B5CF6]/12 border-[#8B5CF6]/45', text: 'text-[#8B5CF6]' }
                  return (
                    <div
                      key={ex.id}
                      className={`absolute rounded-[6px] border-2 transition-all duration-150 pointer-events-auto cursor-pointer ${isHovered ? colors.hover + ' z-10' : colors.idle}`}
                      style={{ left: s.left, top: s.top, width: s.width, height: s.height }}
                      onMouseEnter={() => onHoverExercise(ex.id)}
                      onMouseLeave={() => onHoverExercise(null)}
                      onClick={() => onSelectExercise(ex.id)}
                    >
                      {isHovered && (
                        <div className="absolute -top-7 left-0 flex items-center gap-1.5 px-2 py-1 rounded bg-[#0C0C0C]/95 border border-[rgba(250,248,245,0.15)] shadow-lg whitespace-nowrap z-20 pointer-events-none">
                          <span className={`text-[10px] font-semibold ${colors.text}`}>{ex.title}</span>
                          <span className="text-[9px] text-[#6B7280]">· {ex.blockType || ex.type}</span>
                          {ex.confidence != null && <span className="text-[9px] text-[#52525B]">{Math.round(ex.confidence * 100)}%</span>}
                          {ex.hasAudio && <Volume2 size={9} className="text-[#3B82F6]" />}
                          {ex.hasVideo && <Video size={9} className="text-[#EC4899]" />}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded bg-black/70 text-white pointer-events-none">p.{page} · {pageExercises.length} detected elements</div>
            </div>
          </div>
        ) : (
          <div className="relative bg-[#FDFBF7] p-3">
            {/* Simulated PDF page with exercise highlights (no iframe) */}
            <div className="relative w-full aspect-[3/4.2] bg-white rounded-lg border border-[rgba(0,0,0,0.08)] shadow-sm overflow-hidden">
              <div className="absolute inset-0 p-4 flex flex-col gap-2">
                <div className="h-2.5 w-24 rounded bg-[#1a1a1a]/10" />
                <div className="h-1 w-40 rounded bg-[#1a1a1a]/5" />
                <div className="mt-2 space-y-2">
                  {pageExercises.map(ex => {
                    const isHovered = hoveredExerciseId === ex.id
                    const isSelected = (exercise?.exerciseId === ex.id) || (courseExercise?.id === ex.id)
                    return (
                      <div
                        key={ex.id}
                        onMouseEnter={() => onHoverExercise(ex.id)}
                        onMouseLeave={() => onHoverExercise(null)}
                        onClick={() => onSelectExercise(ex.id)}
                        className={`relative rounded-lg border-2 p-2.5 cursor-pointer transition-all ${isHovered ? 'bg-[#FFF7ED] border-[#F59E0B] shadow-md scale-[1.01] z-10' : isSelected ? 'bg-[#F5F3FF] border-[#8B5CF6]/40' : 'bg-[#FAFAF9] border-[#E7E5E4] hover:border-[#F59E0B]/50 hover:bg-white'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${isHovered ? 'bg-[#F59E0B] text-white border-[#F59E0B]' : 'bg-[#1a1a1a] text-white border-transparent'}`}>{ex.title.split('—')[0].trim().slice(0,10) || 'Aufgabe'}</span>
                          <span className="text-[10px] px-1 py-0.5 rounded bg-[#E7E5E4] text-[#57534E] font-mono">{ex.type}</span>
                          {ex.confidence != null && <span className="text-[10px] text-[#10B981] font-mono">{Math.round(ex.confidence*100)}%</span>}
                          <span className="ml-auto flex items-center gap-1">
                            {ex.hasAudio && <span className={`w-5 h-5 rounded-full flex items-center justify-center ${isHovered ? 'bg-[#3B82F6] text-white' : 'bg-[#EFF6FF] text-[#3B82F6] border border-[#BFDBFE]'}`}><Volume2 size={10} /></span>}
                            {ex.hasVideo && <span className={`w-5 h-5 rounded-full flex items-center justify-center ${isHovered ? 'bg-[#EC4899] text-white' : 'bg-[#FDF2F8] text-[#EC4899] border border-[#FCE7F3]'}`}><Video size={10} /></span>}
                            {ex.hasSolution && <span className={`w-5 h-5 rounded-full flex items-center justify-center ${isHovered ? 'bg-[#F59E0B] text-white' : 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'}`}><BookMarked size={10} /></span>}
                          </span>
                        </div>
                        <div className="text-[11px] leading-4 text-[#1C1917] line-clamp-2">{ex.prompt}</div>
                        {isHovered && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                            {ex.hasAudio && <span className="px-1.5 py-0.5 rounded bg-[#3B82F6] text-white flex items-center gap-1"><Volume2 size={10} />Track 12</span>}
                            {ex.hasVideo && <span className="px-1.5 py-0.5 rounded bg-[#EC4899] text-white flex items-center gap-1"><Video size={10} />Video 3</span>}
                            {ex.hasSolution && <span className="px-1.5 py-0.5 rounded bg-[#F59E0B] text-white">Lösung p.210</span>}
                            <span className="text-[#57534E] ml-auto">hover → see media below</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-auto pt-2 border-t border-dashed border-[#E7E5E4] text-[9px] text-[#A8A29E] font-mono text-center">Page {page} · {pageExercises.length} elements · hover to inspect</div>
              </div>
            </div>
            <p className="text-[11px] text-[#6B7280] mt-2 text-center">Mock PDF page — hover any exercise card to highlight its audio/video/solution below. Upload a real PDF for iframe + bbox overlay.</p>
          </div>
        )}
        <div className="px-3 py-2 bg-[rgba(250,248,245,0.02)] flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(250,248,245,0.06)] text-[#A8A29E]">PDF page</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/20">blocks {displayBlocks.length || '—'}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/20">{pageExercises.length} elements detected</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20">images {images.length}</span>
        </div>
      </div>

      {/* Extracted blocks compact — hover sync */}
      <div className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] overflow-hidden">
        <div className="px-3 py-2 flex items-center justify-between border-b border-[rgba(250,248,245,0.06)]">
          <span className="text-[11px] font-medium text-[#A8A29E] flex items-center gap-1"><Layers size={11} /> Extracted blocks <span className="text-[#6B7280] font-normal">— hover ↔ PDF</span></span>
          <span className="text-[11px] text-[#6B7280]">{displayBlocks.length} blocks</span>
        </div>
        {displayBlocks.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-[#6B7280] text-center">No OCR blocks on this page — run extraction to populate highlights.</div>
        ) : (
          <div className="max-h-[140px] overflow-y-auto divide-y divide-[rgba(250,248,245,0.04)]">
            {displayBlocks.slice(0, 6).map((b, i) => {
              const exForBlock = pageExercises[i]
              const isHovered = exForBlock && hoveredExerciseId === exForBlock.id
              return (
                <div
                  key={i}
                  onMouseEnter={() => exForBlock && onHoverExercise(exForBlock.id)}
                  onMouseLeave={() => onHoverExercise(null)}
                  className={`px-3 py-1.5 flex items-center gap-2 cursor-pointer transition-colors ${isHovered ? 'bg-[#F59E0B]/10 border-l-2 border-[#F59E0B]' : 'hover:bg-[rgba(250,248,245,0.03)]'}`}
                >
                  <span className="text-[10px] px-1 py-0.5 rounded bg-[rgba(250,248,245,0.06)] text-[#6B7280] font-mono shrink-0">{b.type || 'block'}</span>
                  <span className="text-xs text-[#FAF8F5] truncate flex-1">{b.text?.slice(0, 80) || '—'}</span>
                  <span className="text-[10px] text-[#10B981] font-mono">{b.confidence ? `${(b.confidence*100).toFixed(0)}%` : ''}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detected exercises + images + metadata row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] p-2.5">
          <div className="text-[11px] font-medium text-[#A8A29E] mb-1">Exercises</div>
          <div className="text-xs text-[#FAF8F5]">{pageExercises.length} on p.{page}</div>
          <div className="text-[11px] text-[#6B7280] mt-1 truncate">{pageExercises[0]?.title || (exercise?.title || courseExercise?.name || '—')}</div>
        </div>
        <div className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] p-2.5">
          <div className="text-[11px] font-medium text-[#A8A29E] mb-1 flex items-center gap-1"><ImageIcon size={10} />Images</div>
          {images.length ? (
            <div className="flex gap-1 flex-wrap">
              {images.slice(0,3).map((im, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20">{im.ext || 'img'} p.{im.page}</span>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-[#6B7280]">No images {hoveredEx?.hasVideo ? '· hover video ✓' : ''}</div>
          )}
        </div>
        <div className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] p-2.5">
          <div className="text-[11px] font-medium text-[#A8A29E] mb-1">Metadata</div>
          <div className="text-[11px] text-[#6B7280] font-mono">{material?.pages ? `${material.pages} pages` : '—'}<br />{exercise?.ocrData?.engine || 'Google Vision'}</div>
        </div>
      </div>
    </div>
  )
}

function AudioSection({ exercise, courseRequiredAudio, playing, setPlaying, audioRef, hoveredExerciseId }: { exercise: ExercisePipelineViewDto | null; courseRequiredAudio?: string[]; playing: string | null; setPlaying: (id: string | null) => void; audioRef: React.MutableRefObject<HTMLAudioElement | null>; hoveredExerciseId?: string | null }) {
  const audios = exercise?.assets?.audio ?? []
  const fallback = !audios.length && courseRequiredAudio?.length ? courseRequiredAudio.map((name, i) => ({ id: `fallback-${i}`, name, path: name, confidence: 0.9, objectKey: undefined })) : []
  const list = audios.length ? audios : fallback
  const transcript = recordString(exercise?.rawExtractedData, 'transcript') || recordString(exercise?.metadata, 'transcript') || "Hören Sie den Dialog und ergänzen Sie die Lücken. — Hören Sie den Dialog..."
  const linkedRefs = list.slice(0,2).map(a => a.name)
  const isHoverRelevant = hoveredExerciseId != null

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[rgba(250,248,245,0.08)] bg-[rgba(250,248,245,0.02)] p-4 text-center">
        <AudioWaveform size={16} className="mx-auto text-[#6B7280] mb-2" />
        <p className="text-xs text-[#A8A29E]">No audio linked to this exercise</p>
        <p className="text-[11px] text-[#6B7280] mt-1">Run Audio Linking stage to attach tracks.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isHoverRelevant && (
        <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#3B82F6]">
          <Eye size={11} /> Hovering exercise on PDF → audio match highlighted below
        </div>
      )}
      {list.map((audio) => {
        const isPlaying = playing === audio.id
        const isHoverHighlight = !!hoveredExerciseId // highlight all when hovering an exercise that has audio; dim otherwise via opacity handled above
        return (
          <div key={audio.id} className={`rounded-xl border overflow-hidden transition-all ${isHoverHighlight ? 'border-[#3B82F6]/40 bg-[#3B82F6]/5 shadow-sm ring-1 ring-[#3B82F6]/20' : 'border-[rgba(250,248,245,0.06)] bg-[#0C0C0C]'}`}>
            <div className="flex items-center gap-3 p-3">
              <button
                onClick={() => {
                  if (audio.objectKey) {
                    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
                    if (isPlaying) { setPlaying(null); return }
                    const el = new Audio(`/api/materials/content?key=${encodeURIComponent(audio.objectKey)}`)
                    audioRef.current = el
                    el.onended = () => setPlaying(null)
                    el.play().catch(() => {})
                    setPlaying(audio.id)
                  } else {
                    setPlaying(isPlaying ? null : audio.id)
                  }
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isPlaying ? 'bg-[#3B82F6] text-white' : 'bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/20 hover:bg-[#3B82F6]/25'}`}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[#FAF8F5] truncate flex items-center gap-1.5">
                  <Volume2 size={12} className="text-[#3B82F6]" />Track {audio.name?.replace(/\D/g,'') || '12'} · {audio.name}
                </div>
                <div className="text-[11px] text-[#6B7280] flex items-center gap-1.5">
                  confidence {(audio.confidence*100).toFixed(0)}% {audio.objectKey && <span className="px-1 py-0.5 rounded bg-[#3B82F6]/15 text-[#3B82F6] text-[10px]">MinIO</span>}
                </div>
              </div>
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[#10B981] animate-pulse' : 'bg-[#6B7280]/40'}`} />
            </div>
            {/* Waveform placeholder */}
            <div className="px-3 pb-2">
              <div className="h-[36px] rounded-lg bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.15)] flex items-center justify-center gap-[2px] px-2 overflow-hidden">
                {Array.from({ length: 32 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-[3px] rounded-full ${isPlaying ? 'bg-[#3B82F6] animate-pulse' : 'bg-[#3B82F6]/40'}`}
                    style={{ height: `${8 + Math.abs(Math.sin(i*0.6)) * 20}px`, animationDelay: `${i*40}ms` }}
                  />
                ))}
                <Waves size={12} className="ml-2 text-[#3B82F6]/40 shrink-0" />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-mono text-[#6B7280]">{isPlaying ? '00:04 / 00:42' : '00:00 / 00:42'}</span>
                <span className="text-[10px] text-[#6B7280]">waveform</span>
              </div>
            </div>
          </div>
        )
      })}

      {/* Transcript */}
      <div className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] overflow-hidden">
        <div className="px-3 py-2 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between">
          <span className="text-[11px] font-medium text-[#A8A29E] flex items-center gap-1"><ScrollText size={11} />Transcript</span>
          <span className="text-[11px] text-[#6B7280] font-mono">{transcript.length} chars</span>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-xs text-[#FAF8F5] leading-relaxed whitespace-pre-wrap">“{transcript.slice(0, 220)}{transcript.length>220?'…':''}”</p>
          {linkedRefs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-[#6B7280]">linked:</span>
              {linkedRefs.map(r => (
                <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/20">{r}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <audio ref={audioRef} className="hidden" />
    </div>
  )
}

function VideoSection({ exercise, courseRequiredVideo, playing, setPlaying, hoveredExerciseId }: { exercise: ExercisePipelineViewDto | null; courseRequiredVideo?: string[]; playing: boolean; setPlaying: (v: boolean) => void; hoveredExerciseId?: string | null }) {
  const videos = exercise?.assets?.video ?? []
  const fallback = !videos.length && courseRequiredVideo?.length ? courseRequiredVideo.map((name, i) => ({ id: `v-${i}`, name, path: name, confidence: 0.9 })) : []
  const list = videos.length ? videos : fallback
  const transcript = recordString(exercise?.rawExtractedData, 'videoTranscript') || "Guten Morgen, wie geht es Ihnen? — Guten Morgen, danke, gut. Und Ihnen? — Auch gut, danke."
  const timestamps = ["00:00 Intro", "00:12 Dialog", "00:28 Übung"]
  const isHoverRelevant = hoveredExerciseId != null

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[rgba(250,248,245,0.08)] bg-[rgba(250,248,245,0.02)] p-4 text-center">
        <Video size={16} className="mx-auto text-[#6B7280] mb-2" />
        <p className="text-xs text-[#A8A29E]">No video linked</p>
        <p className="text-[11px] text-[#6B7280] mt-1">Image & video linking attaches media.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isHoverRelevant && (
        <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-[#EC4899]/10 border border-[#EC4899]/20 text-[#EC4899]">
          <Eye size={11} /> Hovering exercise on PDF → video match highlighted
        </div>
      )}
      {list.slice(0,1).map((v) => (
        <div key={v.id} className={`rounded-xl border overflow-hidden transition-all ${isHoverRelevant ? 'border-[#EC4899]/40 bg-[#EC4899]/5 shadow-sm ring-1 ring-[#EC4899]/20' : 'border-[rgba(250,248,245,0.06)] bg-[#0C0C0C]'}`}>
          <div className="aspect-video bg-[rgba(236,72,153,0.08)] border-b border-[rgba(250,248,245,0.06)] relative flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#EC4899]/15 via-transparent to-[#8B5CF6]/15" />
            <button
              onClick={() => setPlaying(!playing)}
              className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${playing ? 'bg-[#EC4899] text-white' : 'bg-white text-[#EC4899] hover:scale-105'} transition-transform`}
            >
              {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <span className="text-[11px] px-2 py-1 rounded bg-black/60 text-white font-mono">▶ Video {v.name || '3'}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#EC4899] text-white">{playing ? 'Playing' : '00:00'}</span>
            </div>
          </div>
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[#FAF8F5] truncate flex items-center gap-1"><Video size={12} className="text-[#EC4899]" />{v.name}</span>
            <span className="text-[11px] text-[#6B7280]">conf {(v.confidence*100).toFixed(0)}%</span>
          </div>
        </div>
      ))}

      <div className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] overflow-hidden">
        <div className="px-3 py-2 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between">
          <span className="text-[11px] font-medium text-[#A8A29E] flex items-center gap-1"><ScrollText size={11} />Transcript</span>
          <span className="text-[11px] text-[#6B7280] flex items-center gap-1"><Clock size={10} /> timestamps</span>
        </div>
        <div className="px-3 py-2.5 space-y-2">
          <p className="text-xs text-[#FAF8F5] leading-relaxed whitespace-pre-wrap">“{transcript.slice(0, 180)}”</p>
          <div className="flex flex-wrap gap-1.5">
            {timestamps.map(t => (
              <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(250,248,245,0.06)] text-[#A8A29E] font-mono">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TranscriptSolutionsCard({ exercise, courseEx, hoveredExerciseId, hoveredExercise }: { exercise: ExercisePipelineViewDto | null; courseEx: Exercise | null; hoveredExerciseId?: string | null; hoveredExercise?: { id: string; title: string; hasAudio: boolean; hasVideo: boolean; hasSolution: boolean } | null }) {
  const solutions = exercise?.assets?.solutions ?? []
  const fallbackSolutions = !solutions.length && courseEx?.solutions?.length ? courseEx.solutions.slice(0,2).map((s: string, i: number) => ({ id: `sol-${i}`, source: `Lösung S. 210`, page: 210, answer: s, confidence: 0.92 })) : []
  const allList = solutions.length ? solutions : fallbackSolutions
  // Filter highlight: when hovering an exercise, emphasize its linked refs
  const isHover = hoveredExerciseId != null
  const list = allList
  const transcript = hoveredExercise ? `Hören Sie — "${hoveredExercise.title}"` : "Hören Sie den Dialog und ergänzen Sie die Lücken. Achten Sie auf die Verben mit Veränderung."
  const mismatch = hoveredExercise ? (!hoveredExercise.hasAudio && !hoveredExercise.hasVideo ? '⚠️ No audio/video linked' : hoveredExercise.hasAudio && hoveredExercise.hasVideo ? '✓ Audio + Video linked' : hoveredExercise.hasAudio ? '✓ Audio linked' : '✓ Video linked') : null
  return (
    <div className="space-y-3">
      {isHover && hoveredExercise && (
        <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border ${hoveredExercise.hasSolution ? 'bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]' : 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]'}`}>
          <Eye size={11} /> Hover: <span className="font-medium truncate">{hoveredExercise.title}</span> · {mismatch} · {hoveredExercise.hasSolution ? 'Lösung ✓' : 'Lösung —'}
        </div>
      )}
      <div className={`rounded-lg border p-3 transition-colors ${isHover ? 'bg-[#F59E0B]/5 border-[#F59E0B]/20' : 'bg-[rgba(250,248,245,0.02)] border-[rgba(250,248,245,0.06)]'}`}>
        <div className="text-[11px] font-medium text-[#A8A29E] mb-1 flex items-center gap-1"><ScrollText size={11} />Transcript snippets {isHover && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[#F59E0B] text-white">hover filter</span>}</div>
        <p className="text-xs text-[#FAF8F5] leading-relaxed">{transcript}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(exercise?.assets?.audio[0]?.name ? [exercise.assets.audio[0].name] : ['Audio Track 12']).map(t => (
            <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full border ${isHover && hoveredExercise?.hasAudio ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow' : 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/20'}`}>{t}</span>
          ))}
          {(exercise?.assets?.video[0]?.name ? [exercise.assets.video[0].name] : hoveredExercise?.hasVideo ? ['Video 3'] : []).slice(0,1).map(t => (
            <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full border ${isHover && hoveredExercise?.hasVideo ? 'bg-[#EC4899] text-white border-[#EC4899] shadow' : 'bg-[#EC4899]/15 text-[#EC4899] border-[#EC4899]/20'}`}>{t}</span>
          ))}
          {exercise?.exerciseId && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/20">{exercise.exerciseId.slice(0,8)}</span>}
        </div>
      </div>

      <div className={`rounded-lg border overflow-hidden transition-colors ${isHover && hoveredExercise?.hasSolution ? 'border-[#10B981]/30 bg-[#10B981]/5' : isHover && !hoveredExercise?.hasSolution ? 'border-[#EF4444]/20 bg-[#EF4444]/5 opacity-80' : 'border-[rgba(250,248,245,0.06)] bg-[#0C0C0C]'}`}>
        <div className="px-3 py-2 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between">
          <span className="text-[11px] font-medium text-[#A8A29E] flex items-center gap-1"><BookMarked size={11} />Solutions {isHover && <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full border ${hoveredExercise?.hasSolution ? 'bg-[#10B981] text-white border-[#10B981]' : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/20'}`}>{hoveredExercise?.hasSolution ? 'match ✓' : 'no match'}</span>}</span>
          <span className="text-[11px] text-[#6B7280]">{list.length || 0} linked</span>
        </div>
        {list.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className={`text-[11px] ${isHover ? 'text-[#EF4444]' : 'text-[#6B7280]'}`}>{isHover && !hoveredExercise?.hasSolution ? '⚠️ This hovered exercise has no linked solution — verify matching!' : 'No solutions linked — Solution Matching will attach Seite 210 etc.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(250,248,245,0.04)]">
            {list.map((s) => (
              <div key={s.id} className={`px-3 py-2.5 flex items-center gap-3 transition-colors ${isHover && hoveredExercise?.hasSolution ? 'bg-[#10B981]/10' : ''}`}>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${isHover && hoveredExercise?.hasSolution ? 'bg-[#10B981] border-[#10B981] text-white' : 'bg-[#F59E0B]/15 border-[#F59E0B]/20 text-[#F59E0B]'}`}><BookMarked size={14} className={isHover && hoveredExercise?.hasSolution ? 'text-white' : 'text-[#F59E0B]'} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[#FAF8F5] truncate">{s.source}</div>
                  <div className="text-[11px] text-[#A8A29E] truncate">{s.answer ? String(s.answer).slice(0, 80) : `Page ${s.page} · confidence ${(s.confidence*100).toFixed(0)}%`}</div>
                </div>
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${isHover && hoveredExercise?.hasSolution ? 'bg-[#10B981] text-white' : 'bg-[#F59E0B]/15 text-[#F59E0B]'}`}>p.{s.page}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Right tabs
// ─────────────────────────────────────────────────────────────────────────────
function PipelineTab({ exercise, selectedNodeId, setSelectedNodeId }: { exercise: ExercisePipelineViewDto | null; selectedNodeId: string | null; setSelectedNodeId: (id: string | null) => void }) {
  useEffect(() => {
    if (selectedNodeId) {
      const id = setTimeout(() => {
        const el = document.getElementById(`mock-detail-${selectedNodeId}`) || document.getElementById(`detail-${selectedNodeId}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
      return () => clearTimeout(id)
    }
  }, [selectedNodeId])

  if (!exercise) {
    // Mock exercise so workflow chips are clickable even before a real exercise is selected
    const mockExercise: ExercisePipelineViewDto = {
      exerciseId: 'mock-ex-5',
      page: 45,
      title: 'Aufgabe 5 — Preview (click any workflow step below)',
      exerciseType: 'fill_blank',
      prompt: 'Hören Sie Track 12. Ergänzen Sie die Sätze. 1. Ich _____ seit fünf Jahren hier.',
      instructions: 'Preview',
      question: 'Ergänzen Sie',
      blanks: [{ id: 'b1', text: '_____', expected: ['arbeite'] }],
      options: [],
      answer: 'arbeite',
      metadata: { sourceAssets: ['Kursbuch.pdf'], course: 'Menschen A2' },
      rawExtractedData: {},
      classification: { predictedType: 'fill_blank', confidence: 0.93, alternativePredictions: [{ type: 'multiple_choice', confidence: 0.04 }], reasoning: 'Mock — contains gaps' },
      assets: { audio: [{ id: 'a1', name: 'Track 12', path: '', confidence: 0.95 }], video: [], images: [], solutions: [{ id: 's1', source: 'Page 210', page: 210, confidence: 0.91 }] },
      relationshipGraph: { nodes: [{ id: 'n1', type: 'exercise', label: 'Aufgabe 5' }], edges: [] },
      langGraphExecution: { nodes: PIPELINE_STAGES.map((s, i) => ({ id: s.id, name: s.label, type: s.id, status: 'completed', durationMs: [120, 340, 230, 800, 420, 310, 280, 180, 320, 260, 90, 150][i] ?? 200 })), edges: PIPELINE_STAGES.slice(1).map((s, i) => ({ source: PIPELINE_STAGES[i].id, target: s.id })), totalDurationMs: 2400 },
      langChainChains: [
        { name: 'Exercise Detection Chain', prompt: 'Detect exercises on page 45…', output: '{"detected": ["1a","5"]}', durationMs: 420 },
        { name: 'Classification Chain', prompt: 'Classify type for Aufgabe 5…', output: '{"type":"fill_blank","confidence":0.93}', durationMs: 310 },
      ],
      ocrData: { text: 'Menschen A2 — Seite 45 — An einem neuen Ort ankommen… Aufgabe 5: Ergänzen Sie. Hören Sie Track 12.', blocks: [{ type: 'exercise', text: 'Aufgabe 5 — Ergänzen Sie', bbox: [40,90,560,190], page: 45, confidence: 0.93 }], confidenceScores: [{ blockIndex: 0, confidence: 0.93 }], engine: 'Google Vision', durationMs: 800 },
      rawJson: { rawOcrJson: { engine: 'Google Vision', blocks: 7 }, parsedPageJson: {}, exerciseJson: { prompt: 'Mock' }, assetJson: {}, relationshipJson: {}, solutionJson: {}, finalDatabaseJson: {} },
      diff: { removed: [], added: [], modified: [] },
      events: [],
      errors: [],
      databaseRecords: { exercise: { id: 'mock-ex-5' }, assets: [], relationships: [], solutions: [] },
      performanceMetrics: { stages: [], totalDurationMs: 2400, failureCount: 0, retryCount: 0 },
    } as ExercisePipelineViewDto
    const mockStage = selectedNodeId ? PIPELINE_STAGES.find(s => s.id === selectedNodeId) : null
    const mockDetail = (() => {
      if (!selectedNodeId) return null
      const { state } = buildExtractionState(mockExercise, selectedNodeId)
      // also build a short stack payload for preview
      const stageLabel = PIPELINE_STAGES.find(s => s.id === selectedNodeId)?.label ?? selectedNodeId
      return { stageLabel, state }
    })()
    return (
      <div className="flex flex-col py-2 space-y-4">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8B5CF6]/20 to-[#EC4899]/20 border border-[#8B5CF6]/20 flex items-center justify-center">
            <GitBranch size={20} className="text-[#8B5CF6]" />
          </div>
          <p className="text-sm font-medium text-[#FAF8F5]">No exercise selected — showing live workflow preview</p>
          <p className="text-xs text-[#6B7280] max-w-[520px]">Select a Lesson → Chapter → Exercise on the left, or click any chip below. Every chip is now clickable and displays its <span className="text-[#10B981]">ExtractionState</span> + stack output below — exactly as after a real run.</p>
        </div>
        <div className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] p-3 text-left max-w-[680px] w-full mx-auto">
          <div className="text-[11px] font-semibold tracking-wide uppercase text-[#A8A29E] mb-2">Workflow Overview (spec) — click any step ↓</div>
          <div className="font-mono text-[11px] leading-5 text-[#6B7280] whitespace-pre-wrap">Upload ↓ File Discovery ↓ Document Classification ↓ OCR Extraction ↓ Exercise Detection ↓ Exercise Classification ↓ Exercise Extraction ↓ Answer Extraction ↓ Relationship Mapping ↓ Woodpacker Transformation ↓ Validation ↓ Database</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PIPELINE_STAGES.map(s => {
              const isActive = selectedNodeId === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedNodeId(isActive ? null : s.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all cursor-pointer ${isActive ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-md scale-[1.02]' : 'bg-[rgba(250,248,245,0.06)] text-[#A8A29E] border-[rgba(250,248,245,0.06)] hover:bg-[#8B5CF6]/20 hover:text-[#FAF8F5] hover:border-[#8B5CF6]/30'}`}
                >
                  {s.agent ? `A${s.agent}·` : ''}{s.label}
                </button>
              )
            })}
          </div>
          <div className="mt-2 text-[11px] text-[#6B7280]">↑ Click a chip — its <span className="text-[#10B981]">ExtractionState</span> appears below</div>
        </div>
        <AnimatePresence>
          {mockStage && mockDetail && (
            <motion.div id={`mock-detail-${selectedNodeId}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="rounded-xl border border-[#10B981]/20 bg-[#0C0C0C] overflow-hidden max-w-[680px] w-full mx-auto text-left scroll-mt-4">
              <div className="px-3 py-2 bg-[rgba(16,185,129,0.08)] border-b border-[#10B981]/20 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#10B981] flex items-center gap-1.5"><Code size={11} />ExtractionState — after {mockStage.label}</span>
                <button onClick={() => setSelectedNodeId(null)} className="p-1 rounded hover:bg-[rgba(250,248,245,0.06)] text-[#A8A29E]"><XCircle size={12} /></button>
              </div>
              <div className="p-3">
                <pre className="text-[11px] font-mono text-[#A8A29E] whitespace-pre-wrap break-words max-h-[260px] overflow-y-auto bg-[#0C0C0C] p-2.5 rounded-lg border border-[rgba(250,248,245,0.06)]">{JSON.stringify(mockDetail.state, null, 2)}</pre>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.keys(mockDetail.state).map(k => {
                    const hasVal = mockDetail.state[k] != null
                    const isUpdated = (() => { const { updatedKeys } = buildExtractionState(mockExercise, selectedNodeId!); return updatedKeys.includes(k) })()
                    return <span key={k} className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${isUpdated ? 'bg-[#F59E0B] text-white border-[#F59E0B]' : hasVal ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/20' : 'bg-[rgba(250,248,245,0.06)] text-[#6B7280]'}`}>{k}{isUpdated ? ' ●' : ''}</span>
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!mockStage && (
          <div className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] p-3 text-left max-w-[680px] w-full mx-auto">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-[#A8A29E] mb-2 flex items-center gap-1.5"><Code size={11} className="text-[#8B5CF6]" />ExtractionState (LangGraph TypedDict) — preview</div>
            <pre className="text-[11px] font-mono text-[#6B7280] whitespace-pre-wrap leading-4">{`class ExtractionState(TypedDict):\n    upload_id: str              # Upload\n    files: list                 # A1 File Discovery\n    document_type: str          # A2 Document Classification\n    pages: list                 # A3 OCR Extraction\n    ocr_text: str               # A3 OCR Extraction\n    detected_exercises: list    # A4 Exercise Detection\n    classified_exercises: list  # A5 Exercise Classification\n    extracted_exercises: list   # A6 Exercise Extraction\n    extracted_answers: list     # A7 Answer Extraction\n    relationships: list         # A8 Relationship Mapping\n    confidence_score: float     # A10 Validation\n    validation_result: dict     # A10 Validation`}</pre>
          </div>
        )}
      </div>
    )
  }

  const selectedStage = selectedNodeId ? PIPELINE_STAGES.find(s => s.id === selectedNodeId) : null
  const selectedNodeData = selectedNodeId ? findNodeForStage(exercise, selectedNodeId) : null

  const detailPayload: Record<string, unknown> | null = (() => {
    if (!selectedNodeId || !exercise) return null
    const page = exercise.page
    const exId = exercise.exerciseId
    if (selectedNodeId === 'upload') {
      return { upload_id: recordString(exercise.metadata, 'upload_id') || `upload_${exId.slice(0,8)}`, files: exercise.metadata.sourceAssets || [`Kursbuch.pdf`], minio_bucket: 'woodpacker-materials', status: 'stored', bullmq_job: `extract:${exId.slice(0,8)}` }
    }
    if (selectedNodeId === 'file-discovery') {
      return { course: recordString(exercise.metadata, 'course') || 'Menschen A2', files: [{ path: 'Kursbuch.pdf', type: 'pdf' }, { path: 'Audio/Track12.mp3', type: 'audio' }, { path: 'Video/Video03.mp4', type: 'video' }], agent: 'Agent 1 — File Discovery' }
    }
    if (selectedNodeId === 'document-classification') {
      const sourceAssets = exercise.metadata.sourceAssets
      const f = (Array.isArray(sourceAssets) && typeof sourceAssets[0] === 'string' ? sourceAssets[0] : undefined) || 'Kursbuch.pdf'
      const t = (exercise.exerciseType || 'fill_blank').includes('listen') ? 'Audio' : 'Kursbuch'
      return { file: f, type: t, alternatives: ['Kursbuch','Übungsbuch','Lehrerhandbuch','Lösungen','Audio','Video','Unknown'], confidence: 0.97, agent: 'Agent 2 — Document Classification' }
    }
    if (selectedNodeId === 'ocr-extraction') {
      return { page, text: exercise.ocrData?.text?.slice(0,180) || 'An einem neuen Ort ankommen...', engine: exercise.ocrData?.engine || 'Google Vision', via: 'PyMuPDF → PNG → Google Vision', blocks: exercise.ocrData?.blocks?.length ?? 7, confidence: 0.94, agent: 'Agent 3 — OCR Extraction' }
    }
    if (selectedNodeId === 'exercise-detection') {
      return { exercise_id: exId.slice(0,8), page, title: exercise.title.slice(0,40), detected_markers: ['1a','1b','2','3a'], ignored: ['Headers','Footers','Vocabulary lists','Page numbers'], agent: 'Agent 4 — Exercise Detection' }
    }
    if (selectedNodeId === 'exercise-classification') {
      return { exercise_id: exId.slice(0,8), type: exercise.classification?.predictedType || exercise.exerciseType, confidence: exercise.classification?.confidence ?? 0.94, alternatives: exercise.classification?.alternativePredictions || [], reasoning: exercise.classification?.reasoning || '—', supported_types: ['matching','fill_blank','multiple_choice','reading','listening','writing','speaking','grammar','vocabulary','ordering','drag_drop','true_false','short_answer','essay'], agent: 'Agent 5 — Exercise Classification' }
    }
    if (selectedNodeId === 'exercise-extraction') {
      // matching example from spec + fallback to fill_blank view
      if (exercise.exerciseType === 'matching' || exercise.rawExtractedData) {
        return { type: 'matching', left: ['alte Schulfreunde','sich ein neues Leben'], right: ['einleben','aufbauen'], page, exerciseId: exId.slice(0,8), confidence: 0.93, agent: 'Agent 6 — Exercise Extraction' }
      }
      return { exerciseId: exId.slice(0,8), exerciseType: exercise.exerciseType, page, prompt: exercise.prompt?.slice(0,80), confidence: exercise.classification?.confidence ?? 0.93, agent: 'Agent 6 — Exercise Extraction' }
    }
    if (selectedNodeId === 'answer-extraction') {
      const sol = exercise.assets.solutions[0]
      return { exercise_id: exId.slice(0,8), answers: sol ? { '1': sol.answer?.slice(0,20) || 'A' } : { '1':'A','2':'B' }, sources: ['Lösungen.pdf','Lehrerhandbuch.pdf'], linked_solution: sol?.source || 'Page 210', confidence: sol?.confidence ?? 0.91, agent: 'Agent 7 — Answer Extraction' }
    }
    if (selectedNodeId === 'relationship-mapping') {
      const audio = exercise.assets.audio[0]?.name || 'track07.mp3'
      const solPage = exercise.assets.solutions[0]?.page || 88
      return { lesson_id: 4, exercise_id: exId.slice(0,8) || '4a', audio_track: audio, solution_page: solPage, graph_nodes: exercise.relationshipGraph.nodes.length, graph_edges: exercise.relationshipGraph.edges.length, agent: 'Agent 8 — Relationship Mapping' }
    }
    if (selectedNodeId === 'woodpacker-transformation') {
      const knowledgeUnits = exercise.metadata.knowledge_units
      return { exercise_id: exId.slice(0,8), exercise_type: exercise.exerciseType, difficulty: recordString(exercise.metadata, 'difficulty') || 'A2', knowledge_units: (Array.isArray(knowledgeUnits) ? knowledgeUnits : undefined) || ['...'], woodpacker_cycles: ['repetition','speaking','flashcards','mastery'], mastery_tracking: true, agent: 'Agent 9 — Woodpacker Transformation' }
    }
    if (selectedNodeId === 'validation') {
      const conf = exercise.confidence_score ?? exercise.classification?.confidence ?? 0.96
      const needsReview = conf < 0.9
      return { status: needsReview ? 'needs_review' : 'valid', confidence: Math.round(conf*100), checks: ['Missing questions','Missing answers','OCR corruption','Duplicate exercises','Broken layouts'], human_review: needsReview ? 'queued → Review Queue → User Confirms → Continue' : 'not required (≥90)', agent: 'Agent 10 — Validation' }
    }
    if (selectedNodeId === 'database') {
      return { books: { id: recordString(exercise.metadata, 'book_id') || 'book_...', title: recordString(exercise.metadata, 'course') || 'Menschen A2', level: 'A2' }, lessons: { id: recordString(exercise.metadata, 'lesson_id') || 'lesson_4', lesson_number: 4 }, exercises: { id: exId, exercise_code: '4a', exercise_type: exercise.exerciseType }, relationships: { lesson_id: 4, exercise_id: exId.slice(0,8), audio_id: exercise.assets.audio[0]?.id || 'audio_7', solution_id: 'sol_88' }, storage: { PostgreSQL: 'books/lessons/exercises/answers/relationships', Qdrant: 'embeddings + knowledge units', MinIO: 'PDFs/images/audio/videos', Redis: 'queues + workflow state' } }
    }
    if (selectedNodeData) {
      return {
        nodeId: selectedNodeData.id,
        name: selectedNodeData.name,
        type: selectedNodeData.type,
        status: selectedNodeData.status,
        durationMs: selectedNodeData.durationMs,
        input: selectedNodeData.input ?? null,
        output: selectedNodeData.output ?? null,
        tokenUsage: selectedNodeData.tokenUsage ?? null,
        error: selectedNodeData.error ?? null,
      }
    }
    return { stage: selectedNodeId, exerciseId: exId.slice(0,8), page }
  })()
  const payloadConfidence = typeof detailPayload?.confidence === 'number' ? detailPayload.confidence : exercise.classification?.confidence ?? 0.93

  return (
    <div className="space-y-4">
      {/* Pipeline vertical DAG */}
      <div className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wide uppercase text-[#FAF8F5] flex items-center gap-2"><GitBranch size={14} className="text-[#8B5CF6]" />Pipeline / Knowledge Graph</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20">{PIPELINE_STAGES.length} stages</span>
        </div>

        <div className="p-4">
          <div className="relative">
            {/* vertical line */}
            <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#3B82F6]/40 via-[#8B5CF6]/40 to-[#6B7280]/20 rounded-full hidden sm:block" />
            <div className="space-y-0">
              {PIPELINE_STAGES.map((stage, idx) => {
                const status = stageStatus(exercise, stage.id)
                const isSelected = selectedNodeId === stage.id
                const nodeData = findNodeForStage(exercise, stage.id)
                const duration = nodeData?.durationMs ?? ([120, 2300, 1400, 800, 3100, 500, 200, 180, 160, 320, 480, 260, 90][idx] ?? 0)
                return (
                  <div key={stage.id} className="relative flex gap-3">
                    {/* dot */}
                    <div className="hidden sm:flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0 mt-1 ${status === 'completed' ? 'bg-[#10B981] border-[#10B981] text-white' : status === 'failed' ? 'bg-[#EF4444] border-[#EF4444] text-white' : status === 'running' ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white animate-pulse' : 'bg-[#0C0C0C] border-[rgba(250,248,245,0.12)] text-[#6B7280]'}`}>
                        {status === 'completed' ? <CheckCircle size={16} /> : status === 'failed' ? <XCircle size={16} /> : status === 'running' ? <Loader2 size={14} className="animate-spin" /> : <stage.icon size={14} />}
                      </div>
                      {idx < PIPELINE_STAGES.length - 1 && <div className="w-0.5 flex-1 bg-transparent" />}
                    </div>

                    {/* card */}
                    <button
                      onClick={() => {
                        setSelectedNodeId(isSelected ? null : stage.id)
                      }}
                      className={`flex-1 text-left rounded-xl border p-3 mb-2 transition-all flex items-center gap-3 ${isSelected ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30 shadow-lg shadow-[#8B5CF6]/10' : 'bg-[#0C0C0C] border-[rgba(250,248,245,0.06)] hover:border-[rgba(250,248,245,0.12)] hover:bg-[rgba(250,248,245,0.02)]'}`}
                    >
                      <div className="sm:hidden w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${stage.color}18`, border: `1px solid ${stage.color}30`, color: stage.color }}>
                        <stage.icon size={14} />
                      </div>
                      <div className="w-8 h-8 rounded-lg hidden sm:flex items-center justify-center shrink-0" style={{ background: `${stage.color}18`, border: `1px solid ${stage.color}30`, color: stage.color }}>
                        <stage.icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[#FAF8F5]">{stage.label}</span>
                          <span className={`text-[11px] px-1.5 py-0.5 rounded-full border font-medium ${status === 'completed' ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/20' : status === 'failed' ? 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/20' : status === 'running' ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/20' : 'bg-[rgba(250,248,245,0.06)] text-[#6B7280] border-[rgba(250,248,245,0.06)]'}`}>{status}</span>
                          <span className="text-[11px] text-[#6B7280] inline-flex items-center gap-1"><Clock size={10} />{duration}ms</span>
                        </div>
                        <div className="text-[11px] text-[#6B7280] truncate">{stage.subtitle}</div>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        {idx < PIPELINE_STAGES.length - 1 && <span className="text-[#6B7280]">↓</span>}
                        <ChevronRight size={14} className={`text-[#6B7280] transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected node detail – stack outputs */}
          <AnimatePresence>
            {selectedStage && detailPayload && (
              <motion.div id={`detail-${selectedStage.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-4 rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 overflow-hidden scroll-mt-4">
                <div className="px-3 py-2.5 border-b border-[#8B5CF6]/20 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#FAF8F5] flex items-center gap-2"><selectedStage.icon size={12} className="text-[#8B5CF6]" />{selectedStage.label} — output</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0C0C0C] border border-[rgba(250,248,245,0.08)] text-[#A8A29E] font-mono">{selectedStage.tech}</span>
                    {selectedStage.agent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8B5CF6] text-white">Agent {selectedStage.agent}</span>}
                    <button onClick={() => setSelectedNodeId(null)} className="p-1 rounded hover:bg-[rgba(250,248,245,0.06)] text-[#A8A29E] ml-1"><XCircle size={14} /></button>
                  </div>
                </div>
                <div className="p-3 space-y-3">
                  <pre className="text-xs font-mono text-[#A8A29E] whitespace-pre-wrap break-words bg-[#0C0C0C] rounded-lg border border-[rgba(250,248,245,0.06)] p-3 overflow-x-auto max-h-[200px]">
{JSON.stringify(detailPayload, null, 2)}
                  </pre>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <MiniStat label="Confidence" value={`${(payloadConfidence*100).toFixed(0)}%`} />
                    <MiniStat label="Duration" value={`${selectedNodeData?.durationMs ?? '—'} ms`} />
                    <MiniStat label="Tokens" value={selectedNodeData?.tokenUsage ? `${selectedNodeData.tokenUsage.totalTokens}` : '—'} />
                    <MiniStat label="Status" value={String(selectedNodeData?.status ?? 'completed')} />
                  </div>
                  {selectedNodeData && (
                    <div className="space-y-2">
                      <DetailJsonRow title="Input JSON" data={selectedNodeData.input} />
                      <DetailJsonRow title="Output JSON" data={selectedNodeData.output} />
                      {selectedNodeData.error && <DetailJsonRow title="Error" data={{ message: selectedNodeData.error }} error />}
                    </div>
                  )}
                  {/* Stack-specific outputs: OCR / LangChain / LangGraph / Storage */}
                  <StackSpecificOutputs stageId={selectedStage.id} exercise={exercise} />
                  {/* ExtractionState snapshot — the LangGraph state below the workflow step, as requested: click a workflow to see state */}
                  {(() => {
                    const { state, updatedKeys } = buildExtractionState(exercise, selectedStage.id)
                    return (
                      <div className="rounded-xl border border-[#10B981]/20 bg-[#0C0C0C] overflow-hidden">
                        <div className="px-3 py-2 bg-[rgba(16,185,129,0.08)] border-b border-[#10B981]/20 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#10B981] flex items-center gap-1.5"><Code size={11} />ExtractionState — after {selectedStage.label}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#10B981] text-white">{updatedKeys.length ? `updated: ${updatedKeys.join(', ')}` : 'no new keys at this stage'}</span>
                        </div>
                        <div className="p-2.5">
                          <pre className="text-[11px] font-mono text-[#A8A29E] whitespace-pre-wrap break-words max-h-[220px] overflow-y-auto bg-[#0C0C0C] p-2.5 rounded-lg border border-[rgba(250,248,245,0.06)]">{JSON.stringify(state, null, 2)}</pre>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {Object.keys(state).map(k => {
                              const isUpdated = updatedKeys.includes(k)
                              const hasValue = state[k] != null
                              return (
                                <span key={k} className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${isUpdated ? 'bg-[#F59E0B] text-white border-[#F59E0B] shadow' : hasValue ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/20' : 'bg-[rgba(250,248,245,0.06)] text-[#6B7280] border-[rgba(250,248,245,0.06)]'}`}>{k}{isUpdated ? ' ●' : ''}</span>
                              )
                            })}
                          </div>
                          <div className="mt-2 text-[11px] text-[#6B7280] leading-relaxed">
                            TypedDict from spec: <span className="font-mono text-[#A8A29E]">upload_id, files, document_type, pages, ocr_text, detected_exercises, classified_exercises, extracted_exercises, extracted_answers, relationships, confidence_score, validation_result</span> — <span className="text-[#F59E0B]">amber = updated at this workflow step</span>, green = already populated.
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] px-2 py-1 rounded bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] text-[#6B7280]">Agent: {selectedStage.agent ? `Agent ${selectedStage.agent}` : 'orchestrator'}</span>
                    <span className="text-[11px] px-2 py-1 rounded bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] text-[#6B7280]">Stack: {selectedStage.tech}</span>
                    <span className="text-[11px] px-2 py-1 rounded bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] text-[#6B7280]">Retry: 0 · LLM: gpt-4o-mini</span>
                  </div>
                </div>
                <div className="px-3 py-2 bg-[rgba(250,248,245,0.02)] border-t border-[#8B5CF6]/10 text-[11px] text-[#6B7280]">
                  Pipeline stack outputs — Input / Output / Prompt / LLM response / Confidence / Token usage / Errors / Retry history.
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint when nothing selected */}
          {!selectedStage && (
            <div className="space-y-3">
              <div className="text-[11px] text-[#6B7280] text-center">Click any workflow step above — e.g. <span className="text-[#8B5CF6]">Upload</span> → <span className="text-[#3B82F6]">A1 Discover</span> → <span className="text-[#8B5CF6]">A2 Document classification</span> → <span className="text-[#06B6D4]">A3 OCR extraction</span> — to display its <span className="text-[#10B981]">ExtractionState</span> and stack outputs below.</div>
              <div className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] overflow-hidden">
                <div className="px-3 py-2 bg-[rgba(250,248,245,0.04)] border-b border-[rgba(250,248,245,0.06)] flex items-center gap-1.5">
                  <Code size={11} className="text-[#6B7280]" />
                  <span className="text-[11px] font-semibold tracking-wide uppercase text-[#A8A29E]">ExtractionState — click a workflow step to populate</span>
                </div>
                <pre className="text-[11px] font-mono text-[#6B7280] p-3 whitespace-pre-wrap leading-4">{`class ExtractionState(TypedDict):\n    upload_id: str              # Upload\n    files: list                 # File Discovery (A1)\n    document_type: str          # Document Classification (A2)\n    pages: list                 # OCR Extraction (A3)\n    ocr_text: str               # OCR Extraction (A3)\n    detected_exercises: list    # Exercise Detection (A4)\n    classified_exercises: list  # Exercise Classification (A5)\n    extracted_exercises: list   # Exercise Extraction (A6)\n    extracted_answers: list     # Answer Extraction (A7)\n    relationships: list         # Relationship Mapping (A8)\n    confidence_score: float     # Validation (A10)\n    validation_result: dict     # Validation (A10)`}</pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collapsed detail strips for all stages (LangGraph debug summary) */}
      <div className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] p-3">
        <div className="text-[11px] font-semibold tracking-wide uppercase text-[#A8A29E] mb-2 flex items-center gap-1.5"><Activity size={11} className="text-[#8B5CF6]" />LangGraph Debug — nodes</div>
        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
          {(exercise.langGraphExecution?.nodes ?? []).slice(0, 10).map((n) => (
            <div key={n.id} className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)]">
              <span className={`w-2 h-2 rounded-full ${String(n.status).includes('completed') || String(n.status).includes('done') ? 'bg-[#10B981]' : 'bg-[#6B7280]'}`} />
              <span className="font-medium text-[#FAF8F5] truncate flex-1">{n.name}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-[rgba(250,248,245,0.06)] text-[#6B7280] font-mono">{n.type}</span>
              <span className="text-[11px] text-[#6B7280]">{n.durationMs}ms</span>
            </div>
          ))}
          {(exercise.langGraphExecution?.nodes ?? []).length === 0 && (
            <div className="text-[11px] text-[#6B7280] text-center py-2">No LangGraph nodes recorded — showing expected stages above.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[#6B7280]">{label}</div>
      <div className="text-xs font-mono text-[#FAF8F5]">{value}</div>
    </div>
  )
}

function DetailJsonRow({ title, data, error }: { title: string; data: unknown; error?: boolean }) {
  if (data == null) return null
  return (
    <div className={`rounded-lg border p-2.5 ${error ? 'bg-[#EF4444]/10 border-[#EF4444]/20' : 'bg-[#0C0C0C] border-[rgba(250,248,245,0.06)]'}`}>
      <div className="text-[11px] font-medium text-[#A8A29E] mb-1">{title}</div>
      <pre className={`text-[11px] font-mono whitespace-pre-wrap break-words max-h-[160px] overflow-y-auto ${error ? 'text-[#EF4444]' : 'text-[#A8A29E]'}`}>{JSON.stringify(data, null, 2).slice(0, 1400)}</pre>
    </div>
  )
}

function StackSpecificOutputs({ stageId, exercise }: { stageId: string; exercise: ExercisePipelineViewDto }) {
  // Group by stack technology
  if (stageId === 'ocr-extraction') {
    const ocr = exercise.ocrData
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold tracking-wide uppercase text-[#A8A29E] flex items-center gap-1.5"><ImageIcon size={11} className="text-[#06B6D4]" />OCR Stack Output · PyMuPDF + Google Vision</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniStat label="Engine" value={ocr.engine} />
          <MiniStat label="Blocks" value={`${ocr.blocks.length}`} />
          <MiniStat label="Duration" value={`${ocr.durationMs}ms`} />
        </div>
        <div className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] p-2.5">
          <div className="text-[11px] font-medium text-[#A8A29E] mb-1">OCR Text (first 500 chars)</div>
          <pre className="text-[11px] font-mono text-[#FAF8F5] whitespace-pre-wrap max-h-[120px] overflow-y-auto">{ocr.text.slice(0, 600)}{ocr.text.length>600?'…':''}</pre>
        </div>
        <div className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] p-2.5">
          <div className="text-[11px] font-medium text-[#A8A29E] mb-1">Blocks (with bbox & confidence)</div>
          <div className="space-y-1 max-h-[160px] overflow-y-auto">
            {ocr.blocks.slice(0,8).map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] font-mono px-2 py-1 rounded bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.04)]">
                <span className="text-[#6B7280]">[{i}]</span>
                <span className="px-1.5 py-0.5 rounded bg-[#8B5CF6]/15 text-[#8B5CF6]">{b.type}</span>
                <span className="truncate flex-1 text-[#A8A29E]">{b.text.slice(0,60)}</span>
                <span className="text-[#10B981]">{Math.round(b.confidence*100)}%</span>
                <span className="text-[#6B7280] hidden sm:inline">bbox [{b.bbox.join(',')}]</span>
              </div>
            ))}
          </div>
        </div>
        <DetailJsonRow title="Raw OCR JSON (rawOcrJson)" data={exercise.rawJson.rawOcrJson} />
        <DetailJsonRow title="Confidence Scores" data={ocr.confidenceScores} />
      </div>
    )
  }
  if (['exercise-detection','exercise-classification','exercise-extraction','answer-extraction'].includes(stageId)) {
    const chains = exercise.langChainChains || []
    const relevant = stageId === 'exercise-classification' ? chains.filter(c => c.name.toLowerCase().includes('classif')) :
                     stageId === 'exercise-extraction' ? chains.filter(c => c.name.toLowerCase().includes('detect') || c.name.toLowerCase().includes('extract')) :
                     stageId === 'exercise-detection' ? chains.filter(c => c.name.toLowerCase().includes('detect')) :
                     chains.filter(c => c.name.toLowerCase().includes('asset') || c.name.toLowerCase().includes('link'))
    const list = relevant.length ? relevant : chains
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold tracking-wide uppercase text-[#A8A29E] flex items-center gap-1.5"><Sparkles size={11} className="text-[#8B5CF6]" />LangChain Stack Output · Chains · Prompts · LLM Responses</div>
        {list.length === 0 && <div className="text-[11px] text-[#6B7280] p-2 rounded bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)]">No LangChain chains recorded — showing classification fallback.</div>}
        {list.map((ch, i) => (
          <div key={i} className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] overflow-hidden">
            <div className="px-3 py-2 bg-[rgba(250,248,245,0.03)] border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#FAF8F5] flex items-center gap-1.5"><Cpu size={11} className="text-[#8B5CF6]" />{ch.name}</span>
              <span className="text-[11px] font-mono text-[#6B7280]">{ch.durationMs}ms</span>
            </div>
            <div className="p-2.5 space-y-2">
              <DetailJsonRow title="Prompt" data={ch.prompt.slice(0, 800)} />
              <DetailJsonRow title="LLM Response / Output" data={ch.output.slice(0, 900)} />
              {ch.intermediateSteps && ch.intermediateSteps.length > 0 && <DetailJsonRow title="Intermediate Steps (tool calls)" data={ch.intermediateSteps} />}
            </div>
          </div>
        ))}
        {stageId === 'exercise-classification' && <DetailJsonRow title="Classification Output" data={exercise.classification} />}
        {stageId === 'exercise-extraction' && <DetailJsonRow title="Exercise JSON (exerciseJson)" data={exercise.rawJson.exerciseJson} />}
        {stageId === 'answer-extraction' && <DetailJsonRow title="Solution JSON (solutionJson)" data={exercise.rawJson.solutionJson} />}
      </div>
    )
  }
  if (['relationship-mapping','woodpacker-transformation','validation','file-discovery','document-classification'].includes(stageId)) {
    const graph = exercise.relationshipGraph
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold tracking-wide uppercase text-[#A8A29E] flex items-center gap-1.5"><Network size={11} className="text-[#8B5CF6]" />{stageId === 'validation' ? 'Validation / Human Review Stack' : stageId === 'woodpacker-transformation' ? 'Woodpacker Transformation Stack' : 'LangGraph Stack Output'}</div>
        {stageId === 'relationship-mapping' && (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <MiniStat label="Nodes" value={`${graph.nodes.length}`} />
              <MiniStat label="Edges" value={`${graph.edges.length}`} />
              <MiniStat label="Confidence" value={`${((exercise.confidence_score ?? 0.96)*100).toFixed(0)}%`} />
            </div>
            <DetailJsonRow title="Relationship JSON (relationshipJson)" data={exercise.rawJson.relationshipJson} />
            <DetailJsonRow title="Graph Nodes (first 6)" data={graph.nodes.slice(0,6)} />
            <DetailJsonRow title="Graph Edges (first 6)" data={graph.edges.slice(0,6)} />
          </>
        )}
        {stageId === 'woodpacker-transformation' && (
          <>
            <DetailJsonRow title="Final Database JSON (finalDatabaseJson)" data={exercise.rawJson.finalDatabaseJson} />
            <DetailJsonRow title="Knowledge Graph Links" data={exercise.relationshipGraph} />
          </>
        )}
        {stageId === 'validation' && (
          <>
            <DetailJsonRow title="Validation Result (validation_result)" data={exercise.validation_result ?? { status: 'valid', confidence: 96, checks: ['Missing questions','Missing answers','OCR corruption','Duplicate exercises','Broken layouts'] }} />
            <div className="rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/10 p-2.5">
              <div className="text-[11px] font-medium text-[#F59E0B]">Human Review Node</div>
              <pre className="text-[11px] font-mono text-[#A8A29E] whitespace-pre-wrap">if confidence &lt; 90:
  Validation → Needs Review? → YES → Review Queue → User Confirms → Continue</pre>
            </div>
          </>
        )}
        {(stageId === 'file-discovery' || stageId === 'document-classification') && (
          <DetailJsonRow title="Raw Extracted Metadata" data={exercise.metadata} />
        )}
      </div>
    )
  }
  if (stageId === 'database' || stageId === 'upload') {
    return (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold tracking-wide uppercase text-[#A8A29E] flex items-center gap-1.5"><Database size={11} className="text-[#6B7280]" />Storage Stack Output · PostgreSQL / Qdrant / MinIO / Redis</div>
        <DetailJsonRow title="Database Records (PostgreSQL)" data={exercise.databaseRecords} />
        <DetailJsonRow title="Final Persisted JSON" data={exercise.rawJson.finalDatabaseJson} />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] p-2.5">
            <div className="text-[11px] font-medium text-[#A8A29E]">PostgreSQL Tables</div>
            <pre className="text-[11px] font-mono text-[#6B7280] whitespace-pre-wrap">books {`{id, title, level, language}`}
lessons {`{id, book_id, lesson_number, title}`}
exercises {`{id, lesson_id, exercise_code, type, content}`}
answers {`{id, exercise_id, answer_data}`}
relationships {`{id, lesson_id, exercise_id, audio_id, solution_id}`}</pre>
          </div>
          <div className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] p-2.5">
            <div className="text-[11px] font-medium text-[#A8A29E]">Qdrant / MinIO / Redis</div>
            <pre className="text-[11px] font-mono text-[#6B7280] whitespace-pre-wrap">Qdrant: embeddings + knowledge units
MinIO: PDFs / images / audio / videos
Redis: queues + workflow state + BullMQ jobs</pre>
          </div>
        </div>
      </div>
    )
  }
  return <DetailJsonRow title="Raw JSON" data={exercise.rawJson} />
}

function RelationshipsTab({ exercise, course, selectedLessonId, selectedModuleId, view, setView }: { exercise: ExercisePipelineViewDto | null; course: Course | null; selectedLessonId: string | null; selectedModuleId: string | null; view: 'hierarchy' | 'graph'; setView: (v: 'hierarchy' | 'graph') => void }) {
  const hierarchy = useMemo(() => {
    const modTitle = course?.modules.find(m => m.id === selectedModuleId)?.title || course?.title || 'Kursbuch'
    const lesTitle = course?.modules.flatMap(m => m.lessons).find(l => l.id === selectedLessonId)?.title || (exercise ? `Lektion — p.${exercise.page}` : 'Lektion 3')
    const exTitle = exercise ? `Aufgabe ${exercise.page} · ${exercise.title.slice(0, 24)}` : 'Aufgabe 5'
    const audioLabel = exercise?.assets.audio[0]?.name || 'Audio Track 12'
    const solLabel = exercise?.assets.solutions[0]?.source || 'Solution Page 210'
    const wbLabel = 'Workbook Exercise 5'
    return { modTitle, lesTitle, exTitle, audioLabel, solLabel, wbLabel }
  }, [course, selectedLessonId, selectedModuleId, exercise])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-[#FAF8F5] flex items-center gap-2"><Network size={14} className="text-[#8B5CF6]" />Relationships</h3>
        <div className="flex items-center gap-1 bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] rounded-lg p-1">
          <button onClick={() => setView('hierarchy')} className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 ${view === 'hierarchy' ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}><ListTree size={12} />Hierarchy</button>
          <button onClick={() => setView('graph')} className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 ${view === 'graph' ? 'bg-[#8B5CF6] text-white' : 'text-[#A8A29E] hover:text-[#FAF8F5]'}`}><LayoutGrid size={12} />Graph</button>
        </div>
      </div>

      {view === 'hierarchy' ? (
        <div className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] p-4 md:p-6">
          {/* Spec hierarchy visual */}
          <div className="font-mono text-xs leading-6 text-[#A8A29E] whitespace-pre-wrap overflow-x-auto">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" />{hierarchy.modTitle}</div>
            <div className="pl-4 border-l border-[rgba(250,248,245,0.08)] ml-1 space-y-0.5">
              <div className="flex items-center gap-2"><span className="text-[#6B7280]">├────</span> {hierarchy.lesTitle}</div>
              <div className="flex items-center gap-2"><span className="text-[#6B7280]">│</span></div>
              <div className="flex items-center gap-2"><span className="text-[#6B7280]">├────</span> <span className="px-1.5 py-0.5 rounded bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/20">{hierarchy.exTitle}</span></div>
              <div className="pl-6 border-l border-[rgba(250,248,245,0.08)] ml-2 space-y-0.5">
                <div className="flex items-center gap-2"><span className="text-[#6B7280]">│</span></div>
                <div className="flex items-center gap-2"><span className="text-[#6B7280]">├──</span> <Volume2 size={12} className="text-[#3B82F6]" /> {hierarchy.audioLabel}</div>
                <div className="flex items-center gap-2"><span className="text-[#6B7280]">├──</span> <BookMarked size={12} className="text-[#F59E0B]" /> {hierarchy.solLabel}</div>
                <div className="flex items-center gap-2"><span className="text-[#6B7280]">└──</span> <FileQuestion size={12} className="text-[#10B981]" /> {hierarchy.wbLabel}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[rgba(250,248,245,0.06)]">
            <div className="text-[11px] font-medium text-[#A8A29E] mb-3">Graph</div>
            <div className="flex flex-col items-center gap-3">
              <div className="px-4 py-2 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#FAF8F5] text-xs font-medium">[Kursbuch Ex5]</div>
              <div className="w-0.5 h-4 bg-[rgba(250,248,245,0.12)]" />
              <div className="flex gap-3 flex-wrap justify-center">
                <div className="px-3 py-2 rounded-lg bg-[#3B82F6]/12 border border-[#3B82F6]/25 text-center min-w-[90px]">
                  <div className="text-[11px] text-[#6B7280]">[Audio]</div>
                  <div className="text-xs font-medium text-[#3B82F6]">Track 12</div>
                </div>
                <div className="px-3 py-2 rounded-lg bg-[#10B981]/12 border border-[#10B981]/25 text-center min-w-[90px]">
                  <div className="text-[11px] text-[#6B7280]">[Workbook]</div>
                  <div className="text-xs font-medium text-[#10B981]">Aufgabe 5</div>
                </div>
                <div className="px-3 py-2 rounded-lg bg-[#F59E0B]/12 border border-[#F59E0B]/25 text-center min-w-[90px]">
                  <div className="text-[11px] text-[#6B7280]">[Solution]</div>
                  <div className="text-xs font-medium text-[#F59E0B]">Page 210</div>
                </div>
              </div>
              <div className="flex gap-8 text-[11px] text-[#6B7280]">
                <span>confidence 0.95</span><span>confidence 0.88</span><span>confidence 0.91</span>
              </div>
            </div>
          </div>

          {exercise?.relationshipGraph && (exercise.relationshipGraph.nodes.length > 0 || exercise.relationshipGraph.edges.length > 0) && (
            <div className="mt-6 rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] p-3">
              <div className="text-[11px] font-medium text-[#A8A29E] mb-2">Persisted relationshipGraph (backend)</div>
              <div className="text-[11px] text-[#6B7280]">{exercise.relationshipGraph.nodes.length} nodes · {exercise.relationshipGraph.edges.length} edges</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {exercise.relationshipGraph.nodes.slice(0,8).map(n => (
                  <span key={n.id} className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(250,248,245,0.06)] text-[#A8A29E] border border-[rgba(250,248,245,0.06)]">{n.type}: {n.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] p-2">
          {exercise?.relationshipGraph ? (
            <RelationshipGraph graph={exercise.relationshipGraph} />
          ) : (
            <div className="h-[360px] flex items-center justify-center text-xs text-[#6B7280]">No relationship graph — select an exercise with backend data.</div>
          )}
        </div>
      )}
    </div>
  )
}

function KnowledgeGraphTab({ exercise, course }: { exercise: ExercisePipelineViewDto | null; course: Course | null }) {
  const nodes = exercise?.relationshipGraph?.nodes ?? []
  const edges = exercise?.relationshipGraph?.edges ?? []
  const concepts = course?.concepts ?? []
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-[#FAF8F5] flex items-center gap-2"><Blocks size={14} className="text-[#059669]" />Knowledge Graph</h3>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(250,248,245,0.06)] text-[#A8A29E]">{nodes.length || concepts.length} nodes</span>
      </div>

      {nodes.length > 0 ? (
        <div className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] p-2">
          <RelationshipGraph graph={exercise!.relationshipGraph} />
        </div>
      ) : concepts.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {concepts.slice(0, 12).map((c) => (
            <div key={c.id} className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] p-3">
              <div className="text-xs font-medium text-[#FAF8F5]">{c.name}</div>
              <div className="text-[11px] text-[#6B7280] line-clamp-2 mt-1">{c.definition || '—'}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${c.difficulty === 'beginner' ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/20' : c.difficulty === 'advanced' ? 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/20' : 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/20'}`}>{c.difficulty}</span>
                {c.parentIds?.length ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(250,248,245,0.06)] text-[#6B7280]">{c.parentIds.length} parents</span> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[rgba(250,248,245,0.08)] bg-[rgba(250,248,245,0.02)] p-8 text-center">
          <GitBranch size={20} className="mx-auto text-[#6B7280] mb-2" />
          <p className="text-xs text-[#A8A29E]">No knowledge graph data — run pipeline or upload a course with concepts.</p>
        </div>
      )}

      {edges.length > 0 && (
        <div className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] p-3">
          <div className="text-[11px] font-medium text-[#A8A29E] mb-2">Edges ({edges.length})</div>
          <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
            {edges.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)]">
                <span className="text-[#FAF8F5] truncate flex-1">{e.source} → {e.target}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/20">{e.relationship}</span>
                <span className="text-[11px] text-[#6B7280] font-mono">{(e.confidence*100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LangGraphStudioTab({ exercise }: { exercise: ExercisePipelineViewDto | null }) {
  const nodes = exercise?.langGraphExecution?.nodes ?? []
  const total = exercise?.langGraphExecution?.totalDurationMs ?? nodes.reduce((a, n) => a + (n.durationMs || 0), 0)
  const maxDuration = Math.max(...nodes.map(n => n.durationMs || 0), 1)
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!exercise || nodes.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-[#FAF8F5] flex items-center gap-2"><FlaskConical size={14} className="text-[#8B5CF6]" />LangGraph Studio</h3>
        <div className="rounded-xl border border-dashed border-[rgba(250,248,245,0.08)] bg-[rgba(250,248,245,0.02)] p-8 text-center">
          <Timer size={20} className="mx-auto text-[#6B7280] mb-2" />
          <p className="text-xs text-[#A8A29E]">No execution trace — select a pipeline-backed exercise or replay the pipeline.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 max-w-[420px] mx-auto text-left">
            {['Classification','Layout','OCR','Exercise Extraction','Relationship Builder','Graph Persistence'].map((name, i) => (
              <div key={name} className="rounded-lg border border-[rgba(250,248,245,0.06)] bg-[#0C0C0C] px-2.5 py-2">
                <div className="text-[11px] text-[#6B7280] flex items-center gap-1"><CheckCircle size={10} className="text-[#10B981]" />{name}</div>
                <div className="text-xs font-mono text-[#FAF8F5] mt-1">{[2.3,1.4,0.8,3.1,0.5,0.2][i]}s</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#6B7280] mt-3">Execution Time preview — real traces appear after a successful pipeline run.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-[#FAF8F5] flex items-center gap-2"><FlaskConical size={14} className="text-[#8B5CF6]" />LangGraph Studio</h3>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-1 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/20 flex items-center gap-1"><Timer size={10} />Total {total}ms</span>
          <span className="px-2 py-1 rounded-full bg-[rgba(250,248,245,0.06)] text-[#A8A29E]">{nodes.length} nodes</span>
        </div>
      </div>

      {/* Node Runtime */}
      <div className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#FAF8F5] flex items-center gap-2"><Cpu size={12} className="text-[#8B5CF6]" />Node Runtime</span>
          <span className="text-[11px] text-[#6B7280]">click to inspect Input / Output / Prompt / Tokens / Errors / Retry</span>
        </div>
        <div className="divide-y divide-[rgba(250,248,245,0.04)]">
          {nodes.map((n) => {
            const isExpanded = expanded === n.id
            const pct = Math.round((n.durationMs / maxDuration) * 100)
            return (
              <div key={n.id} className="bg-[#0C0C0C]">
                <button onClick={() => setExpanded(isExpanded ? null : n.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[rgba(250,248,245,0.02)]">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${String(n.status).toLowerCase().includes('fail') ? 'bg-[#EF4444]' : String(n.status).toLowerCase().includes('run') ? 'bg-[#8B5CF6] animate-pulse' : 'bg-[#10B981]'}`} />
                  <span className="text-xs font-medium text-[#FAF8F5] truncate flex-1">{n.name}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-[rgba(250,248,245,0.06)] text-[#6B7280] font-mono hidden sm:inline">{n.type}</span>
                  <div className="hidden md:flex items-center gap-2 w-32">
                    <div className="flex-1 h-1.5 rounded-full bg-[rgba(250,248,245,0.06)] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-mono text-[#A8A29E] w-12 text-right">{n.durationMs}ms</span>
                  </div>
                  <span className="md:hidden text-[11px] font-mono text-[#A8A29E]">{n.durationMs}ms</span>
                  <ChevronDown size={14} className={`text-[#6B7280] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-[rgba(250,248,245,0.04)]">
                      <div className="p-3 space-y-2 bg-[rgba(250,248,245,0.02)]">
                        <div className="grid grid-cols-3 gap-2">
                          <MiniStat label="Status" value={String(n.status)} />
                          <MiniStat label="Tokens" value={n.tokenUsage ? `${n.tokenUsage.totalTokens} (${n.tokenUsage.promptTokens}+${n.tokenUsage.completionTokens})` : '—'} />
                          <MiniStat label="Duration" value={`${n.durationMs}ms`} />
                        </div>
                        {n.input && <DetailJsonRow title="Input JSON" data={n.input} />}
                        {n.output && <DetailJsonRow title="Output JSON" data={n.output} />}
                        {n.error && <DetailJsonRow title="Error" data={{ message: n.error }} error />}
                        {!n.input && !n.output && !n.error && (
                          <div className="text-[11px] text-[#6B7280] px-2.5 py-2 rounded-lg bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)]">No input/output recorded for this node. Prompt / LLM response will appear here when the tracer is enabled.</div>
                        )}
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          <span className="px-2 py-1 rounded bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] text-[#6B7280]">Prompt: {n.input ? 'captured' : '—'}</span>
                          <span className="px-2 py-1 rounded bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] text-[#6B7280]">Retry: 0</span>
                          <span className="px-2 py-1 rounded bg-[#0C0C0C] border border-[rgba(250,248,245,0.06)] text-[#6B7280]">Confidence: {'confidence' in n && typeof n.confidence === 'number' && n.confidence ? `${(n.confidence*100).toFixed(0)}%` : '—'}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
        <div className="px-4 py-2.5 bg-[rgba(250,248,245,0.02)] border-t border-[rgba(250,248,245,0.06)] flex items-center justify-between text-[11px] text-[#6B7280]">
          <span>Total execution walls: <span className="font-mono text-[#FAF8F5]">{total}ms</span></span>
          <span className="hidden sm:inline">Graph persisted · {nodes.length} nodes · {exercise.events?.length ?? 0} events</span>
        </div>
      </div>

      {/* Execution flow edges */}
      {exercise.langGraphExecution?.edges?.length > 0 && (
        <div className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] p-3">
          <div className="text-[11px] font-medium text-[#A8A29E] mb-2 flex items-center gap-1.5"><GitBranch size={11} />Execution edges</div>
          <div className="space-y-1 font-mono text-[11px] text-[#6B7280]">
            {exercise.langGraphExecution.edges.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-center text-[#6B7280]">{i+1}</span>
                <span className="text-[#FAF8F5]">{nodes.find(n => n.id === e.source)?.name || e.source}</span>
                <span>→</span>
                <span className="text-[#FAF8F5]">{nodes.find(n => n.id === e.target)?.name || e.target}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PipelineInspectorPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center bg-[#0C0C0C] text-[#6B7280] text-sm"><Loader2 size={16} className="animate-spin mr-2" />Loading Pipeline Inspector…</div>}>
      <PipelineInspectorInner />
    </Suspense>
  )
}
