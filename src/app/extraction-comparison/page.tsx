'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EXTRACTION_ENGINES,
  type BenchmarkMetrics,
  type BenchmarkResult,
  type ExtractionEngine,
} from '@/lib/benchmark/types'

const ENGINE_LABELS: Record<ExtractionEngine, string> = {
  LLM_VISION: 'LLM + Vision',
  DOCLING: 'Docling',
  PYMUPDF: 'PyMuPDF',
  SURYA: 'Surya',
  PP_STRUCTURE: 'PP-Structure',
  GOOGLE_DOC_AI: 'Google Document AI',
}

const ENGINE_PORTS: Record<ExtractionEngine, string> = {
  LLM_VISION: ':8001',
  DOCLING: ':8002',
  PYMUPDF: ':8003',
  SURYA: ':8004',
  PP_STRUCTURE: ':8005',
  GOOGLE_DOC_AI: ':8006',
}

type MetricKey = keyof BenchmarkMetrics

interface MetricDefinition {
  key: MetricKey
  label: string
  direction: 1 | -1
  format: (value: number | null | undefined) => string
}

const METRICS: MetricDefinition[] = [
  { key: 'durationMs', label: 'Duration', direction: 1, format: (value) => (value == null ? 'N/A' : `${(value / 1000).toFixed(2)}s`) },
  { key: 'ocrCoverage', label: 'OCR coverage', direction: -1, format: (value) => (value == null ? 'N/A' : `${(value * 100).toFixed(1)}%`) },
  { key: 'textLength', label: 'Text length', direction: -1, format: (value) => (value == null ? 'N/A' : value.toLocaleString()) },
  { key: 'blockCount', label: 'Blocks', direction: -1, format: (value) => (value == null ? 'N/A' : String(value)) },
  { key: 'avgConfidence', label: 'Avg confidence', direction: -1, format: (value) => (value == null ? 'N/A' : `${(value * 100).toFixed(1)}%`) },
  { key: 'tablesFound', label: 'Tables', direction: -1, format: (value) => (value == null ? 'N/A' : String(value)) },
  { key: 'imagesFound', label: 'Images', direction: -1, format: (value) => (value == null ? 'N/A' : String(value)) },
  { key: 'exerciseRegions', label: 'Exercise regions', direction: -1, format: (value) => (value == null ? 'N/A' : String(value)) },
  { key: 'readingOrderScore', label: 'Reading order', direction: -1, format: (value) => (value == null ? 'N/A' : `${(value * 100).toFixed(1)}%`) },
  { key: 'estimatedCost', label: 'Est. cost', direction: 1, format: (value) => (value == null ? 'N/A' : `$${value.toFixed(3)}`) },
]

interface BenchmarkHeader {
  originalFileName: string
  fileSize: number
}

