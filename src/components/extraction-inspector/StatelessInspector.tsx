'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type BBox = [number, number, number, number]

interface LayoutBlock {
  block_id: string
  page: number
  type: string
  bbox: BBox
  confidence: number
  text?: string
  source?: string
  meta?: Record<string, unknown>
}

interface PageModel {
  page: number
  width: number
  height: number
  blocks: LayoutBlock[]
}

interface Bundle {
  file_id: string
  filename: string
  sha256?: string
  page_count: number
  pages: PageModel[]
  ocr?: unknown[]
  classifications?: unknown[]
  relationships?: unknown[]
  knowledge_graph?: unknown
  exercises: unknown[]
  quality: Record<string, unknown>
  providers_used: Record<string, string>
  llm_calls?: number
  telemetry: { node: string; duration_ms: number; status: string; confidence?: unknown; started_at?: string }[]
  wall_time_ms?: number
}

const BLOCK_COLOR: Record<string, string> = {
  title: '#F59E0B',
  subtitle: '#FBBF24',
  paragraph: '#9CA3AF',
  exercise: '#EF4444',
  instruction: '#3B82F6',
  question: '#10B981',
  answer_area: '#06B6D4',
  image: '#EC4899',
  table: '#8B5CF6',
  header: '#6B7280',
  footer: '#6B7280',
  audio_reference: '#F97316',
  video_reference: '#7C3AED',
  page_number: '#4B5563',
  caption: '#34D399',
  unknown: '#1F2937',
}

export interface InspectorConfig {
  id: string
  title: string
  subtitle: string
  description: string
  apiPrefix: string
  port: number
  accent: string
  tech: string
  philosophy: string
  expectedProvider: string
  iconLabel: string
}

const COMPARISON_PROVIDERS: Record<string, { label: string; apiPrefix: string; endpoint: 'analyze' | 'extract' }> = {
  docling: { label: 'Docling', apiPrefix: 'docling', endpoint: 'extract' },
  'google-docai': { label: 'Google Document AI', apiPrefix: 'google-docai', endpoint: 'analyze' },
  surya: { label: 'Surya', apiPrefix: 'surya', endpoint: 'analyze' },
  'pp-structure': { label: 'PP-Structure', apiPrefix: 'pp-structure', endpoint: 'analyze' },
  pymupdf: { label: 'PyMuPDF', apiPrefix: 'pymupdf', endpoint: 'analyze' },
}

