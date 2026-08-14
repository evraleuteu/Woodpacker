import { randomUUID } from 'crypto'
import type { Blueprint, Course, Discovery, Exercise, Lesson, LessonMaterials, Module, TransformJob, UploadedAsset } from './types'
import { chatJson } from './llm'
import { heuristicDiscover, heuristicMaterials, classifyExercise, detectVocabulary, detectGrammar, detectExercises, splitSentences, grammarDifficultyOf } from './heuristics'
import { buildPackagePlan, reconstructBlueprint, chapterGroupFor, lessonBody, lessonContext, type PackagePlan } from './package'

const VALID_EXERCISE_TYPES = ['fill-blank', 'multiple-choice', 'translation', 'recall', 'pattern-drill', 'roleplay', 'comprehension', 'assessment'] as const

const CHUNK_CHARS = 24000
const CONCURRENCY = 4
const MAX_LESSONS = 80
const jobs = new Map<string, TransformJob>()

export function getJob(id: string): TransformJob | undefined {
  return jobs.get(id)
}

function setJob(job: TransformJob, patch: Partial<TransformJob>) {
  Object.assign(job, patch)
}

function sanitizeAssets(raw: unknown[]): UploadedAsset[] {
  return (raw ?? []).slice(0, 24).map((a, i) => {
    const asset = (a ?? {}) as Partial<UploadedAsset>
    const text = typeof asset.text === 'string' ? asset.text.slice(0, 250000) : undefined
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    return {
      id: typeof asset.id === 'string' ? asset.id : `asset-${i}`,
      name: typeof asset.name === 'string' ? asset.name : `file-${i}`,
      kind: (asset.kind as UploadedAsset['kind']) ?? 'unknown',
      mime: typeof asset.mime === 'string' ? asset.mime : '',
      size: typeof asset.size === 'number' ? asset.size : 0,
      path: typeof asset.path === 'string' ? asset.path : undefined,
      text,
      durationSec: typeof asset.durationSec === 'number' ? asset.durationSec : undefined,
      words,
    }
  })
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > CHUNK_CHARS) {
    let cut = remaining.lastIndexOf('\n\n', CHUNK_CHARS)
    if (cut < CHUNK_CHARS / 2) cut = remaining.lastIndexOf('. ', CHUNK_CHARS)
    if (cut < CHUNK_CHARS / 2) cut = CHUNK_CHARS
    chunks.push(remaining.slice(0, cut))
    remaining = remaining.slice(cut)
  }
  if (remaining.trim()) chunks.push(remaining)
  return chunks
}

const DISCOVERY_SYSTEM =
  'You are a course detective working with extracted text from one uploaded study file. ' +
  'Identify the chapter headings EXACTLY as the author wrote them, keeping their numbers (e.g. "Kapitel 3 Arbeit und Beruf", "Unit 2 — Travel"). ' +
  'Never invent, renumber, merge or reorder chapters. Respond ONLY with valid JSON matching: ' +
  '{"chapters":["string"],"topics":["string"],"concepts":[{"name":"string","definition":"string"}],' +
  '"vocabulary":[{"term":"string","definition":"string","example":"string"}],' +
  '"grammar":[{"name":"string","explanation":"string","examples":["string"]}],' +
  '"objectives":["string"],"exercises":[{"type":"string","prompt":"string"}],"dialogues":["string"],"sentences":["string"]}. ' +
  'Extract genuine content only; do not invent. Cap vocabulary at 40 items, concepts at 15, sentences at 60. ' +
  'For audio-only or image-only material, derive sensible items from the file context when possible.'

