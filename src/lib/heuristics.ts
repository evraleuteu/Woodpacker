import type { Difficulty, Discovery, Exercise, Lesson, LessonMaterials, UploadedAsset } from './types'

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
  { name: 'nominativ', difficulty: 'beginner' },
  { name: 'artikel', difficulty: 'beginner' },
  { name: 'wortstellung', difficulty: 'beginner' },
  { name: 'präsens', difficulty: 'beginner' },
  { name: 'fragen', difficulty: 'beginner' },
  { name: 'possessivartikel', difficulty: 'beginner' },
  { name: 'akkusativ', difficulty: 'intermediate' },
  { name: 'dativ', difficulty: 'intermediate' },
  { name: 'perfekt', difficulty: 'intermediate' },
  { name: 'präteritum', difficulty: 'intermediate' },
  { name: 'futur', difficulty: 'intermediate' },
  { name: 'modalverben', difficulty: 'intermediate' },
  { name: 'adjektive', difficulty: 'intermediate' },
  { name: 'reflexiv', difficulty: 'intermediate' },
  { name: 'genitiv', difficulty: 'advanced' },
  { name: 'passiv', difficulty: 'advanced' },
  { name: 'konjunktiv', difficulty: 'advanced' },
  { name: 'relativsätze', difficulty: 'advanced' },
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

const NOISE_CONCEPTS = new Set(
  'kapitel chapter lesson lektion unit exercise übung task activity worksheet part section module step theme topic means form forms word words sentence sentences question questions answer answers practice exercises beispiel example examples lernen learn lesen read write writing reading listening speaking grammar vocab vocabulary numbers greetings'.split(' ')
)

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && s.length < 300)
}

export function detectChapters(lines: string[]): { title: string; body: string[] }[] {
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

export function detectVocabulary(text: string): { term: string; definition?: string; example?: string }[] {
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

export function detectGrammar(text: string): { name: string; explanation?: string; examples: string[] }[] {
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

export function grammarDifficultyOf(name: string): Difficulty {
  return GRAMMAR_KEYWORDS.find((k) => k.name === name)?.difficulty ?? 'intermediate'
}

export function chapterNumberFromTitle(title: string): string {
  const match = title.match(/(?:chapter|unit|lesson|kapitel|lektion|leçon|lección|unidad|capítulo|teil|parte|module|section)?\s*(\d+(?:\.\d+)?)/i)
  return match?.[1] ?? ''
}

export type ExercisePractice = 'vocabulary' | 'grammar' | 'listening' | 'speaking' | 'reading' | 'other'

const EXERCISE_TYPE_RULES: { re: RegExp; type: Exercise['type']; practice: ExercisePractice }[] = [
  { re: /multiple choice|choose the|select the|which one|a\)|b\)|tick|true or false|richtig oder falsch|ankreuzen/i, type: 'multiple-choice', practice: 'grammar' },
  { re: /translate|translate into|übersetze|übersetzen|translate the/i, type: 'translation', practice: 'vocabulary' },
  { re: /listen|hören|audio|hearing|hör zu/i, type: 'comprehension', practice: 'listening' },
  { re: /speak|say the|roleplay|role play|dialogue|dialog|ask and answer|sprechen|sprich/i, type: 'roleplay', practice: 'speaking' },
  { re: /pattern|drill|repeat after|nachsprechen|muster/i, type: 'pattern-drill', practice: 'speaking' },
  { re: /fill|blank|complete|article|verb|conjugate|tense|correct form|ergänz|lücke|konjugier|präsens|artikel/i, type: 'fill-blank', practice: 'grammar' },
  { re: /match|vocabulary|word|meaning|define|bedeutet|woerter|wortschatz|vokabeln/i, type: 'recall', practice: 'vocabulary' },
  { re: /read|text|passage|lesen|liest du|answer the questions|beantworte/i, type: 'comprehension', practice: 'reading' },
]

export function classifyExercise(prompt: string): { type: Exercise['type']; practice: ExercisePractice } {
  for (const rule of EXERCISE_TYPE_RULES) {
    if (rule.re.test(prompt)) return { type: rule.type, practice: rule.practice }
  }
  return { type: 'assessment', practice: 'other' }
}

export interface MinedPattern {
  pattern: string
  examples: string[]
  count: number
}

export function minePatterns(sentences: string[], maxPatterns = 6): MinedPattern[] {
  const normalized = sentences
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 8 && s.length <= 120)
  const prefixCounts = new Map<string, { count: number; examples: string[] }>()
  for (const sentence of normalized) {
    const words = sentence.split(' ')
    for (const size of [2, 3]) {
      if (words.length < size + 1) continue
      const prefix = words.slice(0, size).join(' ')
      const entry = prefixCounts.get(prefix) ?? { count: 0, examples: [] }
      entry.count++
      if (entry.examples.length < 3) entry.examples.push(sentence)
      prefixCounts.set(prefix, entry)
    }
  }
  return [...prefixCounts.entries()]
    .filter(([, e]) => e.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxPatterns)
    .map(([pattern, e]) => ({ pattern: `${pattern}…`, examples: e.examples, count: e.count }))
}

