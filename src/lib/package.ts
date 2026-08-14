import type { Blueprint, ConceptNode, Difficulty, Discovery, Lesson, Module, UploadedAsset } from './types'
import {
  chapterNumberFromTitle,
  classifyFileRole,
  detectConcepts,
  detectGrammar,
  detectDialogues,
  splitSentences,
  grammarDifficultyOf,
  type FileRole,
} from './heuristics'

export interface MediaRef {
  chapter?: string
  track?: string
  label: string
}

export function matchMediaNumbers(name: string): MediaRef {
  const base = name.replace(/\.[^.]+$/, '').toLowerCase()
  const trackPattern = base.match(/(?:track|lektion|kapitel|chapter|unit|lesson|video|cd|dvd)[\s_\-]*(\d+)(?:[\s_\-]+(\d+))?/)
  if (trackPattern) return { chapter: String(Number(trackPattern[1])), track: trackPattern[2] ? String(Number(trackPattern[2])) : undefined, label: name }
  const audioPattern = base.match(/(?:audio|hoer|horen|hoeren|hörtext|hör)[\s_\-]*(\d+)(?:[\s_\-]+(\d+))?/)
  if (audioPattern) return { chapter: String(Number(audioPattern[1])), track: audioPattern[2] ? String(Number(audioPattern[2])) : undefined, label: name }
  const pair = base.match(/[\s_\-](\d+)[\s_\-]+(\d+)$/)
  if (pair) return { chapter: String(Number(pair[1])), track: String(Number(pair[2])), label: name }
  const single = base.match(/[\s_\-](\d+)$/)
  if (single) return { chapter: String(Number(single[1])), label: name }
  return { label: name }
}

export interface ChapterGroup {
  number: string
  title: string
  order: number
  spineBody: string[]
  workbook: { assetId: string; body: string[] }[]
  handbook: { assetId: string; body: string[] }[]
  reference: { assetId: string; body: string[] }[]
  media: UploadedAsset[]
}

export interface PackageModule {
  spine: { assetId: string; name: string }
  chapters: ChapterGroup[]
}

export interface PackagePlan {
  title: string
  description: string
  roles: Map<string, FileRole>
  modules: PackageModule[]
  unmatchedMedia: UploadedAsset[]
}

const ROLE_LABEL: Record<string, string> = {
  textbook: 'Kursbuch',
  workbook: 'Übungsbuch',
  handbook: 'Unterrichtshandbuch',
  reference: 'Reference',
  audio: 'Audio',
  video: 'Video',
  image: 'Image',
  other: 'Other',
}

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role
}

function chaptersOf(discovery: Discovery | undefined): { number: string; title: string; body: string[] }[] {
  if (discovery?.numberedChapters?.length) return discovery.numberedChapters
  const fallback = discovery?.chapters?.length ? discovery.chapters : []
  return fallback.map((title) => ({ number: chapterNumberFromTitle(title), title, body: [] }))
}

function folderName(assets: UploadedAsset[]): string | undefined {
  const withPath = assets.find((a) => a.path)
  return withPath?.path?.split('/')[0]
}