async function llmDiscover(asset: UploadedAsset): Promise<Discovery | null> {
  const text = asset.text?.trim()
  if (!text) return null
  const system = DISCOVERY_SYSTEM
  const merged: Partial<Discovery> = {}
  const chunks = chunkText(text)
  type RawDiscovery = Partial<{
    chapters: (string | { title: string })[]
    topics: string[]
    concepts: { name: string; definition?: string }[]
    vocabulary: { term: string; definition?: string; example?: string }[]
    grammar: { name: string; explanation?: string; examples: string[] }[]
    objectives: string[]
    exercises: { type: string; prompt: string }[]
    dialogues: string[]
    sentences: string[]
  }>
  for (const [index, chunk] of chunks.entries()) {
    const header =
      chunks.length > 1
        ? `FILE: ${asset.name}\nThis is chunk ${index + 1} of ${chunks.length} of the extracted text. Analyze this portion.\n\n`
        : `FILE: ${asset.name}\n\n`
    const result = await withRetry(() =>
      chatJson<RawDiscovery>(
        system,
        `${header}EXTRACTED TEXT:\n${chunk}\n\nReturn the extraction JSON.`
      )
    )
    merged.chapters = [...(merged.chapters ?? []), ...(result.chapters ?? []).map((c) => (typeof c === 'string' ? c : (c?.title ?? '')))]
    merged.topics = [...(merged.topics ?? []), ...(result.topics ?? [])]
    merged.concepts = [...(merged.concepts ?? []), ...(result.concepts ?? [])]
    merged.vocabulary = [...(merged.vocabulary ?? []), ...(result.vocabulary ?? [])]
    merged.grammar = [...(merged.grammar ?? []), ...(result.grammar ?? [])]
    merged.objectives = [...(merged.objectives ?? []), ...(result.objectives ?? [])]
    merged.exercises = [...(merged.exercises ?? []), ...(result.exercises ?? [])]
    merged.dialogues = [...(merged.dialogues ?? []), ...(result.dialogues ?? [])]
    merged.sentences = [...(merged.sentences ?? []), ...(result.sentences ?? [])]
  }
  const dedupe = <T>(arr: T[], key: (x: T) => string): T[] => {
    const seen = new Set<string>()
    return arr.filter((x) => {
      const k = key(x)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  return {
    assetId: asset.id,
    assetName: asset.name,
    chapters: dedupe((merged.chapters ?? []).filter(Boolean), (c) => c.toLowerCase()),
    topics: dedupe((merged.topics ?? []).filter(Boolean), (t) => t.toLowerCase()),
    concepts: dedupe((merged.concepts ?? []).filter((c) => c?.name), (c) => c.name.toLowerCase()).slice(0, 20),
    vocabulary: dedupe((merged.vocabulary ?? []).filter((v) => v?.term), (v) => v.term.toLowerCase()).slice(0, 60),
    grammar: dedupe((merged.grammar ?? []).filter((g) => g?.name), (g) => g.name.toLowerCase()).slice(0, 12),
    objectives: dedupe((merged.objectives ?? []).filter(Boolean), (o) => o.toLowerCase()).slice(0, 15),
    exercises: dedupe((merged.exercises ?? []).filter((e) => e?.prompt), (e) => e.prompt.toLowerCase()).slice(0, 25),
    dialogues: dedupe((merged.dialogues ?? []).filter(Boolean), (d) => d.toLowerCase()).slice(0, 8),
    sentences: dedupe((merged.sentences ?? []).filter(Boolean), (s) => s.toLowerCase()).slice(0, 80),
  }
}

const RECONSTRUCT_SYSTEM =
  'You are a course detective. The uploaded files are connected parts of a single learning package ' +
  '(Kursbuch, Übungsbuch, Unterrichtshandbuch, audio/video tracks). ' +
  'Reconstruct the author\'s course: identify the main textbook (the spine), match chapters across files by number and title, ' +
  'and attach workbook exercises, handbook solutions and media tracks to the matching chapter. ' +
  'Do NOT create a new course. Do NOT invent chapters, modules, learning paths or content. Lessons ARE the author\'s chapters, in original order. ' +
  'Respond ONLY with valid JSON matching: ' +
  '{"title":"string","description":"string","language":"string",' +
  '"modules":[{"title":"string","description":"string","difficulty":"beginner|intermediate|advanced",' +
  '"lessons":[{"title":"string","objectives":["string"],"conceptIds":["string"],"difficulty":"beginner|intermediate|advanced","sourceAssets":["string"]}]}],' +
  '"concepts":[{"id":"string","name":"string","definition":"string","difficulty":"beginner|intermediate|advanced",' +
  '"parentIds":["string"],"prerequisiteIds":["string"],"relatedIds":["string"]}],' +
  '"duplicates":[{"kind":"string","items":["string"],"kept":"string","rationale":"string"}],' +
  '"path":[{"id":"string","title":"string","type":"module|lesson|review|assessment","prerequisites":["string"]}]}. ' +
  'Rules: lesson titles are the author\'s chapter headings verbatim, in the order they appear in the textbook. ' +
  'sourceAssets references the assetIds of every file that belongs to that chapter (workbook, handbook, audio, video). ' +
  'Concept ids must be stable strings and conceptIds in lessons must reference them. Prerequisite graph must be acyclic.'

async function llmReconstruct(discoveries: Discovery[]): Promise<Blueprint | null> {
  if (!discoveries.length) return null
  const summary = discoveries.map((d) => ({
    file: d.assetName,
    chapters: d.chapters.slice(0, 30),
    topics: d.topics.slice(0, 12),
    concepts: d.concepts.slice(0, 15).map((c) => c.name),
    vocabulary: d.vocabulary.slice(0, 25).map((v) => v.term),
    grammar: d.grammar.slice(0, 8).map((g) => g.name),
    objectives: d.objectives.slice(0, 6),
    exercises: d.exercises.length,
    dialogues: d.dialogues.length,
  }))
  const result = await withRetry(() =>
    chatJson<Blueprint>(
      RECONSTRUCT_SYSTEM,
      `FILES IN THE PACKAGE:\n${JSON.stringify(summary)}\n\nReturn the reconstructed course JSON.`
    )
  )
  result.modules = (result.modules ?? []).slice(0, 8)
  for (const m of result.modules) m.lessons = (m.lessons ?? []).slice(0, 30)
  let total = 0
  for (const m of result.modules) {
    total += m.lessons.length
    if (total > MAX_LESSONS) {
      m.lessons = m.lessons.slice(0, Math.max(0, MAX_LESSONS - (total - m.lessons.length)))
    }
  }
  return result
}

const MATERIALS_SYSTEM =
  'You are a learning content generator (Woodpecker Learning Engine). Generate complete learning materials for one lesson. ' +
  'Respond ONLY with valid JSON matching: ' +
  '{"vocabulary":[{"term":"string","definition":"string","examples":["string"],"synonyms":["string"],"pronunciation":"string"}],' +
  '"grammar":[{"name":"string","explanation":"string","examples":["string"],"commonMistakes":["string"]}],' +
  '"reading":{"title":"string","passage":"string","questions":["string"]},' +
  '"listening":{"title":"string","transcript":"string","questions":["string"]},' +
  '"speaking":{"roleplays":["string"],"drills":["string"],"recalls":["string"]},' +
  '"writing":{"prompts":["string"],"criteria":["string"]},' +
  '"exercises":[{"type":"fill-blank|multiple-choice|translation|recall|pattern-drill|roleplay|comprehension|assessment",' +
  '"prompt":"string","answer":"string","options":["string"]}]}. ' +
  'Use only content from the provided lesson blueprint and source material. Every exercise must be answerable. ' +
  'Cap at 12 vocabulary, 3 grammar rules, 8 exercises.'

async function llmMaterials(lesson: { title: string; objectives: string[]; conceptIds: string[]; difficulty: Lesson['difficulty'] }, discovery: Discovery | undefined): Promise<LessonMaterials & { vocabulary: { term: string; definition?: string; examples: string[]; synonyms: string[]; pronunciation?: string }[]; grammar: { name: string; explanation: string; examples: string[]; commonMistakes: string[] }[]; exercises: { type: Lesson['exercises'][number]['type']; prompt: string; answer?: string; options?: string[] }[] } | null> {
  const blueprint = {
    lesson: lesson.title,
    objectives: lesson.objectives,
    conceptIds: lesson.conceptIds,
    difficulty: lesson.difficulty,
  }
  const sourceText = discovery ? { file: discovery.assetName, sentences: discovery.sentences.slice(0, 40), dialogues: discovery.dialogues } : null
  return withRetry(() =>
    chatJson(MATERIALS_SYSTEM, `LESSON BLUEPRINT:\n${JSON.stringify(blueprint)}\n\nSOURCE MATERIAL:\n${JSON.stringify(sourceText)}\n\nReturn the lesson materials JSON.`)
  )
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

function assembleCourse(assets: UploadedAsset[], discoveries: Discovery[], blueprint: Blueprint, materialsMap: Map<string, Awaited<ReturnType<typeof llmMaterials>>>, mode: 'ai' | 'local', plan: PackagePlan): Course {
  const conceptById = new Map(blueprint.concepts.map((c) => [c.id, c]))
  const modules: Module[] = blueprint.modules.map((m, mi) => {
    const planModule = plan.modules[mi]
    const lessons: Lesson[] = m.lessons.map((l, li) => {
      const group = chapterGroupFor(l.title, plan)
      const groupAssets = new Set<string>([
        planModule?.spine.assetId ?? '',
        ...(group?.workbook.map((w) => w.assetId) ?? []),
        ...(group?.handbook.map((h) => h.assetId) ?? []),
        ...(group?.reference.map((r) => r.assetId) ?? []),
        ...(group?.media.map((media) => media.id) ?? []),
      ])
      const sourceAssets = [...new Set([...(l.sourceAssets ?? []), ...groupAssets])].filter(Boolean)
      const fallbackAssets = sourceAssets.length ? sourceAssets : discoveries.map((d) => d.assetId)
      const generated = materialsMap.get(l.title.toLowerCase())
      const baseLesson: Lesson = {
        id: l.id ?? `l-${mi}-${li}`,
        title: l.title,
        objectives: l.objectives ?? [],
        difficulty: l.difficulty ?? 'beginner',
        conceptIds: l.conceptIds ?? [],
        vocabulary: [],
        grammar: [],
        exercises: [],
        materials: { speaking: { roleplays: [], drills: [], recalls: [] }, writing: { prompts: [], criteria: [] } },
        sourceAssets: fallbackAssets,
      }
      if (generated) {
        baseLesson.vocabulary = (generated.vocabulary ?? []).map((v, i) => ({
          id: `v-${mi}-${li}-${i}`,
          term: v.term,
          definition: v.definition,
          examples: (v.examples ?? []).slice(0, 3),
          synonyms: (v.synonyms ?? []).slice(0, 4),
          pronunciation: v.pronunciation,
          sourceAssets: fallbackAssets,
          frequency: 1,
        }))
        baseLesson.grammar = (generated.grammar ?? []).map((g, i) => ({
          id: `g-${mi}-${li}-${i}`,
          name: g.name,
          explanation: g.explanation,
          examples: (g.examples ?? []).slice(0, 3),
          commonMistakes: (g.commonMistakes ?? []).slice(0, 3),
          difficulty: baseLesson.difficulty,
          sourceAssets: fallbackAssets,
        }))
        baseLesson.exercises = (generated.exercises ?? []).map((e, i) => ({
          id: `e-${mi}-${li}-${i}`,
          type: e.type,
          prompt: e.prompt,
          answer: e.answer,
          options: e.options,
          sourceAssets: fallbackAssets,
        }))
        baseLesson.materials = {
          reading: generated.reading,
          listening: generated.listening,
          speaking: {
            roleplays: (generated.speaking?.roleplays ?? []).slice(0, 4),
            drills: (generated.speaking?.drills ?? []).slice(0, 4),
            recalls: (generated.speaking?.recalls ?? []).slice(0, 4),
          },
          writing: {
            prompts: (generated.writing?.prompts ?? []).slice(0, 4),
            criteria: (generated.writing?.criteria ?? []).slice(0, 4),
          },
          solutions: generated.solutions,
          teacherNotes: generated.teacherNotes,
        }
      } else {
        const body = lessonBody(group)
        const context = lessonContext(group)
        const spineDiscovery = discoveries.find((d) => d.assetId === planModule?.spine.assetId)
        const chapterVocab = group ? detectVocabulary(body) : []
        const srcVocabulary = chapterVocab.length >= 3 ? chapterVocab : spineDiscovery?.vocabulary ?? []
        const srcGrammar = group ? detectGrammar(body) : spineDiscovery?.grammar ?? []
        const srcExercises = group ? detectExercises(body) : spineDiscovery?.exercises ?? []
        if (!baseLesson.objectives.length) {
          baseLesson.objectives = splitSentences(body)
            .filter((s) => /\b(learn|will be able|understand|practise|practice|know how to|use|sprechen|lesen|hören|schreiben)\b/i.test(s))
            .slice(0, 3)
        }
        baseLesson.vocabulary = srcVocabulary.slice(0, 12).map((v, i) => ({
          id: `v-${mi}-${li}-${i}`,
          term: v.term,
          definition: v.definition,
          examples: [v.example, context.sentences.find((s) => s.toLowerCase().includes(v.term.toLowerCase()))].filter(Boolean) as string[],
          synonyms: [],
          pronunciation: undefined,
          sourceAssets: fallbackAssets,
          frequency: 1,
        }))
        baseLesson.grammar = srcGrammar.slice(0, 4).map((g, i) => ({
          id: `g-${mi}-${li}-${i}`,
          name: g.name,
          explanation: g.explanation ?? `Focus on ${g.name}.`,
          examples: g.examples.slice(0, 3),
          commonMistakes: [],
          difficulty: grammarDifficultyOf(g.name),
          sourceAssets: fallbackAssets,
        }))
        baseLesson.exercises = srcExercises.slice(0, 8).map((e, i) => ({
          id: `e-${mi}-${li}-${i}`,
          type: (VALID_EXERCISE_TYPES as readonly string[]).includes(e.type) ? (e.type as Exercise['type']) : classifyExercise(e.prompt).type,
          prompt: e.prompt,
          sourceAssets: fallbackAssets,
        }))
        baseLesson.materials = heuristicMaterials(baseLesson, discoveries, context)
      }
      return baseLesson
    })
    const reviewExercises: Module['review'] = {
      title: `${m.title} — Review`,
      exercises: lessons.flatMap((l) => l.exercises.slice(0, 2)).slice(0, 8),
    }
    return { id: `m-${mi}`, title: m.title, description: m.description ?? '', difficulty: m.difficulty ?? 'beginner', lessons, review: reviewExercises }
  })

  const concepts = blueprint.concepts.map((c) => {
    const concept = conceptById.get(c.id)
    return {
      ...c,
      definition: concept?.definition,
      sourceAssets: discoveries.filter((d) => (d.concepts ?? []).some((dc) => dc.name.toLowerCase() === c.name.toLowerCase())).map((d) => d.assetId),
    }
  })

  const edges: Course['edges'] = []
  for (const c of concepts) {
    for (const parent of c.parentIds) edges.push({ from: parent, to: c.id, type: 'parent' })
    for (const prereq of c.prerequisiteIds) edges.push({ from: prereq, to: c.id, type: 'prerequisite' })
    for (const related of c.relatedIds) edges.push({ from: c.id, to: related, type: 'related' })
  }

  const uniqueEdges = new Map<string, Course['edges'][number]>()
  for (const e of edges) {
    const key = `${e.from}->${e.to}->${e.type}`
    if (!uniqueEdges.has(key)) uniqueEdges.set(key, e)
  }

  const allVocabCount = modules.reduce((sum, m) => sum + m.lessons.reduce((s, l) => s + l.vocabulary.length, 0), 0)
  const allGrammarCount = modules.reduce((sum, m) => sum + m.lessons.reduce((s, l) => s + l.grammar.length, 0), 0)
  const allExerciseCount = modules.reduce((sum, m) => sum + m.lessons.reduce((s, l) => s + l.exercises.length, 0), 0)

  const path = blueprint.path.length
    ? blueprint.path
    : [
        ...modules.map((m, i) => ({ id: m.id, title: m.title, type: 'module' as const, prerequisites: i === 0 ? [] : [modules[i - 1].id] })),
        ...modules.map((m) => ({ id: `r-${m.id}`, title: `${m.title} — Review`, type: 'review' as const, prerequisites: [m.id] })),
        { id: 'final', title: 'Final Assessment', type: 'assessment' as const, prerequisites: modules.map((m) => m.id) },
      ]

  return {
    id: randomUUID(),
    title: blueprint.title ?? 'My Learning Course',
    description: blueprint.description ?? '',
    language: blueprint.language,
    createdAt: new Date().toISOString(),
    mode,
    concepts,
    edges: [...uniqueEdges.values()],
    modules,
    duplicates: (blueprint.duplicates ?? []).map((d, i) => ({ ...d, id: `dup-${i}` })),
    path,
    stats: {
      lessons: modules.reduce((s, m) => s + m.lessons.length, 0),
      vocabulary: allVocabCount,
      grammar: allGrammarCount,
      exercises: allExerciseCount,
      concepts: concepts.length,
      duplicatesMerged: (blueprint.duplicates ?? []).length,
    },
    sourceFiles: assets.map((a) => ({ id: a.id, name: a.name, kind: a.kind, words: a.words ?? 0, path: a.path, role: plan.roles.get(a.id) })),
  }
}

export async function runPipeline(job: TransformJob, rawAssets: unknown[]): Promise<void> {
  const assets = sanitizeAssets(rawAssets)
  const withText = assets.filter((a) => a.text)
  const noText = assets.filter((a) => !a.text)
  try {
    setJob(job, { phase: 'content-discovery', progress: 0.08, message: 'Analyzing your materials', detail: 'Extracting chapters, lessons, vocabulary, grammar and skills from every file.' })
    let discoveries: Discovery[]
    let llmOk = true
    try {
      if (!withText.length) throw new Error('no text assets')
      const probe = await llmDiscover(withText[0])
      if (!probe) throw new Error('no text assets')
      llmOk = true
      discoveries = [probe, ...(await mapLimit(withText.slice(1), CONCURRENCY, llmDiscover))].filter(Boolean) as Discovery[]
    } catch {
      llmOk = false
      discoveries = withText.map(heuristicDiscover)
    }
    const finalMode: 'ai' | 'local' = llmOk ? 'ai' : 'local'
    if (noText.length) {
      for (const asset of noText) {
        if (asset.kind === 'audio' || asset.kind === 'video') {
          const name = asset.name.replace(/\.[^.]+$/, '')
          const duration = asset.durationSec ? ` (${Math.round(asset.durationSec / 60)} min)` : ''
          discoveries.push({
            assetId: asset.id,
            assetName: asset.name,
            chapters: [],
            topics: [name],
            concepts: [{ name, definition: `Audio/video track ${name}${duration}` }],
            vocabulary: [],
            grammar: [],
            objectives: [`Listen to ${name} and identify key phrases.`],
            exercises: [],
            dialogues: [],
            sentences: [],
            role: asset.kind === 'audio' ? 'audio' : 'video',
            numberedChapters: [],
          })
        } else if (asset.kind === 'image') {
          const name = asset.name.replace(/\.[^.]+$/, '')
          discoveries.push({
            assetId: asset.id,
            assetName: asset.name,
            chapters: [],
            topics: [name],
            concepts: [{ name, definition: 'Visual material included in this course.' }],
            vocabulary: [],
            grammar: [],
            objectives: [`Describe ${name} using target vocabulary.`],
            exercises: [],
            dialogues: [],
            sentences: [],
            role: 'image',
            numberedChapters: [],
          })
        }
      }
    }
    setJob(job, { phase: 'structure-reconstruction', progress: 0.3, message: 'Reconstructing course structure', detail: 'Connecting files into one learning package — matching chapters, exercises, audio and solutions across Kursbuch, Übungsbuch and Unterrichtshandbuch.' })

    const plan = buildPackagePlan(assets, discoveries)
    let blueprint: Blueprint
    try {
      if (!llmOk) throw new Error('local mode')
      const bp = await llmReconstruct(discoveries)
      if (!bp) throw new Error('empty blueprint')
      blueprint = bp
    } catch {
      blueprint = reconstructBlueprint(assets, discoveries)
    }

    setJob(job, { phase: 'knowledge-graph', progress: 0.45, message: 'Building knowledge graph', detail: `Linking ${blueprint.concepts.length} concepts with prerequisites and relationships.` })
    setJob(job, { phase: 'duplicate-detection', progress: 0.5, message: 'Connecting chapters across files', detail: `Attaching ${blueprint.duplicates.length} file-to-chapter links (exercises, solutions, audio).` })

    setJob(job, { phase: 'material-generation', progress: 0.55, message: 'Generating learning materials', detail: 'Creating vocabulary cards, grammar, reading, listening, speaking, writing and exercises per lesson.' })
    const allLessons = blueprint.modules.flatMap((m) => m.lessons)
    const materialsMap = new Map<string, Awaited<ReturnType<typeof llmMaterials>>>()
    if (llmOk) {
      const generated = await mapLimit(allLessons, CONCURRENCY, async (l) => {
        const discovery = discoveries.find((d) => d.chapters.some((c) => c.toLowerCase() === l.title.toLowerCase()))
        try {
          return await llmMaterials({ title: l.title, objectives: l.objectives, conceptIds: l.conceptIds, difficulty: l.difficulty }, discovery)
        } catch {
          return null
        }
      })
      allLessons.forEach((l, i) => {
        if (generated[i]) materialsMap.set(l.title.toLowerCase(), generated[i])
      })
    }

    setJob(job, { phase: 'dependency-mapping', progress: 0.82, message: 'Mapping dependencies', detail: 'Determining what must be learned before what.' })
    setJob(job, { phase: 'master-tree', progress: 0.9, message: 'Assembling master learning tree', detail: 'Building the course dashboard with reviews and final assessment.' })

    const course = assembleCourse(assets, discoveries, blueprint, materialsMap, finalMode, plan)
    setJob(job, { phase: 'done', progress: 1, status: 'done', mode: finalMode, message: 'Transformation complete', detail: '', result: course })
  } catch (err) {
    setJob(job, { status: 'error', message: 'Transformation failed', detail: err instanceof Error ? err.message : 'Unknown error', error: err instanceof Error ? err.message : 'Unknown error' })
  }
}

export function createJob(rawAssets: unknown[]): TransformJob {
  const job: TransformJob = {
    id: randomUUID(),
    status: 'running',
    phase: 'queued',
    progress: 0,
    message: 'Queued',
    detail: '',
    mode: 'ai',
    createdAt: Date.now(),
  }
  jobs.set(job.id, job)
  void runPipeline(job, rawAssets)
  return job
}
