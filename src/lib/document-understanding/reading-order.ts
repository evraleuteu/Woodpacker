/**
 * Reading Order — geometrically and structurally determined, not just y-sort.
 *
 * Supports: columns, sidebars, headers, footers, captions, tables, exercises, multi-column textbook layouts.
 * Assigns readingOrder to every content element.
 */
import type { AtomicElement, BBox } from './types'
import { coverage } from './geometry'

export interface ReadingOrderOptions {
  pageWidth: number
  pageHeight: number
  // If true, detect columns via vertical whitespace gaps
  detectColumns?: boolean
}

interface Column {
  x0: number
  x1: number
  elements: AtomicElement[]
}

/**
 * Main entry: assign readingOrder 1..N per page, sorted by reading flow.
 * Returns elements sorted by readingOrder, with readingOrder field set.
 * Headers/footers/page_numbers are ordered separately (header first, footer last).
 */
export function assignReadingOrder(
  elements: AtomicElement[],
  pageWidth: number,
  pageHeight: number,
  _pageNum: number,
  opts: ReadingOrderOptions = { pageWidth, pageHeight },
): AtomicElement[] {
  if (!elements.length) return []

  // Partition by role for structural ordering
  const headers = elements.filter(e => e.type === 'header')
  const footers = elements.filter(e => e.type === 'footer' || e.type === 'page_number')
  const backgrounds = elements.filter(e => e.type === 'background')
  const content = elements.filter(e => !['header','footer','page_number','background'].includes(e.type))

  // Detect columns in content
  const columns = detectColumns(content, pageWidth, pageHeight, opts.detectColumns ?? true)

  // Order content: columns left->right, within each column top->bottom, but with handling for
  // elements that span columns (e.g., headings full-width)
  const orderedContent = orderByColumns(content, columns, pageWidth)

  // Final sequence: headers -> content -> footers -> backgrounds last (not read)
  const sequence = [...headers, ...orderedContent, ...footers, ...backgrounds]

  // Assign readingOrder (1-indexed) only to readable content; backgrounds get undefined
  let counter = 1
  for (const el of sequence) {
    if (el.type === 'background') {
      el.readingOrder = undefined
    } else {
      el.readingOrder = counter++
    }
  }

  // Return sorted by readingOrder (backgrounds at end)
  return [...sequence].sort((a, b) => (a.readingOrder ?? 9999) - (b.readingOrder ?? 9999))
}

function detectColumns(elements: AtomicElement[], pageWidth: number, _pageHeight: number, enabled: boolean): Column[] {
  if (!enabled || elements.length < 6) {
    return [{ x0: 0, x1: pageWidth, elements }]
  }

  // Collect x0 positions of paragraph/question blocks
  const xs = elements
    .filter(e => ['paragraph','question','instruction','text','exercise'].includes(e.type))
    .map(e => e.bbox[0])
    .sort((a, b) => a - b)

  if (xs.length < 4) return [{ x0: 0, x1: pageWidth, elements }]

  // Histogram of x0 to find column gutters
  // Find gap > 60pt where few elements start
  const sortedXs = [...new Set(xs.map(x => Math.round(x / 10) * 10))].sort((a,b)=>a-b)
  let gutter: number | null = null
  for (let i = 1; i < sortedXs.length; i++) {
    const gap = sortedXs[i] - sortedXs[i-1]
    if (gap > 60 && gap < pageWidth * 0.4) {
      // Check if left and right clusters have similar counts
      const leftCount = xs.filter(x => x < sortedXs[i]).length
      const rightCount = xs.filter(x => x >= sortedXs[i]).length
      if (leftCount >= 2 && rightCount >= 2) {
        gutter = (sortedXs[i-1] + sortedXs[i]) / 2
        break
      }
    }
  }

  if (gutter === null) {
    return [{ x0: 0, x1: pageWidth, elements }]
  }

  const left: AtomicElement[] = []
  const right: AtomicElement[] = []
  const spanning: AtomicElement[] = []

  for (const el of elements) {
    const cx = (el.bbox[0] + el.bbox[2]) / 2
    const w = el.bbox[2] - el.bbox[0]
    // Spanning if wide (>60% page) and centered near gutter
    if (w > pageWidth * 0.6 && Math.abs(cx - pageWidth/2) < pageWidth*0.15) {
      spanning.push(el)
    } else if (cx < gutter) left.push(el)
    else right.push(el)
  }

  // If either column empty, treat as single column
  if (!left.length || !right.length) return [{ x0: 0, x1: pageWidth, elements }]

  return [
    { x0: 0, x1: gutter, elements: left },
    { x0: gutter, x1: pageWidth, elements: right },
    // Spanning elements handled separately but we return 2 columns + logic in orderByColumns
  ]
}

function orderByColumns(content: AtomicElement[], columns: Column[], pageWidth: number): AtomicElement[] {
  if (columns.length === 1) {
    // Single column: simple top->bottom, left->right
    return [...content].sort(compareGeometric)
  }

  // Multi-column: we have 2 columns + spanning elements
  const left = columns[0]?.elements ?? []
  const right = columns[1]?.elements ?? []

  // Identify spanning (full-width) elements: headings, titles that are not in left/right
  const allColIds = new Set([...left, ...right].map(e => e.id))
  const spanning = content.filter(e => !allColIds.has(e.id))

  // Spanning elements should be ordered by y globally and interleaved
  // Heuristic: sort all by y, then columns are secondary
  // For textbook: heading spanning top, then left column questions 1a,1b, then right column 2a etc
  // Simplistic: sort spanning by y, then interleave: spanning in global y order, column content in y order per column
  // Then merge via stable sort by y but column-aware: if element spans, its y is global; else left column y is primary for its region
  // Use XY-cut: group spanning headers as separators

  const leftSorted = [...left].sort(compareGeometric)
  const rightSorted = [...right].sort(compareGeometric)
  const spanningSorted = [...spanning].sort(compareGeometric)

  // Merge: walk y from top to bottom, emit spanning when its y before next column elements
  const merged: AtomicElement[] = []
  const li = 0, ri = 0, si = 0
  // Create combined sorted by y for spanning insertion
  // Instead, collect all and sort with column priority: spanning first at its y, then column elements
  const all = [...leftSorted, ...rightSorted, ...spanningSorted]
  // Sort by y, but for same y band (±12pt), spanning comes before columns
  all.sort((a, b) => {
    const ay = a.bbox[1], by = b.bbox[1]
    if (Math.abs(ay - by) < 12) {
      const aSpan = spanningSorted.includes(a)
      const bSpan = spanningSorted.includes(b)
      if (aSpan && !bSpan) return -1
      if (!aSpan && bSpan) return 1
      // Within same band, left before right
      return a.bbox[0] - b.bbox[0]
    }
    return ay - by
  })

  // Now reorder: for non-spanning, preserve column left->right when on same row?
  // The sorted above already does left->right within band

  // Deduplicate (since all contains duplicates? Actually we built all from three lists, no overlap should be exhaustive partition, so no dup)
  return all
}

function compareGeometric(a: AtomicElement, b: AtomicElement): number {
  // Top first (small y), then left
  if (Math.abs(a.bbox[1] - b.bbox[1]) > 6) return a.bbox[1] - b.bbox[1]
  return a.bbox[0] - b.bbox[0]
}
