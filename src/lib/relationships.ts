import type { Exercise, UploadedAsset } from './types'
import { matchMediaNumbers, type ChapterGroup } from './package'

/**
 * Learning Material Relationship Engine.
 *
 * Implements the spec in `Context Files/LEARNING_MATERIAL_RELATIONSHIP_ENGINE.md`:
 * the AI does NOT treat files independently. It builds a graph of relationships
 * between all uploaded materials and links every exercise to the resources it
 * requires (audio, video, readings, solutions).
 */

export interface TrackRef {
  /** 'audio' or 'video' — which media kind the keyword refers to. */
  kind: 'audio' | 'video'
  /** Numbers extracted from the reference, e.g. "Track 1.07" → [1, 7]. */
  numbers: number[]
  label: string
}

const TRACK_KEYWORDS =
  /\b(track|spur|cd|dvd|lektion|kapitel|chapter|unit|lesson|hörtext|hoertext|hör|hoer|audio|video|film|ausschnitt)\b[\s,:;.]*(\d{1,3})(?:[\s.,\-–]+(\d{1,3}))?(?:[\s.,\-–]+(\d{1,3}))?/gi

const VIDEO_KEYWORDS = /\b(video|film|ausschnitt)\b/i

const PAGE_REF_PATTERN = /\b(?:seite|page|s\.|p\.|pg\.)\s*(\d{1,4})\b/gi

const SOLUTION_REF_PATTERN =
  /\b(lösung|loesung|lösungen|loesungen|solution|solutions|antwort|antworten|answers?|schlüssel|schluessel|key\b|lehrerhandbuch|unterrichtshandbuch|handbuch)\b/i

const READING_PATTERN =
  /\b(?:lesen?|liest|read|reading|text|passage|artikel|story|geschichte|dialog|gespräch|abschnitt|seite|page)\b/i

const EXERCISE_LABEL_PATTERN =
  /(?:aufgabe|übung|exercise|exercice|actividad|task|nr\.?|nummer|no\.?)\s*(\d{1,3}[a-z]?(?:\s*[./-]\s*[1-9]\d{0,2}[a-z]?)?)/gi

const EXERCISE_BARE_LABEL = /\b(\d{1,3}[a-z]?(?:\s*[./-]\s*[1-9]\d{0,2}[a-z]?)?)\b/g

/** Extracts track/video references from exercise text, e.g. "Hören Sie Track 12" → [{kind:'audio', numbers:[12]}]. */
export function detectTrackRefs(text: string): TrackRef[] {
  const refs: TrackRef[] = []
  const re = new RegExp(TRACK_KEYWORDS.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const keyword = m[1]
    const numbers = [m[2], m[3], m[4]]
      .filter((n): n is string => !!n)
      .map((n) => parseInt(n.replace(/\D/g, ''), 10))
      .filter((n) => !Number.isNaN(n) && n > 0)
    if (!numbers.length) continue
    refs.push({
      kind: VIDEO_KEYWORDS.test(keyword) ? 'video' : 'audio',
      numbers,
      label: m[0].trim(),
    })
  }
  return refs
}

/** Extracts "Seite 45" / "S. 45" / "p. 45" style page references. */
export function detectPageRefs(text: string): number[] {
  const pages: number[] = []
  const re = new RegExp(PAGE_REF_PATTERN.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10)
    if (!Number.isNaN(n) && n > 0) pages.push(n)
  }
  return pages
}

/** True when the text points at a solution handbook ("Lösung im Lehrerhandbuch"). */
export function detectSolutionRef(text: string): boolean {
  return SOLUTION_REF_PATTERN.test(text)
}

/** True when the text points at a reading passage ("Lesen Sie den Text", "Siehe Seite 45"). */
export function detectReadingRef(text: string): boolean {
  return READING_PATTERN.test(text)
}

/** Extracts exercise labels such as "Aufgabe 5a", "Übung 3b", "2A/1" from text. */
export function extractExerciseLabels(text: string): string[] {
  const labels = new Set<string>()
  const re = new RegExp(EXERCISE_LABEL_PATTERN.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    labels.add(m[1].replace(/\s+/g, ' ').trim())
  }
  const bare = new RegExp(EXERCISE_BARE_LABEL.source, 'g')
  while ((m = bare.exec(text)) !== null) {
    const candidate = m[1].trim()
    if (/^\d{1,3}[a-z]?([./-]\s*[1-9]\d{0,2}[a-z]?)?$/.test(candidate)) labels.add(candidate)
  }
  const all = [...labels].filter(Boolean)
  const deduped: string[] = []
  for (const l of [...all].sort((a, b) => b.length - a.length)) {
    if (deduped.some((d) => d.toLowerCase().includes(l.toLowerCase()))) continue
    deduped.push(l)
  }
  return deduped.slice(0, 6)
}

function refMatchesFile(fileRef: ReturnType<typeof matchMediaNumbers>, numbers: number[]): boolean {
  const [first, second] = numbers
  if (first === undefined) return false
  if (second !== undefined) {
    const fileChapter = fileRef.chapter ? Number(fileRef.chapter) : undefined
    const fileTrack = fileRef.track ? Number(fileRef.track) : undefined
    if (fileChapter === first && fileTrack === second) return true
    if (fileTrack === second) return true
    if (fileTrack === first && fileChapter === second) return true
  }
  const fileChapter = fileRef.chapter ? Number(fileRef.chapter) : undefined
  const fileTrack = fileRef.track ? Number(fileRef.track) : undefined
  if (fileTrack === first) return true
  if (fileChapter === first) return true
  if (fileChapter !== undefined && fileTrack !== undefined && Number(`${fileChapter}${fileTrack}`) === first) return true
  return false
}

