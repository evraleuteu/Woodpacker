import { computeMetrics, evaluateAgainstGroundTruth } from '../metrics'
import type { AtomicElement, BBox } from '../types'

function testMetrics() {
  // Simulate cover: 3 raw blocks -> 7 atomic, 1 background
  const atoms: AtomicElement[] = [
    { id:'a1', type:'heading', bbox:[120,120,250,170] as BBox, confidence:0.95, source:'pdf', detectors:['pdf'], page:1, isAtomic:true, text:'Kontext' },
    { id:'a2', type:'subtitle', bbox:[120,180,380,205] as BBox, confidence:0.88, source:'pdf', detectors:['pdf'], page:1, isAtomic:true, text:'Deutsch als Fremdsprache' },
    { id:'a3', type:'text', bbox:[120,215,400,235] as BBox, confidence:0.82, source:'pdf', detectors:['pdf'], page:1, isAtomic:true, text:'Kursbuch mit Audios und Videos' },
    { id:'a4', type:'level_badge', bbox:[480,60,520,90] as BBox, confidence:0.92, source:'hybrid', detectors:['layout','visual'], page:1, isAtomic:true, text:'B2' },
    { id:'a5', type:'design_element', bbox:[460,40,540,110] as BBox, confidence:0.85, source:'layout', detectors:['layout'], page:1, isAtomic:true },
    { id:'a6', type:'qr_code', bbox:[420,650,520,750] as BBox, confidence:0.9, source:'layout', detectors:['visual'], page:1, isAtomic:true },
    { id:'a7', type:'photo', bbox:[120,300,480,550] as BBox, confidence:0.91, source:'pdf', detectors:['pdf'], page:1, isAtomic:true },
    { id:'bg', type:'background', bbox:[0,0,595,842] as BBox, confidence:0.75, source:'hybrid', detectors:['background-detector'], page:1, isAtomic:true },
  ]
  const metrics = computeMetrics(atoms, 3, 595, 842, 0)
  console.log('metrics cover:', metrics)
  if (metrics.oversizedRegionRate > 0.05) throw new Error(`oversized rate should be low, got ${metrics.oversizedRegionRate}`)
  if (metrics.backgroundCount !== 1) throw new Error(`backgroundCount should be 1, got ${metrics.backgroundCount}`)
  if (metrics.elementCount !== 8) throw new Error(`count 8, got ${metrics.elementCount}`)
  console.log('✅ metrics cover passed')

  // Duplicate rate: raw 3 -> atomic 8 should not be negative? Actually duplicate rate formula uses raw vs atomic
  // raw 3 -> atomic 8 -> duplicateRate negative? Our code clamps to 0? Check
  if (metrics.duplicateRate !== 0) console.warn(`duplicateRate ${metrics.duplicateRate} (expected 0 since atomic > raw)`)

  // IoU evaluation
  const pred: BBox[] = [[0,0,100,100],[200,200,300,300]]
  const gt: BBox[] = [[5,5,95,95],[205,205,295,295]]
  const evalRes = evaluateAgainstGroundTruth(pred, gt, 0.5)
  if (evalRes.precision < 0.9) throw new Error(`precision low ${evalRes.precision}`)
  if (evalRes.recall < 0.9) throw new Error(`recall low`)
  console.log('✅ IoU eval passed', evalRes)

  // Oversized detection: create one giant text region covering 60% page with little text -> should be flagged
  const giant: AtomicElement = { id:'giant', type:'text', bbox:[36,36,559,500] as BBox, confidence:0.7, source:'layout', detectors:['layout'], page:1, isAtomic:true, text:'Kontext\nDeutsch als Fremdsprache\nKursbuch mit Audios' }
  const m2 = computeMetrics([giant], 1, 595, 842, 0)
  if (m2.oversizedRegionRate !== 1) throw new Error(`giant should be 100% oversized, got ${m2.oversizedRegionRate}`)
  console.log('✅ oversized detection passed')
}

try {
  testMetrics()
  console.log('\nAll evaluation tests passed.')
} catch (e) {
  console.error('❌ evaluation failed:', e)
  process.exit(1)
}
