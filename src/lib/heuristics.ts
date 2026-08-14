import type { AssetKind, Blueprint, ConceptNode, Discovery, Difficulty, Lesson, LessonMaterials, Module, UploadedAsset } from './types'

const STOPWORDS = new Set('the a an and or but of to in on at for with by from as is are was were be been being it its this that these those you your i we they he she his her their my our not no yes do does did have has had can could will would should may might must shall than then them there here when where what which who whom how why so if because'.split(' '))

const GRAMMAR_KEYWORDS: { name: string; difficulty: Difficulty }[] = [
  { name: 'present tense', difficulty: 'beginner' },
  { name: 'articles', difficulty: 'beginner' },
  { name: 'plurals', difficulty: 'beginner' },
  { name: 'word order', difficulty: 'beginner' },
  { name: 'questions', difficulty: 'beginner' },
  { name: 'negation', difficulty: 'beginner' },
  { name: 'prepositions', difficulty: 'beginner' },
  { name: 'imperative', difficulty: 'beginner' },
  { name: 'past tense', difficulty: 'intermediate' },
  { name: 'perfect tense', difficulty: 'intermediate' },
  { name: 'future tense', difficulty: 'intermediate' },
  { name: 'modal verbs', difficulty: 'intermediate' },
  { name: 'adjectives', difficulty: 'intermediate' },
  { name: 'adverbs', difficulty: 'intermediate' },
  { name: 'pronouns', difficulty: 'beginner' },
  { name: 'reflexive verbs', difficulty: 'intermediate' },
  { name: 'conjunctions', difficulty: 'intermediate' },
  { name: 'relative clauses', difficulty: 'intermediate' },
  { name: 'passive voice', difficulty: 'advanced' },
  { name: 'subjunctive', difficulty: 'advanced' },
  { name: 'conditional', difficulty: 'advanced' },
  { name: 'indirect speech', difficulty: 'advanced' },
  { name: 'gerunds', difficulty: 'intermediate' },
  { name: 'participles', difficulty: 'advanced' },
  { name: 'gerund', difficulty: 'intermediate' },
  { name: 'collocations', difficulty: 'intermediate' },
  { name: 'idioms', difficulty: 'advanced' },
]