export function detectExercises(text: string): { type: string; prompt: string }[] {
  const exercises: { type: string; prompt: string }[] = []
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (EXERCISE_PATTERNS.some((p) => p.test(trimmed))) {
      const prompt = trimmed.replace(/^.*?\s*(\d+)?[:.)]\s*/, '').slice(0, 200)
      exercises.push({ type: classifyExercise(trimmed).type, prompt })
    }
  }
  return exercises.slice(0, 20)
}

export function detectConcepts(text: string): { name: string; definition?: string }[] {
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

export function detectDialogues(text: string): string[] {
  return splitSentences(text).filter((s) => /[''"«»]/.test(s) || /\b(said|asked|replied|answers|says)\b/i.test(s)).slice(0, 5)
}

export type FileRole = 'textbook' | 'workbook' | 'handbook' | 'reference' | 'audio' | 'video' | 'image' | 'other'

const ROLE_RULES: { re: RegExp; role: FileRole }[] = [
  { re: /unterrichtshandbuch|lehrerhandbuch|teacher|handbook|handbuch|guide|solutions|lösung|lösungen|answer ?key|tchr/i, role: 'handbook' },
  { re: /kursbuch|coursebook|textbook|student|students? ?book|schülerbuch/i, role: 'textbook' },
  { re: /übungsbuch|ubungsbuch|arbeitsbuch|workbook|exercise ?book|practice ?book|arbeitsheft/i, role: 'workbook' },
  { re: /glossar|glossary|wortschatz|grammatik|extras?|zusatz/i, role: 'reference' },
]

export function classifyFileRole(asset: { name: string; path?: string; kind: string }): FileRole {
  if (asset.kind === 'audio') return 'audio'
  if (asset.kind === 'video') return 'video'
  if (asset.kind === 'image') return 'image'
  const hay = `${asset.path ?? ''} ${asset.name}`.toLowerCase()
  for (const rule of ROLE_RULES) if (rule.re.test(hay)) return rule.role
  return asset.kind === 'unknown' ? 'other' : 'textbook'
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
    role: classifyFileRole(asset),
    numberedChapters: chapters.map((c) => ({ number: chapterNumberFromTitle(c.title), title: c.title, body: c.body.slice(0, 300) })),
  }
}

export interface ChapterContext {
  sentences: string[]
  dialogues: string[]
  solutions?: string[]
  teacherNotes?: string[]
  lessonBody?: string
}

export function heuristicMaterials(lesson: Lesson, discoveries: Discovery[], chapter?: ChapterContext): LessonMaterials {
  const materials: LessonMaterials = { speaking: { roleplays: [], drills: [], recalls: [] }, writing: { prompts: [], criteria: [] } }
  const discovery = discoveries.find((d) => lesson.sourceAssets.includes(d.assetId))
  const corpus = chapter?.sentences && chapter.sentences.length ? chapter.sentences : discovery?.sentences ?? []
  const dialogues = chapter?.dialogues && chapter.dialogues.length ? chapter.dialogues : discovery?.dialogues ?? []
  const terms = lesson.vocabulary.map((v) => v.term)
  materials.speaking.recalls = terms.map((t) => `Without looking, say what "${t}" means and use it in a sentence.`)
  if (corpus.length) {
    materials.reading = {
      title: `${lesson.title} — Reading`,
      passage: corpus.slice(0, 10).join(' '),
      questions: lesson.objectives.length ? lesson.objectives.map((o) => `Explain: ${o}`) : ['Summarize the passage in 3 sentences.'],
    }
  }
  const dialogueTranscript = dialogues[0] ?? (corpus.length ? corpus.slice(0, 4).join(' ') : undefined)
  if (dialogueTranscript) {
    materials.listening = { title: `${lesson.title} — Listening`, transcript: dialogueTranscript, questions: ['What is this conversation about?', 'What are the key phrases used?'] }
  }
  if (lesson.grammar.length) {
    materials.speaking.drills = lesson.grammar.map((g) => `Pattern drill: ${g.name} — make 3 statements and 1 question.`)
  }
  if (dialogues.length) {
    materials.speaking.roleplays = [dialogues[0], ...dialogues.slice(1, 3)]
  }
  materials.writing.prompts = lesson.objectives.length ? lesson.objectives.map((o) => `Writing task: ${o}. Use at least 5 new words.`) : ['Write a short dialogue using this lesson vocabulary.']
  materials.writing.criteria = ['Clear structure', 'Target vocabulary used correctly', 'Grammar accurate', 'Appropriate register']
  if (chapter?.solutions?.length) {
    materials.solutions = { title: `${lesson.title} — Solutions`, content: chapter.solutions.slice(0, 40) }
  }
  if (chapter?.teacherNotes?.length) {
    materials.teacherNotes = { title: `${lesson.title} — Teacher Notes`, content: chapter.teacherNotes.slice(0, 40) }
  }
  return materials
}
