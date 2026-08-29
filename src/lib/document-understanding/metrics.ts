/** Evaluation metrics — mirrors Python atomic.compute_evaluation. */

import type { AtomicElement, EvaluationMetrics } from './types'
import { bboxArea, bboxIou } from './types'

export function computeMetrics(elements: AtomicElement[], pageW: number, pageH: number): EvaluationMetrics {
  const total = elements.length
  if (!total) {
    return { totalElements: 0, oversizedRegions: 0, oversizedRegionRate: 0, duplicateRate: 0, avgBboxAreaRatio: 0, atomicCoverage: 0, backgroundCount: 0, designCount: 0, elementPrecision: 0, elementRecall: 0, bboxIou: 0, classificationAccuracy: 0, readingOrderAccuracy: 0 }
  }
  const pageArea = pageW * pageH
  let oversized = 0
  for (const r of elements) {
    const ratio = bboxArea(r.bbox) / pageArea
    const textLen = (r.text ?? '').trim().length
    const lineEst = r.text ? r.text.split('\n').length : 1
    const hRatio = (r.bbox[3]-r.bbox[1])/pageH
    if (ratio > 0.12 && hRatio > 0.18 && lineEst >= 3 && ['paragraph','text','unknown'].includes(r.type)) oversized++
    else if (ratio > 0.22 && textLen > 40 && ['paragraph','text','unknown'].includes(r.type)) oversized++
    else if ((r.meta as Record<string,unknown>)?.['atomic_level'] === 'block' && ratio > 0.15 && lineEst >= 3) oversized++
  }
  const bg = elements.filter((r)=> r.type==='background').length
  const design = elements.filter((r)=> r.type==='design_element').length
  const avgArea = elements.reduce((sum, r)=> sum + bboxArea(r.bbox)/pageArea, 0)/total
  let dupPairs = 0
  for (let i=0;i<total;i++) for(let j=i+1;j<total;j++) if (bboxIou(elements[i].bbox, elements[j].bbox) > 0.6) dupPairs++
  const atomicLines = elements.filter((r)=> String((r.meta as Record<string,unknown>)?.['atomic_level'] ?? '').startsWith('line')).length
  return {
    totalElements: total,
    oversizedRegions: oversized,
    oversizedRegionRate: total ? oversized/total : 0,
    duplicateRate: dupPairs / Math.max(1, total),
    avgBboxAreaRatio: avgArea,
    atomicCoverage: atomicLines / Math.max(1, total),
    backgroundCount: bg,
    designCount: design,
    elementPrecision: 0,
    elementRecall: 0,
    bboxIou: 0,
    classificationAccuracy: 0,
    readingOrderAccuracy: 0,
  }
}

export function aggregateMetrics(perPage: EvaluationMetrics[]): EvaluationMetrics {
  if (!perPage.length) return computeMetrics([], 1, 1)
  const total = perPage.reduce((s,m)=> s+m.totalElements, 0)
  const oversized = perPage.reduce((s,m)=> s+m.oversizedRegions, 0)
  return {
    totalElements: total,
    oversizedRegions: oversized,
    oversizedRegionRate: total ? oversized/total : 0,
    duplicateRate: perPage.reduce((s,m)=> s+m.duplicateRate,0)/perPage.length,
    avgBboxAreaRatio: perPage.reduce((s,m)=> s+m.avgBboxAreaRatio,0)/perPage.length,
    atomicCoverage: perPage.reduce((s,m)=> s+m.atomicCoverage,0)/perPage.length,
    backgroundCount: perPage.reduce((s,m)=> s+m.backgroundCount,0),
    designCount: perPage.reduce((s,m)=> s+m.designCount,0),
    elementPrecision: 0, elementRecall: 0, bboxIou: 0, classificationAccuracy: 0, readingOrderAccuracy: 0,
  }
}
