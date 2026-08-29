import type { UploadedAsset } from './types'
import type { AssetClassification } from './classify'
import { detectExercises, detectChapters, chapterNumberFromTitle } from './heuristics'
import { matchMediaNumbers } from './package'
import { detectTrackRefs, detectSolutionRef, extractExerciseLabels } from './relationships'

/** Public material types declared in the Relationship Engine spec. */
export type MaterialType =
  | 'lesson_book'
  | 'exercise_book'
  | 'workbook'
  | 'solution_book'
  | 'teacher_handbook'
  | 'audio'
  | 'video'
  | 'transcript'
  | 'vocabulary_book'
  | 'exam_book'
  | 'grammar_reference'
  | 'worksheet'
  | 'other'

/** Maps the upload-time FileRole to the engine's MaterialType. */
const ROLE_TO_MATERIAL: Record<string, MaterialType> = {
  textbook: 'lesson_book',
  workbook: 'workbook',
  handbook: 'teacher_handbook',
  reference: 'grammar_reference',
  audio: 'audio',
  video: 'video',
  image: 'other',
  other: 'other',
}

function materialTypeOf(asset: UploadedAsset): MaterialType {
  const m = ROLE_TO_MATERIAL[asset.kind]
  if (m) return m
  if (asset.kind === 'audio') return 'audio'
  if (asset.kind === 'video') return 'video'
  if (asset.kind === 'image') return 'other'
  if (asset.kind === 'epub' || asset.kind === 'docx' || asset.kind === 'pptx') return 'lesson_book'
  return 'other'
}

export interface GraphClassification {
  file_id: string
  file_name: string
  file_type: MaterialType
  confidence: number
}

export interface ExerciseRef {
  exercise_id: string
  chapter: string
  section: string
  exercise_title: string
  exercise_type: string
  page: number
}

export interface ExerciseItem {
  exercise_item_id: string
  exercise_id: string
  question: string
  answer?: string
  position: number
  page?: string
}

export type RelType =
  | 'exercise_to_audio'
  | 'exercise_to_video'
  | 'exercise_to_solution'
  | 'exercise_to_reading'
  | 'chapter_match'
  | 'exercise_number_match'

export interface ResourceLink {
  relationship: RelType
  from: string
  to: string
  confidence: number
  rationale: string
}

export interface KnowledgeGraphNode {
  id: string
  type: 'exercise' | 'audio' | 'video' | 'solution' | 'chapter'
  label: string
}
export interface KnowledgeGraphLink {
  from: string
  to: string
  type: RelType
  confidence: number
}
export interface QualityReport {
  exercises_extracted: number
  orphan_audio: number
  orphan_video: number
  duplicate_exercises: number
  missing_solutions: number
  issues: string[]
}

export interface LearningMaterialGraph {
  classifications: GraphClassification[]
  exercises: ExerciseRef[]
  items: ExerciseItem[]
  resourceLinks: ResourceLink[]
  knowledgeGraph: { nodes: KnowledgeGraphNode[]; links: KnowledgeGraphLink[] }
  quality: QualityReport
}

export const LMRE_PROMPT = `# Role

You are Woodpacker's Learning Material Intelligence Agent.

Your responsibility is to transform uploaded learning materials into a structured, connected, and searchable learning system.

You do NOT simply extract text.

You must understand the relationships between books, exercises, solutions, audio files, videos, transcripts, teacher manuals, vocabulary lists, and supplementary materials.

Your goal is to reconstruct the original learning experience intended by the textbook authors.

# Core Principle

Learning materials are never analyzed independently. All uploaded files belong to a single learning ecosystem. The system must discover and connect these relationships automatically.

# Output Contract

You produce exactly:

{
  "classifications": [
    { "file_id": "string", "file_name": "string", "file_type": "string", "confidence": 0.0 }
  ],
  "exercises": [
    { "exercise_id": "string", "chapter": "string", "section": "string", "exercise_title": "string", "exercise_type": "string", "page": 0 }
  ],
  "items": [
    { "exercise_item_id": "string", "exercise_id": "string", "question": "string", "answer": "string", "position": 0, "page": "string" }
  ],
  "resourceLinks": [
    { "relationship": "string", "from": "string", "to": "string", "confidence": 0.0, "rationale": "string" }
  ],
  "knowledgeGraph": {
    "nodes": [{ "id": "string", "type": "string", "label": "string" }],
    "links": [{ "from": "string", "to": "string", "type": "string", "confidence": 0.0 }]
  },
  "quality": {
    "exercises_extracted": 0,
    "orphan_audio": 0,
    "orphan_video": 0,
    "duplicate_exercises": 0,
    "missing_solutions": 0,
    "issues": ["string"]
  }
}

# Rules

- Exercise titles are categories, NOT flashcards. Learning units are the exercise items beneath them.
- Extract every individual question. Split multi-question prompts into individual items.
- Link audio references ("Hören Sie Track 12", "CD 2 Track 5") to the matching audio file.
- Link video references ("Video 5") to the matching video file.
- Link solution references ("Lösung Seite 210", "Im Lehrerhandbuch") to handbooks/reference files.
- Match chapters by number AND title across books; match exercises by number across exercise/solutions books.
- Every detected relationship must receive a confidence score 0-1. Below 0.70 → mark for verification.
- Quality control: no orphan audio/video, no duplicate exercises, every solution searched.`

