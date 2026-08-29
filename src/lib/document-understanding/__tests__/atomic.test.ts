/**
 * Vitest-style tests for atomic element extraction.
 * Run with: npx tsx src/lib/document-understanding/__tests__/atomic.test.ts
 * (simple assert runner, no vitest dependency required)
 */
import { extractAtomicElements, resetAtomicCounter } from '../atomic'
import type { CoarseBlock } from '../types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

function testCoverPage() {
  resetAtomicCounter()
  // Simulate a large coarse region that the old detector would return for cover
  const coverBlock: CoarseBlock = {
    block_id: 'page_1_block_0',
    page: 1,
    type: 'unknown',
    bbox: [36, 36, 559, 806], // large visual region covering most of cover
    confidence: 0.85,
    text: 'Kontext\nDeutsch als Fremdsprache\nKursbuch mit Audios und Videos',
    spans: [
      { text: 'Kontext', bbox: [120, 120, 250, 170] as [number,number,number,number], font_name: 'Helvetica-Bold', font_size: 28 },
      { text: 'Deutsch', bbox: [120, 180, 220, 205] as [number,number,number,number], font_name: 'Helvetica', font_size: 14 },
      { text: 'als', bbox: [225, 180, 255, 205] as [number,number,number,number], font_name: 'Helvetica', font_size: 14 },
      { text: 'Fremdsprache', bbox: [260, 180, 380, 205] as [number,number,number,number], font_name: 'Helvetica', font_size: 14 },
      { text: 'Kursbuch', bbox: [120, 215, 220, 235] as [number,number,number,number], font_name: 'Helvetica', font_size: 11 },
      { text: 'mit', bbox: [225, 215, 250, 235] as [number,number,number,number], font_name: 'Helvetica', font_size: 11 },
      { text: 'Audios', bbox: [255, 215, 310, 235] as [number,number,number,number], font_name: 'Helvetica', font_size: 11 },
      { text: 'und', bbox: [315, 215, 340, 235] as [number,number,number,number], font_name: 'Helvetica', font_size: 11 },
      { text: 'Videos', bbox: [345, 215, 400, 235] as [number,number,number,number], font_name: 'Helvetica', font_size: 11 },
    ],
    source: 'layout',
    meta: {
      lines: [
        { bbox: [120, 120, 250, 170] as [number,number,number,number], text: 'Kontext', span_indices: [0] },
        { bbox: [120, 180, 380, 205] as [number,number,number,number], text: 'Deutsch als Fremdsprache', span_indices: [1,2,3] },
        { bbox: [120, 215, 400, 235] as [number,number,number,number], text: 'Kursbuch mit Audios und Videos', span_indices: [4,5,6,7,8] },
      ],
    },
  }

  const b2Badge: CoarseBlock = {
    block_id: 'page_1_block_1',
    page: 1,
    type: 'image',
    bbox: [460, 40, 540, 110] as [number,number,number,number],
    confidence: 0.9,
    text: 'B2',
    spans: [{ text: 'B2', bbox: [480, 60, 520, 90] as [number,number,number,number], font_name: 'Helvetica-Bold', font_size: 22 }],
    source: 'layout',
    meta: { icon: false, area_ratio: 0.02 },
  }

  const qrBlock: CoarseBlock = {
    block_id: 'page_1_block_2',
    page: 1,
    type: 'image',
    bbox: [420, 650, 520, 750] as [number,number,number,number],
    confidence: 0.88,
    text: '',
    source: 'layout',
    meta: { icon: true },
  }

  const photoBlock: CoarseBlock = {
    block_id: 'page_1_block_3',
    page: 1,
    type: 'image',
    bbox: [120, 300, 480, 550] as [number,number,number,number],
    confidence: 0.92,
    source: 'layout',
  }

  const bgBlock: CoarseBlock = {
    block_id: 'page_1_block_4',
    page: 1,
    type: 'unknown',
    bbox: [0, 0, 595, 842] as [number,number,number,number],
    confidence: 0.6,
    text: '',
    source: 'layout',
    meta: { area_ratio: 0.99 },
  }

  const blocks = [coverBlock, b2Badge, qrBlock, photoBlock, bgBlock]
  const atoms = extractAtomicElements(blocks, 595, 842, 1)

  console.log(`[cover] coarse ${blocks.length} -> atomic ${atoms.length}`)
  // Expect decomposition of coverBlock into 3 lines
  const coverAtoms = atoms.filter(a => a.parentId === 'page_1_block_0')
  assert(coverAtoms.length === 3, `coverBlock should decompose into 3 lines, got ${coverAtoms.length}: ${JSON.stringify(coverAtoms.map(a=>a.text))}`)

  // Check each expected text present as atomic
  const texts = atoms.map(a => a.text)
  assert(texts.some(t => t === 'Kontext'), 'Kontext atomic missing')
  assert(texts.some(t => t === 'Deutsch als Fremdsprache'), 'subtitle atomic missing')
  assert(texts.some(t => t === 'Kursbuch mit Audios und Videos'), 'description atomic missing')
  // B2 should remain (or be decomposed but still present)
  assert(texts.some(t => t?.includes('B2')), 'B2 atomic missing')
  // Background should be kept as one but marked
  const bgs = atoms.filter(a => (a.bbox[2]-a.bbox[0])*(a.bbox[3]-a.bbox[1]) > 595*842*0.5)
  // Actually background detection is separate, but atomic keeps large visual as single
  assert(atoms.length >= 7, `expected >=7 atoms, got ${atoms.length}`)

  // Verify oversized_region_rate would be low (allow background placeholder before background stage)
  const oversized = atoms.filter(a => {
    const cov = (a.bbox[2]-a.bbox[0])*(a.bbox[3]-a.bbox[1]) / (595*842)
    // Backgrounds are handled by background.ts post-stage; exclude huge unknown as pre-background
    if (a.type === 'background' || a.type === 'image' || a.type === 'photo') return false
    if (cov > 0.6 && !a.text) return false // pre-background large visual
    return cov > 0.25 && (a.text?.length ?? 0) < 200
  })
  assert(oversized.length === 0, `oversized atoms should be 0 after decomposition, got ${oversized.length}: ${JSON.stringify(oversized.map(o=>({text:o.text, bbox:o.bbox})))}`)

  console.log('✅ cover page test passed')
}