export function buildPackagePlan(assets: UploadedAsset[], discoveries: Discovery[]): PackagePlan {
  const roles = new Map<string, FileRole>()
  const discoveryByAsset = new Map<string, Discovery>()
  for (const d of discoveries) discoveryByAsset.set(d.assetId, d)
  for (const a of assets) roles.set(a.id, classifyFileRole(a))

  const textAssets = assets.filter((a) => a.text)
  const textbooks = textAssets.filter((a) => roles.get(a.id) === 'textbook')
  const spines = textbooks.length ? textbooks : textAssets.filter((a) => roles.get(a.id) !== 'other')

  const modules: PackageModule[] = spines.map((spine) => {
    const groups = new Map<string, ChapterGroup>()
    const ordered: ChapterGroup[] = []
    for (const part of chaptersOf(discoveryByAsset.get(spine.id))) {
      const number = part.number || `part-${ordered.length}`
      const existing = groups.get(number)
      if (existing) {
        existing.spineBody = [...existing.spineBody, ...part.body]
        continue
      }
      const group: ChapterGroup = {
        number: part.number,
        title: part.title,
        order: ordered.length,
        spineBody: part.body,
        workbook: [],
        handbook: [],
        reference: [],
        media: [],
      }
      groups.set(number, group)
      ordered.push(group)
    }
    return { spine: { assetId: spine.id, name: spine.name }, chapters: ordered }
  })

  const primary = modules[0]
  const secondary = textAssets.filter((a) => !spines.some((s) => s.id === a.id))
  for (const asset of secondary) {
    const role = roles.get(asset.id)
    if (role === 'image' || role === 'other') continue
    for (const part of chaptersOf(discoveryByAsset.get(asset.id))) {
      if (!primary) continue
      const group = part.number ? primary.chapters.find((c) => c.number === part.number) : undefined
      if (!group) continue
      if (role === 'workbook') group.workbook.push({ assetId: asset.id, body: part.body })
      else if (role === 'handbook') group.handbook.push({ assetId: asset.id, body: part.body })
      else if (role === 'reference') group.reference.push({ assetId: asset.id, body: part.body })
      else group.spineBody = [...group.spineBody, ...part.body]
    }
  }

  const media = assets.filter((a) => a.kind === 'audio' || a.kind === 'video')
  const unmatchedMedia: UploadedAsset[] = []
  for (const m of media) {
    const ref = matchMediaNumbers(m.name)
    const group = ref.chapter ? primary?.chapters.find((c) => c.number === ref.chapter) : undefined
    if (group) {
      group.media.push(m)
    } else if (primary?.chapters.length) {
      const fallback = ref.chapter ? [...primary.chapters].reverse().find((c) => Number(c.number) <= Number(ref.chapter)) : undefined
      ;(fallback ?? primary.chapters[primary.chapters.length - 1]).media.push(m)
    } else {
      unmatchedMedia.push(m)
    }
  }

  const folder = folderName(assets)
  const spineLabel = spines[0]?.name.replace(/\.[^.]+$/, '') ?? 'Course'
  const title = folder ?? spineLabel
  const count = (role: FileRole) => assets.filter((a) => roles.get(a.id) === role).length
  const description = [
    `Reconstructed from ${assets.length} file(s)`,
    count('textbook') ? ` — ${count('textbook')} Kursbuch` : '',
    count('workbook') ? `, ${count('workbook')} Übungsbuch` : '',
    count('handbook') ? `, ${count('handbook')} Unterrichtshandbuch` : '',
    media.length ? `, ${media.length} audio/video track(s)` : '',
    ': chapters, exercises, audio and solutions are connected by chapter number across files.',
  ].join('')

  return {
    title,
    description,
    roles,
    modules,
    unmatchedMedia,
  }
}

function difficultyOf(grammar: { name: string }[]): Difficulty {
  if (grammar.some((g) => grammarDifficultyOf(g.name) === 'advanced')) return 'advanced'
  if (grammar.some((g) => grammarDifficultyOf(g.name) === 'intermediate')) return 'intermediate'
  return 'beginner'
}