export default function ExtractionComparisonPage() {
  const [results, setResults] = useState<Partial<Record<ExtractionEngine, BenchmarkResult>>>({})
  const [header, setHeader] = useState<BenchmarkHeader | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ExtractionEngine>('PYMUPDF')
  const [display, setDisplay] = useState<'normalized' | 'raw'>('normalized')
  const [sortKey, setSortKey] = useState<MetricKey>('durationMs')
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  useEffect(() => () => { void readerRef.current?.cancel() }, [])

  const sortedEngines = useMemo(() => {
    const direction = METRICS.find((metric) => metric.key === sortKey)?.direction ?? 1
    const resolve = (value: number | null | undefined): number => {
      if (value == null) return direction === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
      return value
    }
    return [...EXTRACTION_ENGINES].sort(
      (a, b) => (resolve(results[a]?.metrics?.[sortKey]) - resolve(results[b]?.metrics?.[sortKey])) * direction,
    )
  }, [results, sortKey])

  function handleFrame(frame: string): void {
    const lines = frame.split('\n')
    const eventLine = lines.find((line) => line.startsWith('event: '))
    const dataLine = lines.find((line) => line.startsWith('data: '))
    if (!dataLine) return
    const payload = JSON.parse(dataLine.slice(6)) as unknown
    const event = eventLine ? eventLine.slice(7).trim() : 'message'

    if (event === 'meta') {
      const meta = payload as BenchmarkHeader
      setHeader({ originalFileName: meta.originalFileName, fileSize: meta.fileSize })
    } else if (event === 'result') {
      const result = payload as BenchmarkResult
      setResults((previous) => ({ ...previous, [result.engine]: result }))
    } else if (event === 'error') {
      setError((payload as { error?: string }).error ?? 'Benchmark failed')
    }
  }

  async function runBenchmark(file: File): Promise<void> {
    setBusy(true)
    setError('')
    setResults({})
    setHeader(null)

    const body = new FormData()
    body.append('file', file)

    try {
      const response = await fetch('/api/extraction-benchmark', { method: 'POST', body })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? `Benchmark failed (HTTP ${response.status})`)
        return
      }
      if (!response.body) {
        setError('Benchmark stream unavailable')
        return
      }

      const reader = response.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) handleFrame(frame)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benchmark failed')
    } finally {
      setBusy(false)
    }
  }

  const statusOf = (engine: ExtractionEngine): BenchmarkResult['status'] =>
    results[engine]?.status ?? (busy ? 'running' : 'pending')

  const selectedResult = results[selected]

  return (
    <main className="min-h-full p-8 md:p-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1F7A4C]">Evaluation workspace</p>
          <h1 className="mt-2 text-4xl">Extraction comparison</h1>
          <p className="mt-3 max-w-2xl text-[#6B7280]">
            Upload one PDF and benchmark all six extraction engines in parallel. Results stay isolated from
            production learning data.
          </p>
        </header>

        <section className="card p-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D1D5DB] p-10 text-center hover:border-[#1F7A4C]">
            <span className="font-semibold">{busy ? 'Running benchmark…' : 'Choose a PDF to benchmark'}</span>
            <span className="mt-2 text-sm text-[#6B7280]">The same upload is sent server-side to every provider.</span>
            <input
              className="sr-only"
              type="file"
              accept="application/pdf"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void runBenchmark(file)
              }}
            />
          </label>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </section>

        {header && (
          <section className="card p-6">
            <h2 className="text-xl">{header.originalFileName}</h2>
            <p className="text-sm text-[#6B7280]">{(header.fileSize / 1024 / 1024).toFixed(2)} MB</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {EXTRACTION_ENGINES.map((engine) => {
                const result = results[engine]
                const status = statusOf(engine)
                return (
                  <button
                    key={engine}
                    type="button"
                    onClick={() => setSelected(engine)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected === engine
                        ? 'border-[#1F7A4C] bg-[#F0FDF4]'
                        : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{ENGINE_LABELS[engine]}</span>
                      <span className="text-xs text-[#9CA3AF]">{ENGINE_PORTS[engine]}</span>
                    </div>
                    <div className="mt-2 text-sm">
                      {status === 'completed' && (
                        <span className="text-[#1F7A4C]">
                          Completed · {((result?.durationMs ?? 0) / 1000).toFixed(2)}s
                        </span>
                      )}
                      {status === 'failed' && <span className="text-red-600">Failed</span>}
                      {status === 'running' && <span className="text-[#6B7280]">Running…</span>}
                      {status === 'pending' && <span className="text-[#9CA3AF]">Queued</span>}
                      {status === 'failed' && result?.error && (
                        <p className="mt-1 text-xs text-[#6B7280]">{result.error}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {busy && (
          <p className="text-sm text-[#6B7280]">Benchmarking all six engines concurrently…</p>
        )}

        {Object.keys(results).length > 0 && (
          <>
            <section className="card overflow-x-auto p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl">Metrics</h2>
                <select
                  className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as MetricKey)}
                >
                  {METRICS.map((metric) => (
                    <option key={metric.key} value={metric.key}>{metric.label}</option>
                  ))}
                </select>
              </div>
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="p-3">Metric</th>
                    {sortedEngines.map((engine) => (
                      <th key={engine} className="p-3">{ENGINE_LABELS[engine]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((metric) => (
                    <tr key={metric.key} className="border-b border-[#F3F4F6]">
                      <th className="p-3 font-medium">{metric.label}</th>
                      {sortedEngines.map((engine) => {
                        const result = results[engine]
                        return (
                          <td key={engine} className="p-3">
                            {result?.status === 'failed'
                              ? <span className="text-red-600">Failed</span>
                              : metric.format(result?.metrics?.[metric.key])}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {EXTRACTION_ENGINES.map((engine) => (
                    <button
                      key={engine}
                      type="button"
                      onClick={() => setSelected(engine)}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        selected === engine ? 'bg-[#1F7A4C] text-white' : 'bg-[#F3F4F6]'
                      }`}
                    >
                      {ENGINE_LABELS[engine]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 rounded-lg bg-[#F3F4F6] p-1">
                  <button
                    type="button"
                    onClick={() => setDisplay('normalized')}
                    className={`rounded-md px-3 py-1.5 text-sm ${display === 'normalized' ? 'bg-white font-semibold' : ''}`}
                  >
                    Normalized
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplay('raw')}
                    className={`rounded-md px-3 py-1.5 text-sm ${display === 'raw' ? 'bg-white font-semibold' : ''}`}
                  >
                    Raw
                  </button>
                </div>
              </div>
              <pre className="mt-5 max-h-[420px] overflow-auto rounded-xl bg-[#111827] p-5 text-xs text-green-200">
                {JSON.stringify(
                  display === 'raw'
                    ? (selectedResult?.rawOutput ?? { error: selectedResult?.error ?? 'No output' })
                    : (selectedResult?.normalizedOutput ?? { error: selectedResult?.error ?? 'No output' }),
                  null,
                  2,
                )}
              </pre>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
