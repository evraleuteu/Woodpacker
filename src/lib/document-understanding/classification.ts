/** Classification — rules first, LLM only for low confidence (mirrors Python classify.py). */

import type { AtomicElement } from './types'

const NUMBERED_RE = /^\s*(\d{1,3}\s*[.)]|[a-h]\s*[.)])\s+\S/i
const MULTI_NUM_RE = /(?:^|\n)\s*\d{1,3}\s*[.)]/m
const AUDIO_RE = /\b(cd|hörtext|hoertext|track|spur|audio)\s*[\d.]|\baudio\b/i
const VIDEO_RE = /\b(video|film)\s*[\d.]|\bvideo\b|\bfilm\b/i
const GAP_RE = /_{3,}|\.{6,}|\(\s*[a-zäöüß-]{2,25}\s*\)|\[\s*\]|\(\s*\)/i
const IMPERATIVE_RE = /(kreuzen sie|ergänzen sie|ordnen sie|verbinden sie|zuordnen|schreiben sie|lesen sie|hören sie|hoeren sie|markieren sie|wählen sie|beschreiben sie|erzählen sie|diskutieren sie|match|complete|fill in|choose|listen|read|write|describe)/i
const PAGE_NUM_RE = /^[-–—\s]*\d{1,3}[-–—\s]*$/

const TYPE_TO_CATEGORY: Record<string, string> = {
  heading: 'header', subtitle: 'header', paragraph: 'paragraph',
  exercise: 'exercise', instruction: 'instruction', question: 'question',
  answer: 'answer_area', image: 'image', table: 'table', header: 'header',
  footer: 'footer', audio_marker: 'reference', video_marker: 'reference',
  page_number: 'footer', caption: 'caption', unknown: 'unknown',
  text: 'paragraph', label: 'paragraph', list: 'paragraph', list_item: 'question',
  illustration: 'image', photo: 'image', diagram: 'image', qr_code: 'image',
  icon: 'image', logo: 'image', design_element: 'image', level_badge: 'image',
  background: 'unknown', page_decoration: 'unknown', media_marker: 'reference',
}

export interface Classification {
  id: string
  category: string
  confidence: number
  method: 'rules' | 'geometry' | 'layout' | 'llm'
  signals: string[]
}

export function classifyElements(elements: AtomicElement[], pageHeights: Map<number, number>): Classification[] {
  return elements.map((el) => classifyOne(el, pageHeights.get(el.page) ?? 1000))
}