function testExercisePage() {
  resetAtomicCounter()
  // Exercise page: instruction + 2 questions + answer options
  const instructionBlock: CoarseBlock = {
    block_id: 'p2_b0',
    page: 2,
    type: 'instruction',
    bbox: [36, 100, 559, 130] as [number,number,number,number],
    confidence: 0.9,
    text: 'Ergänzen Sie die Sätze mit den Wörtern aus dem Kasten.',
    source: 'layout',
  }
  const q1Block: CoarseBlock = {
    block_id: 'p2_b1',
    page: 2,
    type: 'question',
    bbox: [36, 140, 559, 180] as [number,number,number,number],
    confidence: 0.85,
    text: '1. Ich ___ (arbeiten) in Berlin.\n2. Wir ___ (kommen) aus Spanien.',
    spans: [
      { text: '1.', bbox: [36,140,50,160] as any, font_name: 'Helvetica', font_size: 10 },
      { text: 'Ich', bbox: [55,140,80,160] as any, font_name: 'Helvetica', font_size: 10 },
      { text: '___', bbox: [85,140,120,160] as any, font_name: 'Helvetica', font_size: 10 },
      { text: '2.', bbox: [36,160,50,180] as any, font_name: 'Helvetica', font_size: 10 },
    ],
    meta: {
      lines: [
        { bbox: [36,140,559,160] as any, text: '1. Ich ___ (arbeiten) in Berlin.', span_indices: [0,1,2] },
        { bbox: [36,160,559,180] as any, text: '2. Wir ___ (kommen) aus Spanien.', span_indices: [3] },
      ],
    },
    source: 'layout',
  }
  const blocks = [instructionBlock, q1Block]
  const atoms = extractAtomicElements(blocks, 595, 842, 2)
  console.log(`[exercise] ${blocks.length} -> ${atoms.length}`)
  assert(atoms.length >= 3, `exercise page should decompose q block into 2 lines + instruction, got ${atoms.length}`)
  assert(atoms.some(a => a.text?.includes('Ergänzen')), 'instruction atomic missing')
  assert(atoms.filter(a => a.text?.includes('Ich ___')).length === 1, 'q1 line atomic missing')
  console.log('✅ exercise page test passed')
}

