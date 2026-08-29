/**
 * Integration test for hierarchical pipeline.
 * Verifies oversized_region_rate drops after atomic decomposition.
 */
import { runDocumentUnderstandingPipeline } from '../pipeline'
import type { DocumentBundleInput } from '../types'

async function testPipelineIntegration() {
  // Cover page input with large coarse region (the bug)
  const input: DocumentBundleInput = {
    file_id: 'test_cover',
    filename: 'Kontext B2 Cover.pdf',
    page_count: 1,
    pages: [
      {
        page: 1,
        width: 595,
        height: 842,
        blocks: [
          {
            block_id: 'b0',
            page: 1,
            type: 'unknown',
            bbox: [36, 36, 559, 500] as [number,number,number,number],
            confidence: 0.8,
            text: 'Kontext\nDeutsch als Fremdsprache\nKursbuch mit Audios und Videos',
            spans: [
              { text: 'Kontext', bbox: [120,120,250,170] as any, font_name: 'Helvetica-Bold', font_size: 28 },
              { text: 'Deutsch', bbox: [120,180,220,205] as any, font_name: 'Helvetica', font_size: 14 },
            ],
            source: 'layout',
            meta: {
              lines: [
                { bbox: [120,120,250,170] as any, text: 'Kontext', span_indices: [0] },
                { bbox: [120,180,380,205] as any, text: 'Deutsch als Fremdsprache', span_indices: [1] },
                { bbox: [120,215,400,235] as any, text: 'Kursbuch mit Audios und Videos', span_indices: [] },
              ],
            },
          },
          {
            block_id: 'b1',
            page: 1,
            type: 'image',
            bbox: [460, 40, 540, 110] as any,
            confidence: 0.9,
            text: 'B2',
            source: 'layout',
            meta: { icon: false },
          },
          {
            block_id: 'b2',
            page: 1,
            type: 'unknown',
            bbox: [0, 0, 595, 842] as any,
            confidence: 0.6,
            text: '',
            source: 'layout',
            meta: { area_ratio: 0.99 },
          },
        ],
      },
    ],
  }

  const out = await runDocumentUnderstandingPipeline(input)

  console.log('Pipeline output:')
  console.log(`  rawBlocks: ${out.rawBlocks.length}`)
  console.log(`  atomicElements: ${out.atomicElements.length}`)
  console.log(`  semanticGroups: ${out.semanticGroups.length}`)
  console.log(`  exercises: ${out.exercises.length}`)
  console.log(`  oversized_region_rate: ${out.metrics.oversizedRegionRate}`)
  console.log(`  duplicateRate: ${out.metrics.duplicateRate}`)
  console.log(`  telemetry: ${out.telemetry.map(t => `${t.node}:${t.status}`).join(', ')}`)

  // Assertions
  if (out.rawBlocks.length !== 3) throw new Error(`expected 3 raw blocks, got ${out.rawBlocks.length}`)
  if (out.atomicElements.length < 5) throw new Error(`expected >=5 atomic (cover 3 lines + B2 + background), got ${out.atomicElements.length}`)
  if (out.metrics.oversizedRegionRate > 0.1) throw new Error(`oversized_region_rate should be <0.1 after decomposition, got ${out.metrics.oversizedRegionRate}`)
  // Check atomic texts preserved
  const texts = out.atomicElements.map(e => e.text)
  if (!texts.some(t => t === 'Kontext')) throw new Error('Kontext not in atomic')
  // Background should be detected
  if (!out.atomicElements.some(e => e.type === 'background')) throw new Error('background not detected')
  // Reading order assigned
  if (!out.atomicElements.every(e => e.type === 'background' || typeof e.readingOrder === 'number')) throw new Error('readingOrder missing')
  // Semantic groups preserve atoms
  if (out.semanticGroups.length === 0) console.warn('Note: no semantic groups formed (expected for cover)')

  // Verify pipeline stages separate
  const stageNodes = out.telemetry.map(t => t.node)
  const required = ['atomic', 'classification', 'overlap', 'reading_order', 'grouping', 'exercise_detection']
  for (const r of required) {
    if (!stageNodes.some(s => s.includes(r))) throw new Error(`missing telemetry for ${r}`)
  }

  // Verify atomic and groups coexist
  if (out.atomicElements.length === 0 || out.semanticGroups === undefined) throw new Error('atomic/groups not preserved together')

  console.log('✅ pipeline integration test passed')
}

async function testMixedPage() {
  const input: DocumentBundleInput = {
    file_id: 'test_mixed',
    filename: 'mixed.pdf',
    page_count: 1,
    pages: [
      {
        page: 1,
        width: 595,
        height: 842,
        blocks: [
          // PDF-native text block
          {
            block_id: 'pdf_b0',
            page: 1,
            type: 'paragraph',
            bbox: [36, 80, 559, 120] as any,
            confidence: 0.98,
            text: 'Digital paragraph with native fonts',
            spans: [{ text: 'Digital', bbox: [36,80,100,100] as any, font_name: 'Helvetica', font_size: 12 }],
            source: 'pdf',
            meta: { lines: [{ bbox: [36,80,559,100] as any, text: 'Digital paragraph', span_indices: [0] }] },
          },
          // OCR block (scanned image region)
          {
            block_id: 'ocr_b0',
            page: 1,
            type: 'unknown',
            bbox: [36, 150, 559, 250] as any,
            confidence: 0.72,
            text: 'Scanned line A\nScanned line B',
            source: 'ocr',
          },
          // Image block
          {
            block_id: 'img_b0',
            page: 1,
            type: 'image',
            bbox: [100, 300, 400, 500] as any,
            confidence: 0.91,
            source: 'layout',
          },
        ],
      },
    ],
  }
  const out = await runDocumentUnderstandingPipeline(input)
  console.log(`[mixed] atomic ${out.atomicElements.length}, groups ${out.semanticGroups.length}`)
  if (out.atomicElements.length < 4) throw new Error(`mixed should yield >=4 atoms (1 pdf line + 2 ocr lines + 1 image), got ${out.atomicElements.length}`)
  // Check provenance hybrid
  const hasPdf = out.atomicElements.some(e => e.detectors.includes('pdf'))
  const hasOcrDecomp = out.atomicElements.some(e => e.detectors.includes('atomic-decompose'))
  if (!hasPdf) throw new Error('pdf provenance missing')
  if (!hasOcrDecomp) console.warn('ocr decompose provenance not flagged (ok if meta lines used)')
  console.log('✅ mixed page test passed')
}

async function run() {
  try {
    await testPipelineIntegration()
    await testMixedPage()
    console.log('\nAll pipeline tests passed.')
  } catch (e) {
    console.error('❌ pipeline test failed:', e)
    process.exit(1)
  }
}

run()