/**
 * Pulls solution snippets out of handbook/reference bodies by matching exercise labels.
 * Searches the chapter group first, then falls back to every other handbook/reference
 * source in the package (spec: search ALL uploaded files).
 */
function findSolutions(exercise: Exercise, group: ChapterGroup | undefined, packageSources?: { assetId: string; body: string[] }[]): string[] {
  const dedupeById = new Map<string, { assetId: string; body: string[] }>()
  for (const h of group?.handbook ?? []) dedupeById.set(h.assetId, h)
  for (const r of group?.reference ?? []) dedupeById.set(r.assetId, r)
  for (const s of packageSources ?? []) dedupeById.set(s.assetId, s)
  const sources = [...dedupeById.values()]
  if (!sources.length) return []
  const rawLabels = [
    ...(exercise.name ? [exercise.name] : []),
    ...extractExerciseLabels(`${exercise.name ?? ''} ${exercise.prompt}`),
  ].filter((l) => l.length >= 2)
  const labels: string[] = []
  for (const l of [...rawLabels].sort((a, b) => b.length - a.length)) {
    if (labels.some((d) => d.toLowerCase().includes(l.toLowerCase()))) continue
    labels.push(l)
  }
  if (!labels.length) return []
  const snippets: string[] = []
  for (const src of sources) {
    const body = src.body.join('\n')
    for (const label of labels) {
      const idx = body.toLowerCase().indexOf(label.toLowerCase())
      if (idx < 0) continue
      const snippet = body
        .slice(idx, idx + 700)
        .split('\n')
        .slice(0, 14)
        .join('\n')
        .trim()
      if (snippet && !snippets.includes(snippet)) snippets.push(snippet)
      if (snippets.length >= 3) return snippets
    }
  }
  return snippets
}

function linkMediaRefs(exercise: Exercise, group: ChapterGroup | undefined, assets: UploadedAsset[]): { requiredAudio: string[]; requiredVideo: string[] } {
  const refs = detectTrackRefs(`${exercise.name ?? ''} ${exercise.prompt}`)
  if (!refs.length) return { requiredAudio: [], requiredVideo: [] }
  const groupMedia = group?.media ?? []
  const seen = new Set<string>(groupMedia.map((m) => m.id))
  const candidates = [
    ...groupMedia,
    ...assets.filter((a) => (a.kind === 'audio' || a.kind === 'video') && !seen.has(a.id)),
  ]
  const requiredAudio: string[] = []
  const requiredVideo: string[] = []
  const audioSeen = new Set<string>()
  const videoSeen = new Set<string>()
  for (const ref of refs) {
    for (const media of candidates) {
      if (ref.kind === 'video' && media.kind !== 'video') continue
      if (ref.kind === 'audio' && media.kind !== 'audio') continue
      if (!refMatchesFile(matchMediaNumbers(media.name), ref.numbers)) continue
      if (ref.kind === 'video') {
        if (!videoSeen.has(media.id)) {
          videoSeen.add(media.id)
          requiredVideo.push(media.id)
        }
      } else if (!audioSeen.has(media.id)) {
        audioSeen.add(media.id)
        requiredAudio.push(media.id)
      }
    }
  }
  return { requiredAudio, requiredVideo }
}

function linkReadings(exercise: Exercise, assets: UploadedAsset[]): string[] {
  const text = `${exercise.name ?? ''} ${exercise.prompt} ${exercise.page ?? ''}`
  if (!detectReadingRef(text)) return []
  const known = new Set(assets.map((a) => a.id))
  const readings = new Set<string>()
  for (const id of exercise.sourceAssets) {
    if (!known.has(id)) continue
    const asset = assets.find((a) => a.id === id)
    if (asset && (asset.kind === 'pdf' || asset.kind === 'docx' || asset.kind === 'epub' || asset.kind === 'pptx')) {
      readings.add(id)
    }
  }
  return [...readings].slice(0, 4)
}

/**
 * Phase 4 — Unified Exercise Object.
 *
 * Searches ALL uploaded materials and links every resource the exercise
 * requires (audio, video, readings, solutions) into a single object.
 */
export function linkExerciseResources(
  exercise: Exercise,
  group: ChapterGroup | undefined,
  assets: UploadedAsset[],
  packageSources?: { assetId: string; body: string[] }[],
): Exercise {
  const { requiredAudio, requiredVideo } = linkMediaRefs(exercise, group, assets)
  const requiredReadings = linkReadings(exercise, assets)
  const solutions = detectSolutionRef(`${exercise.name ?? ''} ${exercise.prompt}`) ? findSolutions(exercise, group, packageSources) : []

  const pageRefs = detectPageRefs(exercise.prompt)
  const page = pageRefs.length && !exercise.page ? `S. ${pageRefs[0]}` : exercise.page

  return {
    ...exercise,
    page,
    requiredAudio: requiredAudio.length ? requiredAudio : undefined,
    requiredVideo: requiredVideo.length ? requiredVideo : undefined,
    requiredReadings: requiredReadings.length ? requiredReadings : undefined,
    solutions: solutions.length ? solutions : undefined,
  }
}