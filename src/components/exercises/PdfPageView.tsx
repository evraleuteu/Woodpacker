'use client'

import { useEffect, useRef, useState } from 'react'

interface TextSpan {
  str: string
  transform: number[]
  width: number
  height: number
}

interface HighlightQuery {
  name?: string
  prompt?: string
}

interface PdfPageViewProps {
  url: string
  page: number
  zoom: number
  highlight?: HighlightQuery | null
  onPageChange?: (page: number) => void
  onPagesReady?: (count: number | null) => void
}

interface PdfPageLike {
  getViewport(opts: unknown): {
    width: number
    height: number
    transform: number[]
    convertToViewportRectangle?: (rect: number[]) => number[]
    convertToViewportPoint?: (x: number, y: number) => number[]
  }
  render(opts: unknown): { promise: Promise<void> }
  getTextContent(): Promise<unknown>
}

interface PdfDocLike {
  numPages: number
  getPage(num: number): Promise<PdfPageLike>
}

interface PdfTaskLike {
  promise: Promise<PdfDocLike>
  destroy(): Promise<void>
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function findSpans(items: TextSpan[], query: string): TextSpan[] {
  const q = normalize(query)
  if (!q) return []
  // Prefer the most specific match: first try exact substring inside a single
  // item (e.g. heading "Kapitel 4"), then multi-span window. The previous
  // direct filter returned *all* items containing the query which for short
  // queries like "Übung 3" could be many disjoint places – we now limit to
  // the densest cluster to avoid a whole-page box.
  const singles = items
    .map((it, idx) => ({ it, idx, n: normalize(it.str) }))
    .filter(({ n }) => n.length > 1 && (n.includes(q) || (q.length >= 8 && q.includes(n))))
  if (singles.length) {
    // If singles are scattered across the page, keep only the first contiguous
    // cluster (same line y) to avoid highlighting footers/headers far away.
    // Group by transform y with 3px tolerance and keep the densest group.
    const byY = new Map<string, typeof singles>()
    for (const s of singles) {
      // Use rounded y as bucket key.
      const y = Math.round(s.it.transform[5] / 3) * 3
      const key = String(y)
      const arr = byY.get(key) ?? []
      arr.push(s)
      byY.set(key, arr)
    }
    // Pick the bucket with most hits, or first if tie.
    let best: typeof singles = singles.slice(0, 3)
    let bestSize = 0
    for (const arr of byY.values()) {
      if (arr.length > bestSize) {
        bestSize = arr.length
        best = arr
      }
    }
    // If still large (e.g. query is a single common word), cap.
    if (best.length > 12) best = best.slice(0, 12)
    return best.map(({ it }) => it)
  }
  // Multi-span window: sliding window up to 12 items, find shortest window
  // that contains the query. Keeps boxes tight to the actual phrase.
  let bestWindow: TextSpan[] | null = null
  let bestLen = Infinity
  for (let i = 0; i < items.length; i++) {
    let acc = ''
    for (let j = i; j < Math.min(items.length, i + 14); j++) {
      acc = (j > i ? `${acc} ` : '') + items[j].str
      const n = normalize(acc)
      if (n.includes(q)) {
        const winLen = j - i + 1
        if (winLen < bestLen) {
          bestLen = winLen
          bestWindow = items.slice(i, j + 1)
        }
        break
      }
      if (n.length > q.length * 2.2) break
    }
  }
  return bestWindow ?? []
}

function spanBox(
  span: TextSpan,
  viewport: { width: number; height: number; transform: number[]; convertToViewportRectangle?: (rect: number[]) => number[]; convertToViewportPoint?: (x: number, y: number) => number[] }
): { x: number; y: number; w: number; h: number } | null {
  const tx = span.transform[4]
  const ty = span.transform[5]
  const w = span.width
  let h = span.height
  // pdf.js often reports height as 0 for spaces; fall back to font size estimate.
  if (!h || h <= 0.5) {
    const fontH = Math.hypot(span.transform[0] ?? 0, span.transform[1] ?? 0)
    h = fontH > 0 ? fontH : 10
  }
  // PDF y origin is bottom-left; baseline is ty. Ascender ~0.8*h, descender ~0.2*h.
  const yBottom = ty - h * 0.22
  const yTop = ty + h * 0.78
  const x0 = tx
  const x1 = tx + w
  // Use viewport's helper when available — it correctly handles scale + y-flip.
  try {
    const vp = viewport as unknown as { convertToViewportRectangle?: (r: number[]) => number[] }
    if (typeof vp.convertToViewportRectangle === 'function') {
      const rect = vp.convertToViewportRectangle([x0, yBottom, x1, yTop])
      const rx0 = Math.min(rect[0], rect[2])
      const ry0 = Math.min(rect[1], rect[3])
      const rx1 = Math.max(rect[0], rect[2])
      const ry1 = Math.max(rect[1], rect[3])
      const bw = rx1 - rx0
      const bh = ry1 - ry0
      if (bw < 1 || bh < 1 || bw > viewport.width * 1.2) return null
      // Clamp to viewport bounds so boxes never spill outside the page.
      const clampedX = Math.max(0, Math.min(rx0, viewport.width - 1))
      const clampedY = Math.max(0, Math.min(ry0, viewport.height - 1))
      const clampedW = Math.min(bw, viewport.width - clampedX)
      const clampedH = Math.min(bh, viewport.height - clampedY)
      if (clampedW < 1 || clampedH < 1) return null
      return { x: clampedX, y: clampedY, w: clampedW, h: clampedH }
    }
  } catch {
    // fall through to manual
  }
  // Manual fallback using the viewport transform matrix [a b c d e f].
  const [a, b, c, d, e, f] = viewport.transform
  const p0x = a * x0 + c * yBottom + e
  const p0y = b * x0 + d * yBottom + f
  const p1x = a * x1 + c * yTop + e
  const p1y = b * x1 + d * yTop + f
  const rx = Math.min(p0x, p1x)
  const ry = Math.min(p0y, p1y)
  const rw = Math.abs(p1x - p0x)
  const rh = Math.abs(p1y - p0y)
  if (rw < 1 || rh < 1 || rw > viewport.width * 1.2) return null
  return { x: rx, y: ry, w: rw, h: rh }
}

function mergeBoxes(boxes: { x: number; y: number; w: number; h: number }[]): { x: number; y: number; w: number; h: number }[] {
  if (!boxes.length) return []
  // Sort top-to-bottom, then left-to-right.
  const sorted = [...boxes].sort((p, q) => p.y - q.y || p.x - q.x)
  // First cluster boxes that belong to the same typographic line:
  // same y within 3.5px or vertical overlap > 45% are considered same line.
  const lines: { x: number; y: number; w: number; h: number }[][] = []
  for (const b of sorted) {
    let placed = false
    for (const line of lines) {
      const ref = line[0]
      const yDiff = Math.abs(b.y - ref.y)
      const overlap = Math.max(0, Math.min(b.y + b.h, ref.y + ref.h) - Math.max(b.y, ref.y))
      const overlapRatio = overlap / Math.min(b.h, ref.h || 1)
      if (yDiff < 3.5 || overlapRatio > 0.45) {
        line.push(b)
        placed = true
        break
      }
    }
    if (!placed) lines.push([b])
  }
  // Within each line, merge boxes whose horizontal gap is small (<38px ~ word gap).
  const merged: { x: number; y: number; w: number; h: number }[] = []
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x)
    let cur = { ...line[0] }
    for (let i = 1; i < line.length; i++) {
      const nxt = line[i]
      const gap = nxt.x - (cur.x + cur.w)
      // Keep narrow gaps merged, but leave large gaps (e.g. columns) as separate boxes.
      if (gap < 38 && Math.abs(nxt.y - cur.y) < 4) {
        const x0 = Math.min(cur.x, nxt.x)
        const y0 = Math.min(cur.y, nxt.y)
        const x1 = Math.max(cur.x + cur.w, nxt.x + nxt.w)
        const y1 = Math.max(cur.y + cur.h, nxt.y + nxt.h)
        cur = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
      } else {
        merged.push(cur)
        cur = { ...nxt }
      }
    }
    merged.push(cur)
  }
  // If the exercise spans only 1-2 lines, keep per-line boxes (more accurate
  // hover). If many lines were found but they are vertically contiguous with
  // tiny gaps (<6px), coalesce into one per-line group already handled above;
  // don't collapse the whole exercise into a single huge rectangle that
  // includes inter-line whitespace.
  return merged
}