function testMultiColumn() {
  resetAtomicCounter()
  // Two-column layout: left and right column blocks that old detector might merge
  const leftBlock: CoarseBlock = {
    block_id: 'p3_left',
    page: 3,
    type: 'paragraph',
    bbox: [36, 100, 280, 300] as any,
    confidence: 0.8,
    text: 'Spalte links Zeile 1\nSpalte links Zeile 2',
    meta: { lines: [
      { bbox: [36,100,280,120] as any, text: 'Spalte links Zeile 1', span_indices: [] },
      { bbox: [36,130,280,150] as any, text: 'Spalte links Zeile 2', span_indices: [] },
    ]},
    source: 'layout',
  }
  const rightBlock: CoarseBlock = {
    block_id: 'p3_right',
    page: 3,
    type: 'paragraph',
    bbox: [315, 100, 559, 300] as any,
    confidence: 0.8,
    text: 'Spalte rechts Zeile 1\nSpalte rechts Zeile 2',
    meta: { lines: [
      { bbox: [315,100,559,120] as any, text: 'Spalte rechts Zeile 1', span_indices: [] },
      { bbox: [315,130,559,150] as any, text: 'Spalte rechts Zeile 2', span_indices: [] },
    ]},
    source: 'layout',
  }
  const atoms = extractAtomicElements([...[leftBlock, rightBlock]], 595, 842, 3)
  assert(atoms.length === 4, `multicol should yield 4 lines, got ${atoms.length}`)
  // Verify x ordering preserved per column
  const leftAtoms = atoms.filter(a => a.bbox[0] < 300)
  const rightAtoms = atoms.filter(a => a.bbox[0] >= 300)
  assert(leftAtoms.length === 2 && rightAtoms.length === 2, 'column atoms not preserved')
  console.log('✅ multi-column test passed')
}

function testScannedFallback() {
  // Scanned PDF: no native words, OCR provides single large block
  resetAtomicCounter()
  const ocrLarge: CoarseBlock = {
    block_id: 'p4_ocr',
    page: 4,
    type: 'unknown',
    bbox: [36, 36, 559, 400] as any,
    confidence: 0.7,
    text: 'Scanned line one\nScanned line two\nScanned line three',
    source: 'ocr',
  }
  const atoms = extractAtomicElements([ocrLarge], 595, 842, 4)
  assert(atoms.length === 3, `scanned OCR large should decompose into 3, got ${atoms.length}`)
  assert(atoms.every(a => a.detectors.includes('atomic-decompose')), 'should be marked atomic-decompose')
  console.log('✅ scanned fallback test passed')
}

function testDigitalPdfPreference() {
  // Digital PDF already has spans/lines — should preserve and not OCR again
  resetAtomicCounter()
  const digital: CoarseBlock = {
    block_id: 'p5_digital',
    page: 5,
    type: 'paragraph',
    bbox: [36, 100, 559, 130] as any,
    confidence: 0.98,
    text: 'Digital native line',
    spans: [{ text: 'Digital', bbox: [36,100,100,115] as any, font_name: 'Helvetica', font_size: 12 }, { text: 'native', bbox: [105,100,160,115] as any, font_name: 'Helvetica', font_size: 12 }],
    source: 'pdf',
    meta: { lines: [{ bbox: [36,100,559,115] as any, text: 'Digital native line', span_indices: [0,1] }] },
  }
  const atoms = extractAtomicElements([digital], 595, 842, 5)
  assert(atoms.length === 1, `digital single line should remain 1, got ${atoms.length}`)
  assert(atoms[0].source === 'hybrid' || atoms[0].detectors.includes('pdf'), 'digital should preserve pdf source')
  console.log('✅ digital PDF preference test passed')
}

async function runAll() {
  try {
    testCoverPage()
    testExercisePage()
    testMultiColumn()
    testScannedFallback()
    testDigitalPdfPreference()
    console.log('\nAll atomic tests passed.')
  } catch (e) {
    console.error('❌ Test failed:', e)
    process.exit(1)
  }
}

runAll()
