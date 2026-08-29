'use client'

import { useEffect, useState } from 'react'

type ExerciseResult = Record<string, unknown>

export default function ExerciseInspectorPage() {
  const [file, setFile] = useState<File | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [result, setResult] = useState<ExerciseResult[] | null>(null)
  const [groundTruth, setGroundTruth] = useState<ExerciseResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  const analyze = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setPdfUrl(URL.createObjectURL(file))
    try {
      const form = new FormData()
      form.append('file', file, file.name)
      const response = await fetch('/api/extract/atomic?debug=true', { method: 'POST', body: form })
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
      const payload = await response.json() as { exercises?: ExerciseResult[] }
      setResult(payload.exercises ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }

  const loadGroundTruth = async (selected: File | null) => {
    if (!selected) return
    try {
      setGroundTruth(JSON.parse(await selected.text()) as ExerciseResult[])
    } catch {
      setError('Ground truth must be a JSON array of exercises.')
    }
  }

  return (
    <main className="min-h-screen bg-[#060A14] text-[#FAF8F5] p-4 md:p-6">
      <div className="max-w-[1700px] mx-auto">
        <h1 className="text-xl font-bold">Exercise Inspector</h1>
        <p className="text-xs text-[#6B7280] mt-1">Validate numbering, types, questions, answer areas, media, and solution references.</p>
        <div className="mt-4 flex flex-wrap gap-2 items-center rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <input type="file" accept=".pdf" onChange={event => setFile(event.target.files?.[0] ?? null)} className="text-sm" />
          <button onClick={analyze} disabled={!file || loading} className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black text-sm disabled:opacity-40">{loading ? 'Analyzing...' : 'Analyze exercises'}</button>
          <label className="text-xs text-[#9CA3AF]">Ground truth JSON <input type="file" accept=".json" onChange={event => void loadGroundTruth(event.target.files?.[0] ?? null)} className="ml-2 text-xs" /></label>
        </div>
        {error && <div className="mt-3 p-2 rounded border border-red-500/30 bg-red-500/10 text-xs text-red-200">{error}</div>}
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
          <div className="rounded-xl border border-white/10 bg-[#0B1220] p-3 min-h-[70vh]">
            <div className="text-xs font-semibold mb-2">PDF · exercise regions</div>
            {pdfUrl ? <iframe src={pdfUrl} title="Exercise source PDF" className="w-full h-[65vh] rounded bg-white" /> : <div className="h-[65vh] flex items-center justify-center text-sm text-[#6B7280]">Upload a PDF to begin.</div>}
          </div>
          <div className="space-y-3">
            <section className="rounded-xl border border-white/10 bg-[#0B1220] p-3">
              <div className="text-xs font-semibold mb-2">Extracted Exercise JSON · {result?.length ?? 0}</div>
              <pre className="max-h-[32vh] overflow-auto text-[10px] whitespace-pre-wrap">{result ? JSON.stringify(result, null, 2) : 'No extraction yet.'}</pre>
            </section>
            <section className="rounded-xl border border-white/10 bg-[#0B1220] p-3">
              <div className="text-xs font-semibold mb-2">Difference View</div>
              {groundTruth ? <div className="text-xs text-[#A8A29E]">Ground truth: {groundTruth.length} exercises · extracted: {result?.length ?? 0}. Review the JSON above for field-level differences.</div> : <div className="text-xs text-[#6B7280]">Load a ground-truth JSON file to compare extracted results.</div>}
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
