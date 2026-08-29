const BASE_URL = process.env.OPENCODE_API_URL?.replace(/\/+$/, '') || 'https://opencode.ai/zen/v1'
const API_KEY = process.env.OPENCODE_API_KEY || ''
const MODEL = process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free'
const VISION_MODEL = process.env.OPENCODE_VISION_MODEL || 'openrouter/free'

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) return text.slice(start, end + 1)
  return text.trim()
}

export async function chatJson<T>(system: string, user: string, maxTokens = 8192): Promise<T> {
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
  const body = JSON.stringify({
    model: MODEL,
    messages,
    temperature: 0.4,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  })
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body,
    signal: AbortSignal.timeout(180000),
  })
  if (!res.ok) {
    throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('LLM returned empty content')
  }
  return JSON.parse(extractJson(content)) as T
}

const TRANSCRIBE_SYSTEM =
  'You are a precise OCR engine for language-learning textbook pages. ' +
  'Transcribe ALL visible text EXACTLY as printed, in natural reading order (top-to-bottom, left-to-right). ' +
  'Rules: ' +
  '- Keep exercise labels exactly ("1a", "Aufgabe 5", "b", "c"). ' +
  '- Keep blanks as underscores exactly as printed ("______"). ' +
  '- Keep numbered/bulleted list markers. ' +
  '- Mark each distinct visual column/box region with a blank line between them. ' +
  '- Transcribe small-print tips/boxes (e.g. "TIPP", "GRAMMATIK") too. ' +
  '- NEVER translate, summarize, correct, or add commentary. ' +
  '- If text is illegible, write [unleserlich]. ' +
  'Respond with the transcription ONLY — no markdown fences, no explanation. ' +
  'The transcription is used by a downstream exercise extractor, so completeness and exactness matter more than beauty.'

/** Transcribes all visible text of a textbook-page image via a vision model. */
export async function transcribeImage(dataUrl: string, maxTokens = 8192): Promise<string> {
  const body = JSON.stringify({
    model: VISION_MODEL,
    messages: [
      { role: 'system', content: TRANSCRIBE_SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe every word visible in this textbook page image.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0,
    max_tokens: maxTokens,
  })
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body,
    signal: AbortSignal.timeout(180000),
  })
  if (!res.ok) {
    throw new Error(`Vision LLM ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Vision LLM returned empty content')
  }
  return content.trim()
}

export function visionConfigured(): boolean {
  return Boolean(API_KEY)
}
