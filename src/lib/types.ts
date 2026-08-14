export type AssetKind = 'pdf' | 'docx' | 'epub' | 'pptx' | 'text' | 'audio' | 'video' | 'image' | 'unknown'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export interface UploadedAsset {
  id: string
  name: string
  kind: AssetKind
  mime: string
  size: number
  path?: string
  text?: string
  durationSec?: number
  words?: number
}

export interface ConceptNode {
  id: string
  name: string
  definition?: string
  difficulty: Difficulty
  parentIds: string[]
  prerequisiteIds: string[]
  relatedIds: string[]
  sourceAssets: string[]
}

export interface GraphEdge {
  from: string
  to: string
  type: 'parent' | 'prerequisite' | 'related' | 'uses' | 'answers' | 'appears-in' | 'belongs-to'
}

export interface VocabularyItem {
  id: string
  term: string
  definition?: string
  examples: string[]
  synonyms: string[]
  pronunciation?: string
  sourceAssets: string[]
  frequency: number
}

export interface GrammarRule {
  id: string
  name: string
  explanation: string
  examples: string[]
  commonMistakes: string[]
  difficulty: Difficulty
  sourceAssets: string[]
}

export interface Exercise {
  id: string
  type: 'fill-blank' | 'multiple-choice' | 'translation' | 'recall' | 'pattern-drill' | 'roleplay' | 'comprehension' | 'assessment'
  prompt: string
  answer?: string
  options?: string[]
  sourceAssets: string[]
}

export interface LessonMaterials {
  reading?: { title: string; passage: string; questions: string[] }
  listening?: { title: string; transcript: string; questions: string[] }
  speaking: { roleplays: string[]; drills: string[]; recalls: string[] }
  writing: { prompts: string[]; criteria: string[] }
  solutions?: { title: string; content: string[] }
  teacherNotes?: { title: string; content: string[] }
}

export interface Lesson {
  id: string
  title: string
  objectives: string[]
  difficulty: Difficulty
  conceptIds: string[]
  vocabulary: VocabularyItem[]
  grammar: GrammarRule[]
  exercises: Exercise[]
  materials: LessonMaterials
  sourceAssets: string[]
}

export interface Module {
  id: string
  title: string
  description: string
  difficulty: Difficulty
  lessons: Lesson[]
  review: { title: string; exercises: Exercise[] } | null
}

export interface DuplicateGroup {
  id: string
  kind: string
  items: string[]
  kept: string
  rationale: string
}

export interface LearningPathStep {
  id: string
  title: string
  type: 'module' | 'lesson' | 'review' | 'assessment'
  prerequisites: string[]
}

export interface Course {
  id: string
  title: string
  description: string
  language?: string
  createdAt: string
  mode: 'ai' | 'local'
  concepts: ConceptNode[]
  edges: GraphEdge[]
  modules: Module[]
  duplicates: DuplicateGroup[]
  path: LearningPathStep[]
  stats: {
    lessons: number
    vocabulary: number
    grammar: number
    exercises: number
    concepts: number
    duplicatesMerged: number
  }
  sourceFiles: { id: string; name: string; kind: AssetKind; words: number; path?: string; role?: string }[]
}

export interface ChapterPart {
  number: string
  title: string
  body: string[]
}

export interface Discovery {
  assetId: string
  assetName: string
  chapters: string[]
  topics: string[]
  concepts: { name: string; definition?: string }[]
  vocabulary: { term: string; definition?: string; example?: string }[]
  grammar: { name: string; explanation?: string; examples: string[] }[]
  objectives: string[]
  exercises: { type: string; prompt: string }[]
  dialogues: string[]
  sentences: string[]
  role?: string
  numberedChapters?: ChapterPart[]
}

export interface Blueprint {
  title: string
  description: string
  language?: string
  modules: {
    title: string
    description: string
    difficulty: Difficulty
    lessons: { id?: string; title: string; objectives: string[]; conceptIds: string[]; difficulty: Difficulty; sourceAssets?: string[]; number?: string }[]
  }[]
  concepts: ConceptNode[]
  duplicates: { kind: string; items: string[]; kept: string; rationale: string }[]
  path: LearningPathStep[]
}

export type JobPhase =
  | 'queued'
  | 'content-discovery'
  | 'structure-reconstruction'
  | 'knowledge-graph'
  | 'duplicate-detection'
  | 'material-generation'
  | 'dependency-mapping'
  | 'master-tree'
  | 'done'

export interface TransformJob {
  id: string
  status: 'running' | 'done' | 'error'
  phase: JobPhase
  progress: number
  message: string
  detail: string
  mode: 'ai' | 'local'
  error?: string
  result?: Course
  createdAt: number
}