const CHAPTER_PATTERNS = [
  /^(chapter|unit|lesson|section|module|part|step|theme|topic)\s*[#\d:.\-]*\s+.{0,80}$/i,
  /^(kapitel|lektion|teil|einheit|abschnitt)\s*[#\d:.\-]*\s+.{0,80}$/i,
  /^(leçon|unité|chapitre|partie)\s*[#\d:.\-]*\s+.{0,80}$/i,
  /^(lección|unidad|capítulo|parte)\s*[#\d:.\-]*\s+.{0,80}$/i,
  /^[A-ZÀ-Ž][A-ZÀ-Ž0-9\s'’:\-&]{4,60}$/,
]

const EXERCISE_PATTERNS = [
  /^(exercise|task|activity|practice|worksheet|quiz|test|exam)\s*[#\d:.\-]*/i,
  /^(aufgabe|übung|übungsteil)\s*[#\d:.\-]*/i,
  /^(exercice|activité)\s*[#\d:.\-]*/i,
  /^(ejercicio|actividad|tarea)\s*[#\d:.\-]*/i,
]

const AUDIO_VERBAL_KINDS: AssetKind[] = ['audio', 'video']

const NOISE_CONCEPTS = new Set(
  'kapitel chapter lesson lektion unit exercise übung task activity worksheet part section module step theme topic means form forms word words sentence sentences question questions answer answers practice exercises beispiel example examples lernen learn lesen read write writing reading listening speaking grammar vocab vocabulary numbers greetings'.split(' ')
)

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && s.length < 300)
}

function detectChapters(lines: string[]): { title: string; body: string[] }[] {
  const chapters: { title: string; body: string[] }[] = []
  let current: { title: string; body: string[] } | null = null
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const isHeader = trimmed.length <= 90 && (CHAPTER_PATTERNS.some((p) => p.test(trimmed)) || /^\d+\.\s+\S/.test(trimmed))
    if (isHeader && trimmed.length <= 90) {
      current = { title: trimmed, body: [] }
      chapters.push(current)
    } else if (current) {
      current.body.push(trimmed)
    } else {
      if (chapters.length === 0) {
        current = { title: 'Introduction', body: [] }
        chapters.push(current)
        current.body.push(trimmed)
      }
    }
  }
  return chapters.length ? chapters : [{ title: 'Course Material', body: lines.filter((l) => l.trim()) }]
}

function detectVocabulary(text: string): { term: string; definition?: string; example?: string }[] {
  const items: { term: string; definition?: string; example?: string }[] = []
  const seen = new Set<string>()
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(/^([^\s—–:-]{2,40}(?:\s+[^\s—–:-]{2,40})?)\s*(?:[—–:=:]\s*(.+))?$/)
    if (!match) continue
    const term = match[1]?.trim()
    const definition = match[2]?.trim()
    if (!term || term.length < 2 || STOPWORDS.has(term.toLowerCase()) || /[^\p{L}\s'’-]/u.test(term)) continue
    const key = term.toLowerCase()
    if (seen.has(key) || items.length > 120) break
    seen.add(key)
    items.push({ term, definition: definition?.slice(0, 160) })
  }
  return items
}

function detectGrammar(text: string): { name: string; explanation?: string; examples: string[] }[] {
  const found: { name: string; explanation?: string; examples: string[] }[] = []
  const lower = text.toLowerCase()
  const sentences = splitSentences(text)
  for (const keyword of GRAMMAR_KEYWORDS) {
    if (lower.includes(keyword.name)) {
      const examples = sentences.filter((s) => s.toLowerCase().includes(keyword.name)).slice(0, 2)
      found.push({ name: keyword.name, explanation: `Grammar focus on ${keyword.name} found in your material.`, examples })
    }
  }
  return found
}

function detectExercises(text: string): { type: string; prompt: string }[] {
  const exercises: { type: string; prompt: string }[] = []
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (EXERCISE_PATTERNS.some((p) => p.test(trimmed))) {
      exercises.push({ type: 'exercise', prompt: trimmed.slice(0, 200) })
    }
  }
  return exercises.slice(0, 20)
}

function detectConcepts(text: string): { name: string; definition?: string }[] {
  const sentences = splitSentences(text)
  const words = text.toLowerCase().match(/[\p{L}']{4,}/gu) ?? []
  const freq = new Map<string, number>()
  for (const word of words) {
    if (STOPWORDS.has(word) || NOISE_CONCEPTS.has(word)) continue
    freq.set(word, (freq.get(word) ?? 0) + 1)
  }
  const top = [...freq.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([word]) => {
      const sentence = sentences.find((s) => s.toLowerCase().includes(word) && !/^(kapitel|chapter|lesson|lektion|unit|exercise|übung|task|activity|aufgabe|exercice|ejercicio)\b/i.test(s))
      return { name: word[0].toUpperCase() + word.slice(1), definition: sentence?.slice(0, 180) }
    })
  return top
}

function detectDialogues(text: string): string[] {
  return splitSentences(text).filter((s) => /[''"«»]/.test(s) || /\b(said|asked|replied|answers|says)\b/i.test(s)).slice(0, 5)
}

export function heuristicDiscover(asset: UploadedAsset): Discovery {
  const text = asset.text ?? ''
  const lines = text.split('\n')
  const chapters = detectChapters(lines)
  const sentences = splitSentences(text)
  const vocabulary = detectVocabulary(text)
  const fallbackVocab = sentences
    .flatMap((s) => {
      const words = s.replace(/[.,!?;:"'()]/g, '').split(/\s+/).filter((w) => w.length >= 6 && !STOPWORDS.has(w.toLowerCase()))
      return words.slice(0, 2)
    })
    .slice(0, 30)
  const fullVocab = vocabulary.length
    ? vocabulary
    : fallbackVocab.map((term) => ({ term, example: sentences.find((s) => s.includes(term))?.slice(0, 200) }))
  const grammar = detectGrammar(text)
  const concepts = detectConcepts(text)
  const exercises = detectExercises(text)
  const dialogues = detectDialogues(text)
  const topics = chapters.map((c) => c.title).slice(0, 12)
  return {
    assetId: asset.id,
    assetName: asset.name,
    chapters: topics,
    topics,
    concepts,
    vocabulary: fullVocab,
    grammar,
    objectives: sentences.filter((s) => /\b(learn|will be able|understand|practise|practice|know how to|use)\b/i.test(s)).slice(0, 6),
    exercises,
    dialogues,
    sentences,
  }
}

function titleSimilarity(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter(Boolean))
  const tb = new Set(b.toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.min(ta.size, tb.size)
}

function chapterNumber(title: string): string {
  const match = title.match(/(?:chapter|unit|lesson|kapitel|lektion|leçon|lección|unidad|capítulo|teil|parte)?\s*(\d+)/i)
  return match?.[1] ?? ''
}

export function heuristicBlueprint(discoveries: Discovery[]): Blueprint {
  const modules: Module[] = []
  const concepts: ConceptNode[] = []
  const conceptsByName = new Map<string, ConceptNode>()
  const conceptsById = new Map<string, ConceptNode>()
  const lessonConcepts = new Map<string, string[]>()
  const duplicates: Blueprint['duplicates'] = []
  const path: Blueprint['path'] = []
  let moduleCounter = 0
  let lessonCounter = 0
  let itemCounter = 0
  const knownGrammar = new Map<string, Difficulty>()

  for (const discovery of discoveries) {
    const grammarDiffs = discovery.grammar.map((g) => {
      const found = GRAMMAR_KEYWORDS.find((k) => k.name === g.name)
      const d = found?.difficulty ?? 'intermediate'
      knownGrammar.set(g.name, d)
      return d
    })
    const assetDifficulty: Difficulty = grammarDiffs.length
      ? grammarDiffs.some((d) => d === 'advanced')
        ? 'advanced'
        : grammarDiffs.some((d) => d === 'intermediate')
          ? 'intermediate'
          : 'beginner'
      : 'beginner'

    const moduleTitle = discovery.chapters[0] ? discovery.chapters[0] : discovery.assetName.replace(/\.[^.]+$/, '')
    const mod: Module = {
      id: `m-${moduleCounter++}`,
      title: moduleTitle,
      description: `Built from ${discovery.assetName}`,
      difficulty: assetDifficulty,
      lessons: [],
      review: null,
    }
    const chunkSize = Math.max(1, Math.ceil(discovery.chapters.length / 2))
    const chunked: string[][] = []
    for (let i = 0; i < discovery.chapters.length; i += chunkSize) chunked.push(discovery.chapters.slice(i, i + chunkSize))
    if (chunked.length === 0) chunked.push([])

    chunked.forEach((chapterTitles, idx) => {
      const lessonTitle = chapterTitles[0] ?? `Lesson ${idx + 1}`
      const lessonCount = Math.max(1, chunked.length)
      const conceptPool = [...discovery.concepts]
      for (const g of discovery.grammar) {
        const name = g.name.charAt(0).toUpperCase() + g.name.slice(1)
        if (!conceptPool.some((c) => c.name.toLowerCase() === name.toLowerCase())) conceptPool.push({ name, definition: g.explanation })
      }
      const lessonConceptItems = conceptPool.filter((_, ci) => ci % lessonCount === idx)
      const conceptIds: string[] = []
      for (const c of lessonConceptItems) {
        const existing = conceptsByName.get(c.name.toLowerCase())
        if (existing) {
          conceptIds.push(existing.id)
          continue
        }
        const node: ConceptNode = {
          id: `c-${concepts.length}`,
          name: c.name,
          definition: c.definition,
          difficulty: assetDifficulty,
          parentIds: [],
          prerequisiteIds: [],
          relatedIds: [],
          sourceAssets: [discovery.assetId],
        }
        concepts.push(node)
        conceptsByName.set(c.name.toLowerCase(), node)
        conceptsById.set(node.id, node)
        conceptIds.push(node.id)
      }
      const lesson: Lesson = {
        id: `l-${lessonCounter++}`,
        title: lessonTitle,
        objectives: discovery.objectives.slice(idx * 3, idx * 3 + 3),
        difficulty: assetDifficulty,
        conceptIds,
        vocabulary: [],
        grammar: [],
        exercises: [],
        materials: { speaking: { roleplays: [], drills: [], recalls: [] }, writing: { prompts: [], criteria: [] } },
        sourceAssets: [discovery.assetId],
      }
      lessonConcepts.set(lesson.id, conceptIds)
      mod.lessons.push(lesson)
    })
    mod.review = {
      title: `${mod.title} — Review`,
      exercises: [],
    }
    modules.push(mod)
  }

  for (const discovery of discoveries) {
    const sentences = discovery.sentences
    const termMatches = discovery.vocabulary.map((v) => v.term)
    for (const lesson of modules.flatMap((m) => m.lessons).filter((l) => l.sourceAssets.includes(discovery.assetId))) {
      const assigned = discovery.vocabulary.slice(0, 10).map((v) => ({
        id: `v-${itemCounter++}`,
        term: v.term,
        definition: v.definition,
        examples: [v.example, sentences.find((s) => s.toLowerCase().includes(v.term.toLowerCase()))].filter(Boolean) as string[],
        synonyms: [],
        pronunciation: undefined,
        sourceAssets: [discovery.assetId],
        frequency: termMatches.filter((t) => t.toLowerCase() === v.term.toLowerCase()).length + 1,
      }))
      lesson.vocabulary = assigned
      lesson.grammar = discovery.grammar.slice(0, 4).map((g) => ({
        id: `g-${itemCounter++}`,
        name: g.name,
        explanation: g.explanation ?? `Focus on ${g.name}.`,
        examples: g.examples.length ? g.examples : sentences.filter((s) => s.toLowerCase().includes(g.name)).slice(0, 2),
        commonMistakes: [],
        difficulty: knownGrammar.get(g.name) ?? 'intermediate',
        sourceAssets: [discovery.assetId],
      }))
      lesson.exercises = discovery.exercises.slice(0, 5).map((e) => ({
        id: `e-${itemCounter++}`,
        type: 'assessment',
        prompt: e.prompt,
        sourceAssets: [discovery.assetId],
      }))
      const readingSentences = sentences.slice(0, 8)
      if (readingSentences.length) {
        lesson.materials.reading = {
          title: `${lesson.title} — Reading`,
          passage: readingSentences.join(' '),
          questions: discovery.objectives.slice(0, 3).map((o) => `Based on the text: ${o}?`),
        }
      }
      const dialogues = discovery.dialogues
      if (dialogues.length) {
        lesson.materials.listening = {
          title: `${lesson.title} — Listening`,
          transcript: dialogues.join(' '),
          questions: [`What is the dialogue about?`, 'Who are the speakers?'],
        }
        lesson.materials.speaking.roleplays = [dialogues[0]]
        lesson.materials.speaking.drills = lesson.grammar.map((g) => `Practice ${g.name}: create three sentences of your own.`)
      }
      lesson.materials.speaking.recalls = lesson.vocabulary.map((v) => `Say the meaning of "${v.term}" without looking.`)
      lesson.materials.writing.prompts = lesson.objectives.map((o) => `Write a short paragraph: ${o}.`)
      lesson.materials.writing.criteria = ['Clear structure', 'Target vocabulary used correctly', 'Grammar accurate']
    }
  }

  const addPrerequisite = (fromId: string, toId: string) => {
    const to = conceptsById.get(toId)
    const from = conceptsById.get(fromId)
    if (!to || !from || fromId === toId) return
    if (!to.prerequisiteIds.includes(fromId)) to.prerequisiteIds.push(fromId)
  }
  const addRelated = (aId: string, bId: string) => {
    const a = conceptsById.get(aId)
    const b = conceptsById.get(bId)
    if (!a || !b || aId === bId) return
    if (!a.relatedIds.includes(bId)) a.relatedIds.push(bId)
    if (!b.relatedIds.includes(aId)) b.relatedIds.push(aId)
  }

  for (const mod of modules) {
    const lessons = mod.lessons
    for (let i = 0; i < lessons.length; i++) {
      const current = lessonConcepts.get(lessons[i].id) ?? []
      for (let j = 0; j < current.length; j++) {
        for (let k = j + 1; k < current.length; k++) {
          addRelated(current[j], current[k])
        }
      }
      if (i + 1 < lessons.length) {
        const next = lessonConcepts.get(lessons[i + 1].id) ?? []
        const anchor = current[current.length - 1]
        if (anchor) {
          for (const nid of next.slice(0, 2)) addPrerequisite(anchor, nid)
        }
      }
    }
  }
  for (let i = 0; i + 1 < modules.length; i++) {
    const lastLesson = modules[i].lessons[modules[i].lessons.length - 1]
    const firstLesson = modules[i + 1].lessons[0]
    if (!lastLesson || !firstLesson) continue
    const from = (lessonConcepts.get(lastLesson.id) ?? []).slice(-1)[0]
    const to = (lessonConcepts.get(firstLesson.id) ?? [])[0]
    if (from && to) addPrerequisite(from, to)
  }

  const seenTitles = new Map<string, string[]>()
  for (const m of modules) {
    for (const l of m.lessons) {
      const key = l.title.toLowerCase().trim()
      const list = seenTitles.get(key) ?? []
      list.push(l.id)
      seenTitles.set(key, list)
    }
  }
  for (const [, ids] of seenTitles) {
    if (ids.length > 1) {
      duplicates.push({ kind: 'lesson', items: ids, kept: ids[0], rationale: 'Identical lesson titles merged, keeping the best version.' })
    }
  }
  for (const mod of modules) {
    const lessons = mod.lessons
    for (let i = 0; i < lessons.length; i++) {
      for (let j = i + 1; j < lessons.length; j++) {
        const a = lessons[i]
        const b = lessons[j]
        if (a.id === b.id) continue
        const sameNumber = chapterNumber(a.title) && chapterNumber(a.title) === chapterNumber(b.title)
        if (sameNumber && titleSimilarity(a.title, b.title) > 0.5) {
          duplicates.push({ kind: 'lesson', items: [a.id, b.id], kept: a.id, rationale: `Similar lessons (${a.title} / ${b.title}) merged, keeping the best version.` })
        }
      }
    }
  }

  for (const m of modules) path.push({ id: m.id, title: m.title, type: 'module', prerequisites: [] })
  for (const m of modules) path.push({ id: `r-${m.id}`, title: `${m.title} — Review`, type: 'review', prerequisites: [m.id] })
  path.push({ id: 'final', title: 'Final Assessment', type: 'assessment', prerequisites: modules.map((m) => m.id) })

  const cleanTitle = (t: string): string =>
    t
      .replace(/^(chapter|unit|lesson|section|module|part|step|theme|topic|kapitel|lektion|teil|einheit|abschnitt|leçon|unité|chapitre|partie|lección|unidad|capítulo|parte)\s*[\d]*[.:]?\s*/i, '')
      .replace(/[.:\s]+$/, '')
      .trim()

  return {
    title: cleanTitle(discoveries[0]?.chapters[0] ?? '') || 'My Learning Course',
    description: `A learning course reconstructed from ${discoveries.length} uploaded source(s).`,
    language: undefined,
    modules: modules.map((m) => ({
      title: m.title,
      description: m.description,
      difficulty: m.difficulty,
      lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, objectives: l.objectives, conceptIds: l.conceptIds, difficulty: l.difficulty })),
    })),
    concepts,
    duplicates,
    path,
  }
}

function isVerbalAsset(kind: AssetKind): boolean {
  return AUDIO_VERBAL_KINDS.includes(kind)
}

export function heuristicMaterials(lesson: Lesson, discoveries: Discovery[], assetKind: AssetKind): LessonMaterials {
  const materials: LessonMaterials = { speaking: { roleplays: [], drills: [], recalls: [] }, writing: { prompts: [], criteria: [] } }
  const discovery = discoveries.find((d) => lesson.sourceAssets.includes(d.assetId))
  const corpus = discovery?.sentences ?? []
  const terms = lesson.vocabulary.map((v) => v.term)
  materials.speaking.recalls = terms.map((t) => `Without looking, say what "${t}" means and use it in a sentence.`)
  if (corpus.length) {
    materials.reading = {
      title: `${lesson.title} — Reading`,
      passage: corpus.slice(0, 10).join(' '),
      questions: lesson.objectives.length ? lesson.objectives.map((o) => `Explain: ${o}`) : ['Summarize the passage in 3 sentences.'],
    }
  }
  if (isVerbalAsset(assetKind) && discovery?.dialogues.length) {
    materials.listening = { title: `${lesson.title} — Listening`, transcript: discovery.dialogues[0], questions: ['What is this conversation about?', 'What are the key phrases used?'] }
  }
  if (lesson.grammar.length) {
    materials.speaking.drills = lesson.grammar.map((g) => `Pattern drill: ${g.name} — make 3 statements and 1 question.`)
  }
  if (discovery?.dialogues.length) {
    materials.speaking.roleplays = [discovery.dialogues[0], ...discovery.dialogues.slice(1, 3)]
  }
  materials.writing.prompts = lesson.objectives.length ? lesson.objectives.map((o) => `Writing task: ${o}. Use at least 5 new words.`) : ['Write a short dialogue using this lesson vocabulary.']
  materials.writing.criteria = ['Clear structure', 'Target vocabulary used correctly', 'Grammar accurate', 'Appropriate register']
  return materials
}

export function lessonDifficulty(l: Lesson): Difficulty {
  if (l.grammar.some((g) => g.difficulty === 'advanced')) return 'advanced'
  if (l.grammar.some((g) => g.difficulty === 'intermediate')) return 'intermediate'
  return l.difficulty
}
