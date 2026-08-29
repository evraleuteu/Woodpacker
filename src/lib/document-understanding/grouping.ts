/** Semantic grouping — exercise/column groups preserving atomicElements. */

import type { AtomicElement, SemanticGroup, BBox } from './types'

function unionBbox(boxes: BBox[]): BBox {
  if (!boxes.length) return [0,0,0,0]
  return [Math.min(...boxes.map((b)=>b[0])), Math.min(...boxes.map((b)=>b[1])), Math.max(...boxes.map((b)=>b[2])), Math.max(...boxes.map((b)=>b[3]))]
}

export function buildSemanticGroups(
  atomic: AtomicElement[],
  readingOrder: string[],
  opts?: { fileId?: string }
): SemanticGroup[] {
  const byId = new Map(atomic.map((a)=>[a.id, a]))
  const groups: SemanticGroup[] = []

  // Instruction-anchored exercise groups: scan reading order, instruction/question/image/answer clusters
  let current: { head?: string; members: string[]; bbox: BBox[] } | null = null
  const flush = () => {
    if (!current || current.members.length === 0) { current = null; return }
    const bbox = unionBbox(current.bbox)
    const mid = current.members[0]
    const exId = `${opts?.fileId ?? 'doc'}_ex_${groups.length+1}`
    groups.push({ id: exId, type: 'exercise', memberIds: [...current.members], bbox, confidence: 0.75, label: byId.get(mid)?.text?.slice(0,40) ?? `Exercise ${groups.length+1}` })
    current = null
  }
  for (const id of readingOrder) {
    const el = byId.get(id)
    if (!el || el.type === 'background') continue
    if (el.type === 'instruction' || el.type === 'exercise' || (/^aufgabe|übung|exercise/i.test(el.text ?? ''))) {
      flush()
      current = { head: id, members: [id], bbox: [el.bbox] }
    } else if (current && ['question','answer','image','photo','illustration','qr_code','audio_marker','video_marker','table'].includes(el.type)) {
      current.members.push(id); current.bbox.push(el.bbox)
    } else if (!current && el.type === 'question') {
      current = { members: [id], bbox: [el.bbox] }
    } else {
      // gap of non-exercise types
      if (current && !['paragraph','heading','subtitle','caption','header','footer'].includes(el.type)) {
        // keep
      } else if (current && ['paragraph','heading'].includes(el.type) && current.members.length >= 2) {
        // close on encountering new heading
        flush()
      }
    }
  }
  flush()

  // Column groups per page for inspector
  const byPage = new Map<number, AtomicElement[]>()
  for (const el of atomic) {
    if (!byPage.has(el.page)) byPage.set(el.page, [])
    byPage.get(el.page)!.push(el)
  }
  for (const [page, elems] of byPage) {
    const colClusters = clusterColumns(elems)
    colClusters.forEach((col, i) => {
      if (col.length < 2) return
      const boxes = col.map((id)=> byId.get(id)?.bbox).filter(Boolean) as BBox[]
      if (!boxes.length) return
      groups.push({ id: `page_${String(page).padStart(3,'0')}_col_${i}`, type: 'column', memberIds: col, bbox: unionBbox(boxes), confidence: 0.7, label: `Column ${i+1}` })
    })
  }
  return groups
}

function clusterColumns(elems: AtomicElement[]): string[][] {
  if (elems.length < 4) return [elems.map((e)=>e.id)]
  const centers = elems.map((e)=> ({ cx: (e.bbox[0]+e.bbox[2])/2, id: e.id })).sort((a,b)=>a.cx-b.cx)
  const vals = centers.map((c)=>c.cx)
  const occ = Math.max(vals[vals.length-1]-vals[0], 1)
  let bestGap = 0, bestIdx = -1
  for (let i=1;i<vals.length;i++){ const g = vals[i]-vals[i-1]; if(g>bestGap){bestGap=g; bestIdx=i}}
  // need page width approx
  const pageW = Math.max(...elems.map((e)=>e.bbox[2]))
  if (bestIdx<0 || bestGap < pageW*0.06 || bestGap < occ*0.25) return [elems.map((e)=>e.id)]
  const splitX = (vals[bestIdx-1]+vals[bestIdx])/2
  const left = centers.filter((c)=>c.cx < splitX).map((c)=>c.id)
  const right = centers.filter((c)=>c.cx >= splitX).map((c)=>c.id)
  if (left.length<2||right.length<2) return [elems.map((e)=>e.id)]
  return [left,right]
}