export function reconstructBlueprint(assets: UploadedAsset[], discoveries: Discovery[]): Blueprint {
  const plan = buildPackagePlan(assets, discoveries)
  const modules: Module[] = []
  const concepts: ConceptNode[] = []
  const conceptsByName = new Map<string, ConceptNode>()
  const duplicates: Blueprint['duplicates'] = []
  const path: Blueprint['path'] = []
  let lessonCounter = 0
  let conceptCounter = 0

  for (const mod of plan.modules) {
    const m: Module = {
      id: `m-${mod.spine.assetId}`,
      title: mod.spine.name.replace(/\.[^.]+$/, ''),
      description: `Spine — ${mod.spine.name}`,
      difficulty: 'beginner',
      lessons: [],
      review: null,
    }
    for (const group of mod.chapters) {
      const body = [...group.spineBody, ...group.workbook.flatMap((w) => w.body)].join('\n')
      const grammar = detectGrammar(body)
      const difficulty = difficultyOf(grammar)
      const conceptIds: string[] = []
      for (const c of detectConcepts(body).slice(0, 8)) {
        const existing = conceptsByName.get(c.name.toLowerCase())
        if (existing) {
          conceptIds.push(existing.id)
          continue
        }
        const node: ConceptNode = {
          id: `c-${conceptCounter++}`,
          name: c.name,
          definition: c.definition,
          difficulty,
          parentIds: [],
          prerequisiteIds: [],
          relatedIds: [],
          sourceAssets: [mod.spine.assetId, ...group.workbook.map((w) => w.assetId), ...group.handbook.map((h) => h.assetId)],
        }
        concepts.push(node)
        conceptsByName.set(c.name.toLowerCase(), node)
        conceptIds.push(node.id)
      }
      const sourceAssets = new Set<string>([mod.spine.assetId])
      for (const w of group.workbook) sourceAssets.add(w.assetId)
      for (const h of group.handbook) sourceAssets.add(h.assetId)
      for (const r of group.reference) sourceAssets.add(r.assetId)
      for (const media of group.media) sourceAssets.add(media.id)
      for (const media of plan.unmatchedMedia) sourceAssets.add(media.id)
      const lesson: Lesson = {
        id: `l-${lessonCounter++}`,
        title: group.title,
        objectives: [],
        difficulty,
        conceptIds,
        vocabulary: [],
        grammar: [],
        exercises: [],
        materials: { speaking: { roleplays: [], drills: [], recalls: [] }, writing: { prompts: [], criteria: [] } },
        sourceAssets: [...sourceAssets],
      }
      m.lessons.push(lesson)
      const linked = [
        ...group.workbook.map((w) => `${w.assetId}:#${group.number || group.title}`),
        ...group.handbook.map((h) => `${h.assetId}:#${group.number || group.title}`),
        ...group.media.map((media) => `${media.id}:#${group.number || group.title}`),
      ]
      if (linked.length) {
        duplicates.push({
          kind: 'chapter',
          items: linked,
          kept: lesson.id,
          rationale: `Workbook exercises, handbook notes and audio tracks for chapter ${group.number || group.title} merged into the matching lesson.`,
        })
      }
    }
    if (m.lessons.length) {
      m.difficulty = difficultyOf(m.lessons.flatMap((l) => l.grammar.map((g) => ({ name: g.name }))))
    }
    m.review = { title: `${m.title} — Review`, exercises: [] }
    modules.push(m)
  }

  const modLessons = modules.flatMap((m) => m.lessons)
  for (let i = 0; i < modLessons.length; i++) {
    const current = modLessons[i].conceptIds
    for (let j = 0; j < current.length; j++) {
      for (let k = j + 1; k < current.length; k++) {
        const a = concepts.find((c) => c.id === current[j])
        const b = concepts.find((c) => c.id === current[k])
        if (a && b && !a.relatedIds.includes(b.id)) a.relatedIds.push(b.id)
        if (b && a && !b.relatedIds.includes(a.id)) b.relatedIds.push(a.id)
      }
    }
    if (i + 1 < modLessons.length) {
      const anchor = current[current.length - 1]
      const next = modLessons[i + 1].conceptIds[0]
      const from = concepts.find((c) => c.id === anchor)
      const to = concepts.find((c) => c.id === next)
      if (from && to && !to.prerequisiteIds.includes(from.id)) to.prerequisiteIds.push(from.id)
    }
  }

  for (const m of modules) path.push({ id: m.id, title: m.title, type: 'module', prerequisites: [] })
  for (const m of modules) path.push({ id: `r-${m.id}`, title: `${m.title} — Review`, type: 'review', prerequisites: [m.id] })
  path.push({ id: 'final', title: 'Final Assessment', type: 'assessment', prerequisites: modules.map((m) => m.id) })

  return {
    title: plan.title,
    description: plan.description,
    language: undefined,
    modules: modules.map((m) => ({
      title: m.title,
      description: m.description,
      difficulty: m.difficulty,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        objectives: l.objectives,
        conceptIds: l.conceptIds,
        difficulty: l.difficulty,
        sourceAssets: l.sourceAssets,
        number: plan.modules.flatMap((pm) => pm.chapters).find((c) => c.title === l.title)?.number,
      })),
    })),
    concepts,
    duplicates: duplicates.filter((d) => d.items.length > 0),
    path,
  }
}

export function chapterGroupFor(lessonTitle: string, plan: PackagePlan): ChapterGroup | undefined {
  return plan.modules.flatMap((m) => m.chapters).find((c) => c.title === lessonTitle)
}

export function lessonBody(group: ChapterGroup | undefined): string {
  return [group?.spineBody ?? [], ...(group?.workbook.map((w) => w.body) ?? [])].flat().join('\n')
}

export function lessonContext(group: ChapterGroup | undefined): { sentences: string[]; dialogues: string[]; solutions: string[]; teacherNotes: string[] } {
  const body = lessonBody(group)
  const handbookText = group?.handbook.map((h) => h.body.join('\n')).join('\n\n') ?? ''
  return {
    sentences: splitSentences(body).slice(0, 60),
    dialogues: detectDialogues(body),
    solutions: handbookText ? splitSentences(handbookText).slice(0, 40) : [],
    teacherNotes: handbookText ? [handbookText.slice(0, 4000)] : [],
  }
}