const BASE_URL = process.env.OPENCODE_API_URL?.replace(/\/+$/, '') || 'https://opencode.ai/zen/v1'
const API_KEY = process.env.OPENCODE_API_KEY || ''
const MODEL = process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free'

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
