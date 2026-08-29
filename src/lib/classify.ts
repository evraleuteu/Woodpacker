import { chatJson } from './llm'
import { classifyFileRole, type FileRole } from './heuristics'

export const VALID_ROLES: ReadonlySet<FileRole> = new Set(['textbook', 'workbook', 'handbook', 'reference', 'audio', 'video', 'image', 'other'])

export interface AssetClassification {
  id: string
  role: FileRole
  /** 0-100 — how sure the AI is about this role. */
  confidence: number
  /** Short human-readable explanation of why the AI picked this role. */
  reason: string
}

export interface ClassifyInput {
  id: string
  name: string
  kind: string
  path?: string
  text?: string
  words?: number
  pageCount?: number
  durationSec?: number
}

const ROLE_DESCRIPTIONS: Record<FileRole, string> = {
  textbook: 'Kursbuch / lesson book — the main course book (the spine of the course)',
  workbook: 'Übungsbuch / exercise book — practice and exercises',
  handbook: 'Lehrerhandbuch / teacher handbook — teacher manual or Lösungen (answer keys)',
  reference: 'Reference — glossar, vocabulary lists, grammar extras, appendix',
  audio: 'Audio track — listening material',
  video: 'Video — film / video material',
  image: 'Image — picture or graphic',
  other: 'Other — anything that does not fit',
}

export function previewOf(asset: ClassifyInput): string {
  const meta = [asset.path, asset.name].filter(Boolean).join(' / ')
  if (!asset.text) return meta
  const text = asset.text.replace(/\s+/g, ' ').trim()
  const head = text.slice(0, 1200)
  const tail = text.length > 1600 ? text.slice(-400) : ''
  return `${meta}\n---\n${head}${tail ? `\n...\n${tail}` : ''}`
}

function isRole(value: unknown): value is FileRole {
  return typeof value === 'string' && VALID_ROLES.has(value as FileRole)
}

const SYSTEM_PROMPT = [
  'You classify uploaded language-course files. Each file gets exactly ONE role.',
  '',
  'Available roles:',
  ...Object.entries(ROLE_DESCRIPTIONS).map(([key, desc]) => `- ${key}: ${desc}`),
  '',
  'Rules:',
  '- Use the file name, path and the content excerpt together.',
  '- A book dominated by main lessons/texts is "textbook". One dominated by exercises/practice is "workbook". One with answer keys or teacher instructions is "handbook". Vocabulary lists, glossaries or grammar extras are "reference".',
  '- Audio/video/image kinds are almost always classified by their file type, but still verify from the name.',
  '- Use "other" only when nothing fits.',
  '- "confidence" is 0-100: how sure you are about the role.',
  '- "reason" is a short phrase (max 12 words) in English explaining the classification.',
  '',
  'Return JSON: {"classifications":[{"id":"...","role":"...","confidence":0,"reason":"..."}]}',
].join('\n')

export async function classifyAssetsWithAI(assets: ClassifyInput[]): Promise<AssetClassification[]> {
  const heuristicOf = (a: ClassifyInput): AssetClassification => ({
    id: a.id,
    role: classifyFileRole(a),
    confidence: 40,
    reason: 'Based on file name',
  })

  if (!assets.length) return []

  try {
    const payload = assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      words: a.words,
      pageCount: a.pageCount,
      durationSec: a.durationSec,
      excerpt: previewOf(a),
    }))
    const data = await chatJson<{ classifications?: unknown[] }>(SYSTEM_PROMPT, JSON.stringify(payload), 4096)
    const byId = new Map<string, AssetClassification>()
    if (Array.isArray(data.classifications)) {
      for (const raw of data.classifications) {
        const c = raw as Record<string, unknown>
        if (!c || typeof c !== 'object') continue
        const { id } = c
        if (typeof id !== 'string' || byId.has(id)) continue
        const role = c.role
        if (!isRole(role)) continue
        const confidence =
          typeof c.confidence === 'number' && Number.isFinite(c.confidence)
            ? Math.max(0, Math.min(100, Math.round(c.confidence)))
            : 50
        const reason = typeof c.reason === 'string' ? c.reason.slice(0, 160) : ''
        byId.set(id, { id, role, confidence, reason })
      }
    }
    return assets.map((a) => byId.get(a.id) ?? heuristicOf(a))
  } catch {
    return assets.map(heuristicOf)
  }
}