function classifyOne(el: AtomicElement, pageH: number): Classification {
  const text = (el.text ?? '').trim()
  const signals: string[] = []
  let best = TYPE_TO_CATEGORY[el.type] ?? 'unknown'
  let bestConf = Math.min(Math.max(el.confidence, 0.3), 0.99) * 0.6
  let method: Classification['method'] = 'layout'

  const relTop = el.bbox[1] / Math.max(pageH, 1)
  const relBottom = el.bbox[3] / Math.max(pageH, 1)
  const consider = (cat: string, conf: number, sig: string) => {
    if (conf > bestConf) { best = cat; bestConf = conf; method = sig.startsWith('geo:') ? 'geometry' : 'rules' }
    if (!signals.includes(sig)) signals.push(sig)
  }

  // cover-specific atomic cues
  const low = text.toLowerCase()
  if (/^\s*kontext\s*$/i.test(text) && text.length <= 20) {
    consider('header', 0.88, 'rule:cover_title_kontext')
    el.subtype = el.subtype ?? 'title'
  }
  if (text.toLowerCase() === 'deutsch als fremdsprache' && text.length < 40) {
    consider('header', 0.86, 'rule:cover_subtitle')
    el.subtype = el.subtype ?? 'subtitle'
  }
  if (low.includes('kursbuch mit audios') && text.length < 80) consider('paragraph', 0.85, 'rule:cover_description')

  if (el.type === 'background' || el.type === 'design_element' || el.type === 'level_badge') {
    return { id: el.id, category: el.type === 'background' ? 'unknown' : 'image', confidence: Number(el.confidence.toFixed(3)), method: 'geometry', signals: [`visual:${el.type}`] }
  }
  if (el.subtype === 'level_badge' && /^\s*[A-C][12]\s*$/i.test(text)) {
    return { id: el.id, category: 'image', confidence: 0.92, method: 'rules', signals: ['rule:level_badge'] }
  }
  if (el.subtype === 'background') return { id: el.id, category: 'unknown', confidence: 0.9, method: 'geometry', signals: ['rule:background'] }

  const short = text.length <= 120
  if (relTop <= 0.07 && short) consider('header', 0.72, 'geo:top_band')
  else if (relBottom >= 0.93 && short) {
    if (PAGE_NUM_RE.test(text)) consider('footer', 0.92, 'rule:page_number')
    else consider('footer', 0.72, 'geo:bottom_band')
  }
  if (!text) return { id: el.id, category: best, confidence: Number(bestConf.toFixed(3)), method: 'layout', signals: ['no_text'] }

  const isShortish = text.length < 140 && (text.match(/\n/g) || []).length <= 2
  if (isShortish && VIDEO_RE.test(text)) consider('reference', 0.93, 'rule:video_ref')
  else if (isShortish && AUDIO_RE.test(text)) consider('reference', 0.93, 'rule:audio_ref')

  if (NUMBERED_RE.test(text)) consider('question', 0.86, 'rule:numbered_item')
  if (MULTI_NUM_RE.test(text) && text.length < 600) consider('exercise', 0.78, 'rule:multiple_numbered_items')
  if (/^\s*[a-h]\s*[.)]/i.test(text) && text.length < 400 && IMPERATIVE_RE.test(text)) consider('exercise', 0.82, 'rule:alpha_items_with_imperative')

  const m = IMPERATIVE_RE.exec(text.slice(0, 200))
  if (m) {
    const verb = (m[1] || '').toLowerCase()
    const hasItems = NUMBERED_RE.test(text) || GAP_RE.test(text)
    if (hasItems) consider('exercise', 0.84, `rule:imperative_with_content:${verb}`)
    else if (text.length < 220) consider('instruction', 0.83, `rule:imperative:${verb}`)
  }
  if (/ordnen sie zu|verbinden sie|zuordnen|zuordnung|match\b/i.test(text)) consider('exercise', 0.88, 'rule:matching_cue')

  if (GAP_RE.test(text)) {
    const gaps = text.match(new RegExp(GAP_RE, 'gi')) ?? []
    const density = gaps.join('').length / Math.max(text.length, 1)
    if (density > 0.25) consider('answer_area', 0.85, 'rule:gap_dominant')
    else consider('question', 0.76, 'rule:gap_inline')
  }
  if (/\b(wer|was|wann|wo|wie|warum|welche|welcher|welches|who|what|where|when|why|how)\b/i.test(text) && text.includes('?') && text.length < 300) {
    consider('question', 0.74, 'rule:question_word')
  }

  // Map category back to element type for downstream — but keep signal
  if (best !== (TYPE_TO_CATEGORY[el.type] ?? 'unknown') && best in ['header','footer','paragraph','question','instruction','exercise','answer_area','image','table','caption','reference','unknown']) {
    // confident rule refines weak layout hint
    if (Number(bestConf.toFixed(3)) >= 0.7) {
      const catToType: Record<string, string> = {
        header: el.bbox[1]/pageH < 0.07 ? 'header' : 'heading',
        footer: 'footer', paragraph: 'paragraph', question: 'question',
        instruction: 'instruction', exercise: 'exercise', answer_area: 'answer',
        image: 'image', table: 'table', caption: 'caption', reference: el.type, unknown: 'unknown',
      }
      const mapped = catToType[best]
      if (mapped) el.type = mapped as AtomicElement['type']
    }
  }
  return { id: el.id, category: best, confidence: Number(bestConf.toFixed(3)), method, signals }
}