function pageNum(page?: string): number {
  if (!page) return 0
  const m = page.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

function chapterName(path: string | undefined): string {
  if (!path) return ''
  return path.split('/').pop() || path
}

const QUESTION_HEAD_RE = /^(?:\d{1,3}[.)]|[a-z][.)])\s+/

function extractExerciseItems(exerciseId: string, prompt: string): ExerciseItem[] {
  const lines = (prompt ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) {
    return [{ exercise_item_id: `${exerciseId}-q0`, exercise_id: exerciseId, question: prompt ?? '', position: 0 }]
  }
  // If the prompt has no numbered items, treat the whole prompt as one item.
  if (!lines.some((l) => QUESTION_HEAD_RE.test(l))) {
    return [{ exercise_item_id: `${exerciseId}-q0`, exercise_id: exerciseId, question: lines.join(' '), position: 0 }]
  }
  const items: ExerciseItem[] = []
  let current: string[] = []
  let pos = 0
  const flush = () => {
    if (current.length) {
      items.push({
        exercise_item_id: `${exerciseId}-q${pos}`,
        exercise_id: exerciseId,
        question: current.join(' ').trim(),
        position: pos,
      })
      current = []
    }
  }
  for (const line of lines) {
    if (QUESTION_HEAD_RE.test(line)) {
      pos++
      flush()
      current = [line.replace(/^(?:\d{1,3}[.)]|[a-z][.)])\s+/, '')]
    } else {
      current.push(line)
    }
  }
  pos++
  flush()
  return items
}

function refMatchesFile(fileRef: ReturnType<typeof matchMediaNumbers>, numbers: number[]): boolean {
  const [first, second] = numbers
  if (first === undefined) return false
  const fileChapter = fileRef.chapter ? Number(fileRef.chapter) : undefined
  const fileTrack = fileRef.track ? Number(fileRef.track) : undefined
  if (first === fileTrack || first === fileChapter) return true
  if (second !== undefined && (second === fileTrack || second === fileChapter)) return true
  if (fileChapter !== undefined && fileTrack !== undefined && Number(`${fileChapter}${fileTrack}`) === first) return true
  return false
}

interface ChapterHeading { number: string; title: string }
function headingsOf(text: string): ChapterHeading[] {
  return detectChapters(text.split('\n'))
    .map((c) => ({ number: chapterNumberFromTitle(c.title), title: c.title }))
    .filter((c) => c.title)
}

