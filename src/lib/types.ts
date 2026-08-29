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
  dataUrl?: string
  durationSec?: number
  words?: number
  objectKey?: string
  /** Total number of pages in a page-bearing document (PDFs set during parsing). */
  pageCount?: number
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

export type ExerciseType = 'fill-blank' | 'multiple-choice' | 'translation' | 'recall' | 'pattern-drill' | 'roleplay' | 'comprehension' | 'assessment'

export interface Exercise {
  id: string
  type: ExerciseType
  prompt: string
  answer?: string
  options?: string[]
  /** Exact source page of the exercise in the uploaded material, e.g. "S. 34" or "p. 34" */
  page?: string
  /** Exact exercise name/label as printed in the uploaded material, e.g. "Aufgabe 5a", "Übung 3b" */
  name?: string
  sourceAssets: string[]
  /** Unified exercise object (Learning Material Relationship Engine): audio assets linked across all uploaded files. */
  requiredAudio?: string[]
  /** Unified exercise object (Learning Material Relationship Engine): video assets linked across all uploaded files. */
  requiredVideo?: string[]
  /** Unified exercise object (Learning Material Relationship Engine): page-bearing assets containing the required reading passage. */
  requiredReadings?: string[]
  /** Unified exercise object (Learning Material Relationship Engine): solution snippets located in handbooks/reference files. */
  solutions?: string[]
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
  sourceFiles: { id: string; name: string; kind: AssetKind; words: number; size?: number; path?: string; role?: string; durationSec?: number; text?: string; dataUrl?: string; objectKey?: string; pageCount?: number }[]
  /** Result of the pre-publish cleaning gate, attached when the course is assembled. */
  publishReport?: CoursePublishReport
}

export interface CoursePublishReport {
  extracted: number
  published: number
  cleaned: number
  rejected: number
  reasons: Record<string, number>
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
  headings: { text: string; page: string }[]
  text_blocks: { text: string; page: string }[]
  image_refs: { text: string; page: string }[]
  audio_refs: { text: string; page: string }[]
  video_refs: { text: string; page: string }[]
  exercises: { type: string; prompt: string; page?: string; name?: string }[]
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