export default function PdfPageView({ url, page, zoom, highlight, onPageChange, onPagesReady }: PdfPageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [doc, setDoc] = useState<PdfDocLike | null>(null)
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [errorUrl, setErrorUrl] = useState<string | null>(null)
  const [cssSize, setCssSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [containerW, setContainerW] = useState(0)
  const [overlay, setOverlay] = useState<{ x: number; y: number; w: number; h: number; label: string }[]>([])

  useEffect(() => {
    let cancelled = false
    let task: PdfTaskLike | null = null
    void (async () => {
      try {
        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
        GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const loadingTask = getDocument({ url })
        task = loadingTask
        const proxy = await loadingTask.promise
        if (cancelled) {
          void loadingTask.destroy()
          return
        }
        setDoc(proxy)
        setDocUrl(url)
        setErrorUrl(null)
        onPagesReady?.(proxy.numPages)
      } catch {
        if (!cancelled) setErrorUrl(url)
      }
    })()
    return () => {
      cancelled = true
      if (task) void task.destroy()
    }
  }, [url, onPagesReady])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setContainerW(Math.round(el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const status: 'loading' | 'ready' | 'error' =
    errorUrl === url ? 'error' : doc && docUrl === url ? 'ready' : 'loading'

  useEffect(() => {
    if (!doc || docUrl !== url) return
    let cancelled = false
    void (async () => {
      try {
        if (page < 1) {
          onPageChange?.(1)
          return
        }
        if (doc.numPages && page > doc.numPages) {
          onPageChange?.(doc.numPages)
          return
        }
        const pageObj = await doc.getPage(page)
        const base = pageObj.getViewport({ scale: 1 })
        const fit = Math.min(1, Math.max(0.25, (containerW - 2) / base.width))
        const viewport = pageObj.getViewport({ scale: fit * zoom })
        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, viewport.width, viewport.height)
        await pageObj.render({ canvasContext: ctx, canvas, viewport }).promise
        if (cancelled) return
        setCssSize({ w: viewport.width, h: viewport.height })

        const content = (await pageObj.getTextContent()) as { items?: { str?: string; transform?: number[]; width?: number; height?: number }[] }
        const items: TextSpan[] = (content.items ?? [])
          .map((it) => ({
            str: it.str ?? '',
            transform: it.transform ?? [0, 0, 0, 0, 0, 0],
            width: it.width ?? 0,
            height: it.height ?? 0,
          }))
          .filter((i) => i.str.length > 0)
        const query = (highlight?.name || highlight?.prompt?.slice(0, 80)) ?? ''
        const spans = query ? findSpans(items, query) : []
        const boxes = spans
          .map((s) => spanBox(s, viewport as unknown as { width: number; height: number; transform: number[]; convertToViewportRectangle?: (rect: number[]) => number[] }))
          .filter((b): b is { x: number; y: number; w: number; h: number } => !!b)
        setOverlay(mergeBoxes(boxes).map((b) => ({ ...b, label: highlight?.name ?? '' })))
      } catch {
        if (doc.numPages && page > doc.numPages) onPageChange?.(doc.numPages)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [doc, docUrl, url, page, zoom, highlight, containerW, onPageChange])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-[62vh]">
        <span className="text-xs text-[#6B7280]">Loading page {page}…</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center bg-[#0C0C0C] p-4">
        <iframe src={`${url}#page=${page}`} className="w-full h-[62vh] rounded-lg shadow-xl bg-white" title={`PDF - Page ${page}`} />
      </div>
    )
  }

  return (
    <div className="bg-[#0C0C0C] p-4 overflow-auto">
      <div ref={wrapRef} className="relative w-full">
        <div className="relative mx-auto" style={{ width: cssSize.w || undefined, height: cssSize.h || undefined }}>
          <canvas ref={canvasRef} className="rounded-lg shadow-xl bg-white block" />
          {overlay.map((b, i) => (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{
                left: b.x,
                top: b.y,
                width: b.w,
                height: b.h,
                background: 'rgba(16,185,129,0.22)',
                border: '1.5px solid rgba(16,185,129,0.75)',
                borderRadius: 3,
              }}
            >
              {b.label && (
                <span className="absolute -top-[18px] left-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#059669] text-white whitespace-nowrap">
                  {b.label}
                </span>
              )}
            </div>
          ))}
          <div className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white/80">
            Page {page} / {doc?.numPages ?? '—'}
          </div>
        </div>
      </div>
    </div>
  )
}