export function buildMaterialGraph(
  assets: UploadedAsset[],
  classifications?: Record<string, AssetClassification> | null
): LearningMaterialGraph {
  const clsMap = classifications ?? {}

  const classificationsOut: GraphClassification[] = assets.map((a) => {
    const ai = clsMap[a.id]
    const role: MaterialType = ai ? (ROLE_TO_MATERIAL[ai.role] ?? materialTypeOf(a)) : materialTypeOf(a)
    return {
      file_id: a.id,
      file_name: a.name,
      file_type: role,
      confidence: ai ? ai.confidence / 100 : 0.3,
    }
  })

  const media = assets.filter((a) => a.kind === 'audio' || a.kind === 'video')
  const textAssets = assets.filter((a) => Boolean(a.text))

  const exercises: ExerciseRef[] = []
  const items: ExerciseItem[] = []
  const resourceLinks: ResourceLink[] = []
  const nodes: KnowledgeGraphNode[] = []
  const links: KnowledgeGraphLink[] = []
  const seenPrompts = new Map<string, string>()
  const duplicateCount = { value: 0 }
  let missingSolutions = 0

  const mediaLinked = new Set<string>()

  for (const a of textAssets) {
    const found = detectExercises(a.text!)
    found.forEach((ex, i) => {
      const id = `ex-${a.id}-${i}`
      exercises.push({
        exercise_id: id,
        chapter: chapterName(a.path),
        section: ex.name ?? '',
        exercise_title: ex.name ?? '',
        exercise_type: ex.type ?? 'other',
        page: pageNum(ex.page),
      })
      nodes.push({ id, type: 'exercise', label: ex.prompt.slice(0, 80) })

      for (const item of extractExerciseItems(id, ex.prompt ?? '')) {
        items.push(item)
      }

      const key = (ex.prompt ?? '').toLowerCase().replace(/\s+/g, ' ')
      if (seenPrompts.has(key)) {
        duplicateCount.value++
      } else {
        seenPrompts.set(key, id)
      }

      const text = `${ex.name ?? ''} ${ex.prompt ?? ''}`
      const refs = detectTrackRefs(text)
      if (refs.length) {
        for (const ref of refs) {
          for (const m of media) {
            if (ref.kind === 'video' && m.kind !== 'video') continue
            if (ref.kind === 'audio' && m.kind !== 'audio') continue
            if (refMatchesFile(matchMediaNumbers(m.name), ref.numbers)) {
              const rel: RelType = ref.kind === 'video' ? 'exercise_to_video' : 'exercise_to_audio'
              const confidence = ref.numbers.length === 2 ? 0.95 : 0.7
              const rationale = `Reference "${ref.label}" matched to ${m.name}`
              resourceLinks.push({ relationship: rel, from: id, to: m.id, confidence, rationale })
              links.push({ from: id, to: m.id, type: rel, confidence })
              mediaLinked.add(m.id)
              nodes.push({ id: m.id, type: ref.kind, label: m.name })
            }
          }
        }
      }

      if (detectSolutionRef(text)) {
        const handbooks = assets.filter((a2) => a2.kind === 'text' && classifyHandbook(a2))
        if (handbooks.length) {
          for (const hb of handbooks) {
            resourceLinks.push({
              relationship: 'exercise_to_solution',
              from: id,
              to: hb.id,
              confidence: 0.6,
              rationale: `Exercise references solutions ("${text.slice(0, 40)}…") — see ${hb.name}`,
            })
            links.push({ from: id, to: hb.id, type: 'exercise_to_solution', confidence: 0.6 })
            nodes.push({ id: hb.id, type: 'solution', label: hb.name })
          }
        } else {
          missingSolutions++
        }
      }

      for (const label of extractExerciseLabels(text)) {
        // Exercise-number cross-references to other source files carrying the same label.
        for (const other of assets) {
          if (other.id === a.id) continue
          if (!other.text) continue
          if (other.text.toLowerCase().includes(label.toLowerCase())) {
            resourceLinks.push({
              relationship: 'exercise_number_match',
              from: id,
              to: other.id,
              confidence: 0.85,
              rationale: `Shared exercise label "${label}"`,
            })
            links.push({ from: id, to: other.id, type: 'exercise_number_match', confidence: 0.85 })
          }
        }
      }
    })
  }

  for (const m of media) {
    if (!mediaLinked.has(m.id)) {
      nodes.push({ id: m.id, type: m.kind === 'video' ? 'video' : 'audio', label: m.name })
    }
  }

  const orphanAudio = media.filter((m) => m.kind === 'audio' && !mediaLinked.has(m.id)).length
  const orphanVideo = media.filter((m) => m.kind === 'video' && !mediaLinked.has(m.id)).length

  const issues: string[] = []
  if (orphanAudio) issues.push(`${orphanAudio} audio file(s) are not referenced by any exercise`)
  if (orphanVideo) issues.push(`${orphanVideo} video file(s) are not referenced by any exercise`)
  if (duplicateCount.value) issues.push(`${duplicateCount.value} duplicate exercise(s) detected`)
  if (missingSolutions) issues.push(`${missingSolutions} exercise(s) reference a solution but no solution book was found`)

  for (const a of textAssets) {
    for (const other of textAssets) {
      if (other.id <= a.id) continue
      const aHead = headingsOf(a.text!)
      const bHead = headingsOf(other.text!)
      const aNums = new Set(aHead.map((h) => h.number).filter(Boolean))
      const matches: { title: string; confidence: number }[] = []
      for (const b of bHead) {
        if (!b.number) continue
        if (aNums.has(b.number)) {
          matches.push({ title: b.title, confidence: 0.9 })
        }
      }
      for (const m of matches) {
        resourceLinks.push({
          relationship: 'chapter_match',
          from: a.id,
          to: other.id,
          confidence: m.confidence,
          rationale: `Chapter "${m.title}" matched by number across files`,
        })
        links.push({ from: a.id, to: other.id, type: 'chapter_match', confidence: m.confidence })
      }
    }
  }

  const uniqueNodes = new Map<string, KnowledgeGraphNode>()
  for (const n of nodes) {
    if (!uniqueNodes.has(n.id)) uniqueNodes.set(n.id, n)
  }

  const quality: QualityReport = {
    exercises_extracted: exercises.length,
    orphan_audio: orphanAudio,
    orphan_video: orphanVideo,
    duplicate_exercises: duplicateCount.value,
    missing_solutions: missingSolutions,
    issues,
  }

  return {
    classifications: classificationsOut,
    exercises,
    items,
    resourceLinks,
    knowledgeGraph: { nodes: [...uniqueNodes.values()], links },
    quality,
  }
}

function classifyHandbook(asset: UploadedAsset): boolean {
  const hay = `${asset.path ?? ''} ${asset.name}`.toLowerCase()
  return /lösung|lehrerhandbuch|handbuch|teacher|answer ?key|solutions?/i.test(hay)
}
