/** Reading order — geometric, column-aware, structural. */

import type { AtomicElement } from './types'

const Y_TOL = 0.6

export function orderPageElements(elements: AtomicElement[], pageW: number): AtomicElement[] {
  const bg = elements.filter((b) => b.type === 'background' || (b.meta as Record<string, unknown>)?.['subtype'] === 'background')
  const content = elements.filter((b) => b.type !== 'background' && (b.meta as Record<string, unknown>)?.['subtype'] !== 'background')
  if (content.length <= 1) return [...bg, ...content]

  const columns = splitColumns(content, pageW)
  const ordered: AtomicElement[] = []
  for (const col of columns) {
    if (!col.length) continue
    const headers = col.filter((b) => b.type === 'header' || b.type === 'page_number')
    const footers = col.filter((b) => b.type === 'footer')
    const body = col.filter((b) => !['header','footer','page_number'].includes(b.type))
    const bodyOrdered: AtomicElement[] = []
    if (body.length) {
      const tol = Math.max(...body.map((b) => b.bbox[3] - b.bbox[1])) * Y_TOL + 1
      let remaining = [...body].sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0])
      while (remaining.length) {
        const anchor = remaining.shift()!
        const line = [anchor]
        const mid = (anchor.bbox[1] + anchor.bbox[3]) / 2
        const keep: AtomicElement[] = []
        for (const cand of remaining) {
          const cmid = (cand.bbox[1] + cand.bbox[3]) / 2
          if (Math.abs(cmid - mid) <= tol) line.push(cand)
          else keep.push(cand)
        }
        line.sort((a, b) => a.bbox[0] - b.bbox[0])
        bodyOrdered.push(...line)
        remaining = keep
      }
    }
    ordered.push(...headers.sort((a,b)=>a.bbox[1]-b.bbox[1]), ...bodyOrdered, ...footers.sort((a,b)=>a.bbox[1]-b.bbox[1]))
  }
  // caption after image heuristic
  const captions = ordered.filter((b) => b.type === 'caption')
  if (captions.length) {
    const nonCap = ordered.filter((b) => b.type !== 'caption')
    const reordered: AtomicElement[] = []
    for (const b of nonCap) {
      reordered.push(b)
      if (['image','table','photo','illustration'].includes(b.type)) {
        const pulled = captions.filter((cap) => {
          if (reordered.includes(cap)) return false
          const horiz = Math.min(b.bbox[2], cap.bbox[2]) - Math.max(b.bbox[0], cap.bbox[0])
          const below = cap.bbox[1] - b.bbox[3]
          return horiz > 10 && below > 0 && below < 180
        })
        for (const p of pulled) { const idx = captions.indexOf(p); if (idx>=0) captions.splice(idx,1); reordered.push(p) }
      }
    }
    reordered.push(...captions)
    return [...bg, ...reordered]
  }
  return [...bg, ...ordered]
}

function splitColumns(blocks: AtomicElement[], pageW: number): AtomicElement[][] {
  const centers = blocks.map((b) => (b.bbox[0] + b.bbox[2]) / 2).sort((a,b)=>a-b)
  const occ = Math.max(centers[centers.length-1] - centers[0], 1)
  const widthRef = Math.max(pageW, occ)
  let bestGap = 0, bestIdx = -1
  for (let i=1;i<centers.length;i++){ const g = centers[i]-centers[i-1]; if(g>bestGap){bestGap=g; bestIdx=i}}
  const gutterOk = bestGap >= widthRef*0.06 && bestGap >= occ*0.25
  if (bestIdx<0 || !gutterOk || centers.length<4) return [blocks]
  const splitX = (centers[bestIdx-1]+centers[bestIdx])/2
  const left = blocks.filter((b)=>(b.bbox[0]+b.bbox[2])/2 < splitX)
  const right = blocks.filter((b)=>(b.bbox[0]+b.bbox[2])/2 >= splitX)
  if (!left.length || !right.length || left.length<2 || right.length<2) return [blocks]
  return [left, right]
}

export function assignGlobalReadingOrder(pages: Map<number, AtomicElement[]>): string[] {
  const sortedPages = [...pages.entries()].sort((a,b)=>a[0]-b[0])
  const all: string[] = []
  let counter = 1
  for (const [, elems] of sortedPages) {
    for (const el of elems) { el.readingOrder = counter++; all.push(el.id) }
  }
  return all
}