function BBoxOverlay({ page, selectedId, hoveredId = null, visibleTypes, comparePage = null, onSelect, onHover, apiPrefix, fileId }: {
  page: PageModel
  selectedId: string | null
  hoveredId?: string | null
  visibleTypes?: Set<string>
  comparePage?: PageModel | null
  onSelect: (id: string) => void
  onHover?: (id: string | null) => void
  apiPrefix: string
  fileId: string
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const imgUrl = `/api/${apiPrefix}/inspect/documents/${encodeURIComponent(fileId)}/pages/${page.page}/image.png`

  const blocks = page.blocks.filter(b => !visibleTypes || visibleTypes.has(b.type))
  return (
    <div className="relative w-full bg-[#0B1220] rounded-lg overflow-auto border border-white/10 max-h-[72vh]">
      <div className="relative min-w-full">
      {!imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl} alt={`Page ${page.page}`} className="w-full block" onError={() => setImgFailed(true)} />
      ) : (
        <div className="w-full aspect-[595/842] bg-white/[0.03] flex items-center justify-center text-[11px] text-[#6B7280]">
          No page render - bbox preview on blank canvas ({page.width}x{page.height})
        </div>
      )}
      <svg viewBox={`0 0 ${page.width} ${page.height}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        {blocks.map((b) => {
          const [x0, y0, x1, y1] = b.bbox
          const isSelected = b.block_id === selectedId
          const isHovered = b.block_id === hoveredId
          return (
            <rect
              key={`outer-${b.block_id}`}
              x={x0}
              y={y0}
              width={x1 - x0}
              height={y1 - y0}
              fill="none"
              stroke={BLOCK_COLOR[b.type] ?? '#6B7280'}
              strokeWidth={isSelected || isHovered ? 2 : 0.9}
              strokeOpacity={isSelected || isHovered ? 0.95 : 0.35}
              rx={2}
              pointerEvents="none"
            />
          )
        })}
        {blocks.map((b) => {
          const [x0, y0, x1, y1] = b.bbox
          const isSelected = b.block_id === selectedId
          const isHovered = b.block_id === hoveredId
          return (
            <rect
              key={`${b.block_id}-hit`}
              x={x0}
              y={y0}
              width={Math.max(1, x1 - x0)}
              height={Math.max(1, y1 - y0)}
              fill={isSelected ? 'rgba(16,185,129,0.18)' : isHovered ? 'rgba(255,255,255,0.08)' : 'transparent'}
              stroke={isSelected ? '#10B981' : isHovered ? '#FFFFFF' : 'transparent'}
              strokeWidth={isSelected ? 1.2 : 0}
              className="cursor-pointer"
              onClick={() => onSelect(b.block_id)}
              onMouseEnter={() => onHover?.(b.block_id)}
              onMouseLeave={() => onHover?.(null)}
            />
          )
        })}
        {comparePage?.blocks.map((b) => {
          const [x0, y0, x1, y1] = b.bbox
          return <rect key={`compare-${b.block_id}`} x={x0} y={y0} width={x1 - x0} height={y1 - y0}
            fill="none" stroke="#F97316" strokeWidth={1.2} strokeDasharray="4 3" strokeOpacity={0.75} pointerEvents="none" />
        })}
      </svg>
      </div>
      <div className="absolute bottom-1.5 left-1.5 flex flex-wrap gap-1 text-[10px] pointer-events-none">
        {Object.entries({ exercise: '#EF4444', instruction: '#3B82F6', question: '#10B981', answer_area: '#06B6D4', image: '#EC4899', paragraph: '#9CA3AF' }).map(([k, c]) => (
          <span key={k} className="px-1.5 py-0.5 rounded bg-black/60 text-white border" style={{ borderColor: c, color: c }}>{k}</span>
        ))}
      </div>
    </div>
  )
}

export default function StatelessInspector({ config }: { config: InspectorConfig }) {
  const [file, setFile] = useState<File | null>(null)
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<{ status?: string; engines?: Record<string, string> } | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set())
  const [compareId, setCompareId] = useState('')
  const [compareBundle, setCompareBundle] = useState<Bundle | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [exerciseView, setExerciseView] = useState<'none' | 'json' | 'difference'>('none')

  const isGoogleDocAI = config.id === 'google-docai'
  const isDocling = config.id === 'docling'
  const isLLMVision = config.id === 'llm-vision'

  useEffect(() => {
    let cancelled = false
    const probe = async () => {
      try {
        const res = await fetch(`/api/${config.apiPrefix}/health`, { cache: 'no-store' })
        if (!cancelled && res.ok) {
          const j = await res.json()
          setHealth(j)
          setHealthError(null)
        } else if (!cancelled) {
          const txt = await res.text().catch(() => '')
          setHealthError(`${res.status} ${txt.slice(0, 300)}`)
        }
      } catch (e) {
        if (!cancelled) setHealthError(String(e))
      }
    }
    void probe()
    const id = setInterval(probe, 12000)
    return () => { cancelled = true; clearInterval(id) }
  }, [config.apiPrefix])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
      if (event.key === '+' || event.key === '=') setZoom(value => Math.min(3, Number((value + 0.1).toFixed(2))))
      if (event.key === '-') setZoom(value => Math.max(0.5, Number((value - 0.1).toFixed(2))))
      if (event.key === '0') setZoom(1)
      if (event.key === 'ArrowLeft') setPageIdx(value => Math.max(0, value - 1))
      if (event.key === 'ArrowRight') setPageIdx(value => Math.min((bundle?.pages.length ?? 1) - 1, value + 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bundle?.pages.length])

  const run = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setBundle(null)
    setCompareBundle(null)
    setElapsed(null)
    const t0 = performance.now()
    try {
      const form = new FormData()
      form.append('file', file, file.name)
      const endpoint = isDocling ? `/api/${config.apiPrefix}/extract` : `/api/${config.apiPrefix}/analyze`
      const res = await fetch(endpoint, { method: 'POST', body: form })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`${res.status} ${txt.slice(0, 1000)}`)
      }
      const json = await res.json()
      const b: Bundle | null = json.bundle ?? json.document ?? json
      if (isDocling && json.document) {
        const doc = json.document as { pages?: unknown[]; blocks?: unknown[]; tables?: unknown[]; images?: unknown[]; markdown?: string }
        const pseudo: Bundle = {
          file_id: `docling-${Date.now()}`,
          filename: file.name,
          page_count: (doc.pages as unknown[])?.length ?? 1,
          pages: (json.pages as PageModel[]) ?? [],
          exercises: [],
          quality: { markdown_len: doc.markdown?.length, tables: (doc.tables as unknown[])?.length, images: (doc.images as unknown[])?.length },
          providers_used: { docling: 'ok', ocr: 'easyocr-de-en' },
          telemetry: [],
          wall_time_ms: json.metadata?.conversion_time_s ? Math.round(Number(json.metadata.conversion_time_s) * 1000) : undefined,
        }
        if ((doc.blocks as unknown[])?.length && pseudo.pages.length === 0) {
          const blocks = doc.blocks as Array<Record<string, unknown>>
          const byPage = new Map<number, LayoutBlock[]>()
          for (const blk of blocks) {
            const p = Number(blk.page ?? 1)
            const arr = byPage.get(p) ?? []
            arr.push({
              block_id: String(blk.id ?? `blk-${arr.length}`),
              page: p,
              type: String(blk.type ?? 'paragraph'),
              bbox: (blk.bbox as BBox) ?? [0, 0, 100, 20],
              confidence: 0.92,
              text: String(blk.text ?? ''),
            })
            byPage.set(p, arr)
          }
          pseudo.pages = Array.from(byPage.entries()).map(([page, blocks]) => ({ page, width: 595, height: 842, blocks }))
          pseudo.page_count = pseudo.pages.length
        }
        setBundle(pseudo)
      } else if (b) {
        const norm: Bundle = {
          file_id: (b as Bundle).file_id ?? `upload-${Date.now()}`,
          filename: (b as Bundle).filename ?? file.name,
          page_count: (b as Bundle).page_count ?? (b as Bundle).pages?.length ?? 1,
          pages: (b as Bundle).pages ?? [],
          exercises: (b as Bundle).exercises ?? [],
          quality: (b as Bundle).quality ?? {},
          providers_used: (b as Bundle).providers_used ?? {},
          llm_calls: (b as Bundle).llm_calls,
          telemetry: (b as Bundle).telemetry ?? [],
          wall_time_ms: (b as Bundle).wall_time_ms,
        }
        setBundle(norm)
      } else {
        throw new Error('Empty response')
      }
      setPageIdx(0)
      setSelectedBlock(null)
      setElapsed(Math.round(performance.now() - t0))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [file, config.apiPrefix, isDocling])

  const compare = useCallback(async () => {
    if (!file || !compareId || compareId === config.id) return
    const provider = COMPARISON_PROVIDERS[compareId]
    if (!provider) return
    setCompareLoading(true)
    try {
      const form = new FormData()
      form.append('file', file, file.name)
      const res = await fetch(`/api/${provider.apiPrefix}/${provider.endpoint}`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(`${provider.label} comparison failed: ${res.status}`)
      const json = await res.json()
      const candidate = (json.bundle ?? json.document ?? json) as Partial<Bundle>
      setCompareBundle({
        file_id: candidate.file_id ?? `compare-${Date.now()}`,
        filename: candidate.filename ?? file.name,
        page_count: candidate.page_count ?? candidate.pages?.length ?? 1,
        pages: candidate.pages ?? [],
        exercises: candidate.exercises ?? [],
        quality: candidate.quality ?? {},
        providers_used: candidate.providers_used ?? {},
        telemetry: candidate.telemetry ?? [],
        wall_time_ms: candidate.wall_time_ms,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCompareLoading(false)
    }
  }, [file, compareId, config.id])

  const currentPage = bundle?.pages[pageIdx] ?? null
  const comparePage = compareBundle?.pages[pageIdx] ?? null
  const availableTypes = useMemo(() => Array.from(new Set(bundle?.pages.flatMap(page => page.blocks.map(block => block.type)) ?? [])).sort(), [bundle])
  const stats = useMemo(() => {
    if (!bundle) return null
    const blocks = bundle.pages.reduce((s, p) => s + p.blocks.length, 0)
    const taxonomy: Record<string, number> = {}
    for (const p of bundle.pages) for (const b of p.blocks) taxonomy[b.type] = (taxonomy[b.type] ?? 0) + 1
    const totalMs = bundle.wall_time_ms ?? elapsed ?? bundle.telemetry.reduce((s, t) => s + (t.duration_ms ?? 0), 0)
    return { blocks, exercises: bundle.exercises.length, taxonomy, totalMs }
  }, [bundle, elapsed])

  const healthEngines = health?.engines ?? {}
  const forced = healthEngines['layout:forced'] ?? healthEngines['layout:active']
  const forcedUnavailable = Boolean(
    healthEngines['layout:active'] && String(healthEngines['layout:active']).toLowerCase().includes('error')
  ) || Boolean(error && (error.includes('not available') || error.includes('Forced provider')))
  const googleMissing = isGoogleDocAI && (
    healthEngines['layout:documentai'] === 'unavailable' ||
    String(healthEngines['layout:documentai:reason'] ?? '').includes('missing') ||
    String(healthEngines['layout:active'] ?? '').includes('error')
  )
  const googleFailure = isGoogleDocAI && Boolean(error || healthError) && !googleMissing
  const ppStructureMissing = config.id === 'pp-structure' && (
    forcedUnavailable || healthEngines['layout:paddle_structure'] === 'unavailable' || error?.includes('paddle_structure')
  )

  return (
    <div className="min-h-screen bg-[#060A14] text-[#FAF8F5] p-4 md:p-6">
      <div className="max-w-[1700px] mx-auto">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: config.accent }} />
              {config.title}
              <span className="text-xs font-normal px-2 py-0.5 rounded-full border" style={{ borderColor: config.accent, color: config.accent, background: config.accent + '14' }}>
                {config.iconLabel} :{config.port}
              </span>
            </h1>
            <p className="text-xs text-[#6B7280] mt-0.5">{config.subtitle} - {config.tech}</p>
            <p className="text-[11px] text-[#4B5563] mt-0.5 max-w-[720px]">{config.description} <span className="text-[#9CA3AF]">{config.philosophy}</span></p>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2.5 py-1 rounded-full border font-medium bg-black/20 border-white/10 text-[#9CA3AF]">
              {health ? `status ${health.status ?? 'ok'}` : healthError ? 'offline' : 'probing...'} {forced ? ` - ${forced}` : ''}
            </span>
            {stats && <span className="px-2.5 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-[#10B981]">{stats.exercises} exercises - {stats.blocks} blocks - {stats.totalMs}ms</span>}
          </div>
        </div>

        {health && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-medium text-[#A8A29E]">Engines:</span>
            {Object.entries(health.engines ?? {}).map(([k, v]) => {
              const ok = String(v) === 'ok'
              const err = String(v).includes('error') || String(v).includes('unavailable') || String(v).includes('reason')
              const cls = ok ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : err ? 'bg-red-500/15 text-red-400 border-red-500/20' : 'bg-white/5 text-[#6B7280] border-white/5'
              return <span key={k} className={`px-1.5 py-0.5 rounded border text-[10px] ${cls}`}>{k}:{String(v).slice(0, 60)}</span>
            })}
            <span className="ml-auto text-[#6B7280] hidden sm:inline">Stateless - Upload to Analyze to Return - No DB writes</span>
          </div>
        )}

        {(googleMissing || (isGoogleDocAI && !health)) && (
          <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs">
            <div className="font-semibold text-amber-400 flex items-center gap-1.5">Google Doc AI is not configured.</div>
            <div className="text-[#A8A29E] mt-1">Required: <span className="font-mono text-[#FAF8F5]">GOOGLE_CLOUD_PROJECT</span> - <span className="font-mono text-[#FAF8F5]">GOOGLE_APPLICATION_CREDENTIALS</span> - <span className="font-mono text-[#FAF8F5]">DOCAI_LAYOUT_PROCESSOR_ID</span>. No silent fallback - this benchmark returns 503 until configured.</div>
            <div className="text-[11px] text-[#6B7280] mt-1">Port :{config.port} - Forced provider: <span className="font-mono">{String(healthEngines['layout:forced'] ?? 'documentai')}</span> - Health: {healthError ?? JSON.stringify(healthEngines).slice(0, 160)}</div>
          </div>
        )}
        {googleFailure && (
          <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-xs">
            <div className="font-semibold text-red-400">Google Doc AI request failed.</div>
            <div className="text-[#A8A29E] mt-1">The provider is configured, but Google rejected or could not complete the request.</div>
            <div className="text-[11px] text-[#6B7280] mt-1">{error ?? healthError}</div>
          </div>
        )}
        {ppStructureMissing && (
          <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs">
            <div className="font-semibold text-amber-400">PP-Structure is not available.</div>
            <div className="text-[#A8A29E] mt-1">Missing: <span className="font-mono text-[#FAF8F5]">paddleocr &gt;=3.x (PP-StructureV3)</span> - install via <span className="font-mono">pip install paddleocr</span>. No silent fallback - this benchmark returns 503 until the provider is installed. Health: {JSON.stringify(healthEngines).slice(0, 200)}</div>
            {error && <div className="text-[11px] text-[#6B7280] mt-1">Error: {error.slice(0, 500)}</div>}
          </div>
        )}
        {forcedUnavailable && !googleMissing && !ppStructureMissing && (
          <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs">
            <div className="font-semibold text-amber-400">Forced provider not available: {String(forced)}</div>
            <div className="text-[#A8A29E] mt-1">No silent fallback - benchmark requires the forced engine to be installed/configured. Health: {JSON.stringify(healthEngines).slice(0, 200)}</div>
            {error && <div className="text-[11px] text-[#6B7280] mt-1">Error: {error.slice(0, 500)}</div>}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 mb-4 flex gap-2 items-center flex-wrap">
          <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-white/10 file:bg-black/30 file:text-[#FAF8F5] text-[#9CA3AF]" />
          <button onClick={run} disabled={!file || loading} className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40" style={{ background: config.accent, color: isGoogleDocAI || isLLMVision ? 'white' : 'black' }}>
            {loading ? 'Analyzing...' : `Analyze with ${config.title}`}
          </button>
          {bundle && <span className="text-xs text-[#6B7280]">{bundle.filename} - {bundle.page_count} pages - {elapsed ?? bundle.wall_time_ms ?? '-'} ms - provider: {bundle.providers_used['layout'] ?? bundle.providers_used['docling'] ?? String(forced ?? '-')}</span>}
          <span className="ml-auto text-[11px] text-[#6B7280] hidden md:inline">{config.tech} :{config.port} stateless</span>
        </div>
        {bundle && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2 mb-4 flex gap-2 items-center flex-wrap text-xs">
            <span className="text-[#9CA3AF] font-medium">Viewer</span>
            <button onClick={() => setZoom(value => Math.max(0.5, Number((value - 0.1).toFixed(2))))} className="px-2 py-1 rounded border border-white/10">-</button>
            <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(value => Math.min(3, Number((value + 0.1).toFixed(2))))} className="px-2 py-1 rounded border border-white/10">+</button>
            <button onClick={() => setZoom(1)} className="px-2 py-1 rounded border border-white/10">Reset</button>
            <span className="h-4 w-px bg-white/10 mx-1" />
            <span className="text-[#9CA3AF]">Filter</span>
            {availableTypes.map(type => {
              const active = visibleTypes.size === 0 || visibleTypes.has(type)
              return <button key={type} onClick={() => setVisibleTypes(previous => {
                const next = new Set(previous.size === 0 ? availableTypes : previous)
                if (next.has(type)) next.delete(type); else next.add(type)
                return next.size === availableTypes.length ? new Set() : next
              })} className={`px-2 py-1 rounded border ${active ? 'border-emerald-500/40 text-emerald-300' : 'border-white/10 text-[#6B7280]'}`}>{type}</button>
            })}
            <span className="h-4 w-px bg-white/10 mx-1" />
            <span className="text-[#9CA3AF]">Compare</span>
            <select value={compareId} onChange={event => setCompareId(event.target.value)} className="bg-[#0B1220] border border-white/10 rounded px-2 py-1">
              <option value="">Select provider</option>
              {Object.entries(COMPARISON_PROVIDERS).filter(([id]) => id !== config.id).map(([id, provider]) => <option key={id} value={id}>{provider.label}</option>)}
            </select>
            <button disabled={!compareId || compareLoading} onClick={compare} className="px-2 py-1 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 disabled:opacity-40">{compareLoading ? 'Comparing...' : 'Run comparison'}</button>
            {compareBundle && <span className="text-orange-300">Dashed orange: {COMPARISON_PROVIDERS[compareId]?.label}</span>}
            <span className="ml-auto text-[#6B7280] hidden lg:inline">Shortcuts: +/- zoom, 0 reset, arrows pages</span>
          </div>
        )}
        {error && <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 whitespace-pre-wrap break-words">{error}</div>}
        {healthError && !health && <div className="mb-3 text-xs text-amber-300">Health probe failed: {healthError} - service may be starting (docker compose up - wait ~20s for health)</div>}

        {!bundle ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="text-sm font-medium text-[#FAF8F5]">Upload a PDF to benchmark {config.title}</div>
            <div className="text-xs text-[#6B7280] mt-1 max-w-[560px] mx-auto">{config.description} Outputs: blocks, bboxes, per-block OCR, exercise grouping, taxonomy, telemetry - isolated on :{config.port} with no fallback for fair comparison.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.95fr] gap-4 items-start">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button disabled={pageIdx === 0} onClick={() => setPageIdx(n => Math.max(0, n - 1))} className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/20 text-xs disabled:opacity-40">Prev</button>
                  <select value={pageIdx} onChange={e => setPageIdx(Number(e.target.value))} className="bg-[#0B1220] border border-white/10 rounded-lg px-2 py-1.5 text-xs">
                    {bundle.pages.map((p, i) => <option key={p.page} value={i}>Page {p.page} - {p.blocks.length} blocks - {p.width}x{p.height}</option>)}
                  </select>
                  <button disabled={pageIdx >= bundle.pages.length - 1} onClick={() => setPageIdx(n => Math.min(bundle.pages.length - 1, n + 1))} className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/20 text-xs disabled:opacity-40">Next</button>
                </div>
                <div className="text-[11px] text-[#6B7280] hidden sm:block">click a box to inspect - {currentPage?.blocks.length ?? 0} blocks</div>
              </div>

              {currentPage ? <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%` }}>
                <BBoxOverlay page={currentPage} selectedId={selectedBlock} hoveredId={hoveredBlock} visibleTypes={visibleTypes.size ? visibleTypes : undefined} comparePage={comparePage} onSelect={setSelectedBlock} onHover={setHoveredBlock} apiPrefix={config.apiPrefix} fileId={bundle.file_id} />
              </div> : <div className="text-xs text-[#6B7280] p-4 border border-dashed border-white/10 rounded-lg">No pages detected - try another PDF</div>}

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="text-[11px] uppercase tracking-wide text-[#6B7280] mb-2">Blocks - {currentPage?.blocks.length ?? 0} on this page {stats ? ` taxonomy: ${Object.entries(stats.taxonomy).map(([k,v]) => k + ':' + v).join(' | ')}` : ''}</div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[220px] overflow-auto pr-1">
                  {currentPage?.blocks.map((b) => (
                    <button key={b.block_id} onClick={() => setSelectedBlock(b.block_id)} onMouseEnter={() => setHoveredBlock(b.block_id)} onMouseLeave={() => setHoveredBlock(null)} className={`rounded-lg overflow-hidden border-2 bg-[#0B1220] p-0.5 transition ${selectedBlock === b.block_id ? 'border-[#10B981] ring-1 ring-[#10B981]/50' : hoveredBlock === b.block_id ? 'border-white/50' : 'border-transparent hover:border-white/15'}`} title={`${b.block_id} - ${b.type}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/${config.apiPrefix}/inspect/documents/${encodeURIComponent(bundle.file_id)}/blocks/${encodeURIComponent(b.block_id)}.png`} alt={b.block_id} className="w-full aspect-[4/3] object-contain bg-white/5" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                      <div className="text-[9px] truncate px-1 py-0.5" style={{ color: BLOCK_COLOR[b.type] ?? '#9CA3AF' }}>{b.type}</div>
                    </button>
                  ))}
                </div>
              </div>

              {bundle.exercises.length > 0 && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                <div className="flex items-center justify-between"><div className="text-xs font-semibold text-red-200">Exercise Inspector · {bundle.exercises.length} detected</div><div className="flex gap-1"><button onClick={() => setExerciseView(exerciseView === 'json' ? 'none' : 'json')} className="px-2 py-1 rounded border border-white/10 text-[11px]">JSON</button><button onClick={() => setExerciseView(exerciseView === 'difference' ? 'none' : 'difference')} className="px-2 py-1 rounded border border-white/10 text-[11px]">Difference</button></div></div>
                {exerciseView === 'json' && <pre className="mt-2 max-h-48 overflow-auto text-[10px] whitespace-pre-wrap">{JSON.stringify(bundle.exercises, null, 2)}</pre>}
                {exerciseView === 'difference' && <div className="mt-2 text-[11px] text-[#A8A29E]">Ground truth is not supplied for this run. Load a ground-truth JSON beside the PDF to compare exercise numbering, questions, answers, images, audio, and solution references.</div>}
              </div>}
              {(() => {
                const hit = currentPage?.blocks.find(b => b.block_id === selectedBlock) ?? null
                if (!hit) return null
                return (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2 text-xs">
                    <div className="font-semibold text-[#FAF8F5] flex items-center gap-2">{hit.block_id} <span className="px-1.5 py-0.5 rounded text-[10px] border" style={{ borderColor: BLOCK_COLOR[hit.type] ?? '#6B7280', color: BLOCK_COLOR[hit.type] ?? '#6B7280' }}>{hit.type}</span><span className="text-[10px] font-normal text-[#6B7280]">conf {(hit.confidence ?? 0).toFixed(2)} - {hit.source ?? config.expectedProvider}</span></div>
                    <div className="font-mono text-[11px] text-[#9CA3AF]">bbox: [{hit.bbox.map(v => v.toFixed(1)).join(', ')}] - page {hit.page} - processing {bundle.telemetry.find(t => t.node === hit.source)?.duration_ms ?? 'n/a'}ms</div>
                    <div className="bg-black/30 rounded p-2 text-[#FAF8F5] whitespace-pre-wrap break-words min-h-[28px]">{String(hit.text ?? (hit.meta as Record<string, unknown>)?.['text'] ?? '-')}</div>
                  </div>
                )
              })()}
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-[#0B1220] p-3">
                <div className="text-xs font-semibold mb-2">Telemetry - {bundle.telemetry.length} nodes - {elapsed ?? bundle.wall_time_ms ?? '-'} ms</div>
                <div className="space-y-1 max-h-[160px] overflow-auto pr-1">
                  {bundle.telemetry.length ? bundle.telemetry.map((t, i) => (
                    <div key={i} className={`flex justify-between text-xs rounded px-2 py-1 ${t.status === 'ok' ? 'bg-white/[0.03]' : 'bg-red-500/10'}`}><span>{t.node}</span><span className={t.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>{t.status} - {t.duration_ms}ms</span></div>
                  )) : <div className="text-[11px] text-[#6B7280]">No telemetry - stateless run may not emit nodes (check bundle.quality)</div>}
                </div>
                <div className="mt-2 text-[11px] text-[#6B7280]">Providers: {Object.entries(bundle.providers_used).map(([k, v]) => `${k}:${v}`).join(' | ') || '-'} - LLM calls: {bundle.llm_calls ?? 0}</div>
                <div className="text-[11px] text-[#6B7280]">Quality: {(bundle.quality as Record<string, unknown>)['blocks_detected'] != null ? `${String((bundle.quality as Record<string, unknown>)['blocks_detected'])} blocks` : JSON.stringify(bundle.quality).slice(0, 180)}</div>
              </div>
              <pre className="text-[11px] leading-4 whitespace-pre-wrap break-words bg-[#0B1220] border border-white/5 rounded-lg p-3 overflow-auto max-h-[52vh]">{JSON.stringify(bundle, null, 2).slice(0, 12000)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
