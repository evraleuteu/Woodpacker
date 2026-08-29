import { resolveOverlaps } from '../overlap'
import type { AtomicElement } from '../types'

function makeEl(id: string, bbox: [number,number,number,number], type: AtomicElement['type'], text?: string, conf=0.8): AtomicElement {
  return { id, type, bbox, text, confidence: conf, source: 'layout', detectors: ['layout'], page: 1, isAtomic: true }
}

function testOverlap() {
  // Duplicate text regions → should dedup via NMS
  const a = makeEl('a', [0,0,100,20] as any, 'text', 'Hello', 0.9)
  const b = makeEl('b', [0,0,100,20] as any, 'text', 'Hello', 0.7) // same bbox lower conf
  const { deduped: d1 } = resolveOverlaps([a,b])
  if (d1.length !== 1) throw new Error(`duplicate text should dedup to 1, got ${d1.length}`)
  if (d1[0].id !== 'a') throw new Error('should keep higher conf')
  console.log('✅ duplicate dedup passed')

  // Text inside image → keep both (legitimate overlap)
  const img = makeEl('img', [0,0,200,200] as any, 'image', undefined, 0.9)
  const txt = makeEl('txt', [50,50,150,70] as any, 'text', 'Caption', 0.85)
  const { deduped: d2 } = resolveOverlaps([img, txt])
  if (d2.length !== 2) throw new Error(`text inside image should keep both, got ${d2.length}`)
  console.log('✅ text-image keep-both passed')

  // Text inside design_element (B2 badge) → nest
  const des = makeEl('des', [460,40,540,110] as any, 'design_element', undefined, 0.9)
  const b2 = makeEl('b2', [480,60,520,90] as any, 'text', 'B2', 0.92)
  const { deduped: d3 } = resolveOverlaps([des, b2])
  if (d3.length !== 2) throw new Error(`design+text should keep both nested, got ${d3.length}`)
  const parent = d3.find(e => e.id==='des')
  const child = d3.find(e => e.id==='b2')
  if (!parent?.children?.includes('b2') || child?.parentId !== 'des') throw new Error('nesting not established')
  console.log('✅ design-text nesting passed')

  // Image inside background → keep both
  const bg = makeEl('bg', [0,0,595,842] as any, 'background', undefined, 0.7)
  const photo = makeEl('photo', [100,300,400,500] as any, 'photo', undefined, 0.9)
  const { deduped: d4 } = resolveOverlaps([bg, photo])
  if (d4.length !== 2) throw new Error(`bg-image should keep both, got ${d4.length}`)
  console.log('✅ bg-image keep-both passed')

  // QR inside image — keep both
  const qr = makeEl('qr', [420,650,520,750] as any, 'qr_code', undefined, 0.92)
  const img2 = makeEl('img2', [0,0,595,842] as any, 'image', undefined, 0.8)
  const { deduped: d5 } = resolveOverlaps([qr, img2])
  if (d5.length !== 2) throw new Error(`qr-image keep both failed`)
  console.log('✅ qr-image passed')
}

function testIoU() {
  // High IoU text-text should merge or dedup, not keep both as separate exercise inputs
  const t1 = makeEl('t1', [36,100,280,120] as any, 'text', 'Line A', 0.8)
  const t2 = makeEl('t2', [36,100,280,120] as any, 'text', 'Line A', 0.75) // identical
  const { deduped } = resolveOverlaps([t1,t2])
  if (deduped.length !== 1) throw new Error(`identical should dedup`)
  console.log('✅ IoU identical passed')
}

try {
  testOverlap()
  testIoU()
  console.log('\nAll overlap tests passed.')
} catch (e) {
  console.error('❌ overlap test failed:', e)
  process.exit(1)
}
