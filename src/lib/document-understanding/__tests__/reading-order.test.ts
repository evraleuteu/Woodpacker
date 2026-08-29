import { assignReadingOrder } from '../reading-order'
import type { AtomicElement } from '../types'

function makeEl(id: string, bbox: [number,number,number,number], page=1): AtomicElement {
  return { id, type: 'paragraph', bbox, confidence: 0.8, source: 'pdf', detectors: ['pdf'], page, isAtomic: true }
}

function testSingleColumn() {
  const els = [
    makeEl('c', [36,200,559,220]),
    makeEl('a', [36,100,559,120]),
    makeEl('b', [36,150,559,170]),
  ]
  const ordered = assignReadingOrder(els, 595,842,1)
  const ids = ordered.filter(e=>e.readingOrder).map(e=>e.id)
  if (ids[0] !== 'a' || ids[1] !== 'b' || ids[2] !== 'c') throw new Error(`single col order wrong: ${ids}`)
  console.log('✅ single column reading order passed')
}

function testMultiColumn() {
  const left1 = makeEl('l1', [36,100,280,120])
  const left2 = makeEl('l2', [36,130,280,150])
  const right1 = makeEl('r1', [315,100,559,120])
  const right2 = makeEl('r2', [315,130,559,150])
  const heading = makeEl('h', [36,60,559,80])
  heading.type = 'heading'
  const els = [right2, left1, heading, right1, left2]
  const ordered = assignReadingOrder(els, 595,842,1)
  const ids = ordered.filter(e=>e.type!=='background').map(e=>e.id)
  // Heading first, then left col top->bottom, then right? Or interleaved by y band
  // Our algorithm should put heading first, then by y band left before right
  if (ids[0] !== 'h') throw new Error(`heading should be first, got ${ids[0]}`)
  console.log(`✅ multi-column order: ${ids.join(' -> ')}`)
  // Ensure readingOrder assigned
  if (!ordered.every(e=> e.type==='background' || typeof e.readingOrder==='number')) throw new Error('readingOrder missing')
}

function testHeaderFooter() {
  const header = makeEl('hdr', [36,10,559,40]); header.type='header'
  const body = makeEl('body', [36,100,559,200])
  const footer = makeEl('ftr', [36,800,559,830]); footer.type='footer'
  const ordered = assignReadingOrder([body, footer, header], 595,842,1)
  const ids = ordered.filter(e=>e.readingOrder).map(e=>e.id)
  if (ids[0] !== 'hdr' || ids[ids.length-1] !== 'ftr') throw new Error(`header/footer order wrong: ${ids}`)
  console.log('✅ header/footer order passed')
}

try {
  testSingleColumn()
  testMultiColumn()
  testHeaderFooter()
  console.log('\nAll reading-order tests passed.')
} catch (e) {
  console.error('❌ reading-order failed:', e)
  process.exit(1)
}
