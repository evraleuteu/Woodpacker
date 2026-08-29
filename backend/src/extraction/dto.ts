export interface ExtractionAssetInput {
  id: string
  name: string
  kind: string
  text?: string
  objectKey?: string
}

export interface ExtractionFlashcard {
  id: string
  type: string
  prompt: string
  answer?: string
  options?: string[]
  page?: string
  name?: string
  source: string
}

export interface ExtractionFileResult {
  file_id: string
  file_name: string
  mode: string
  flashcards: ExtractionFlashcard[]
  classification?: {
    file_id: string
    file_name: string
    file_type: string
    confidence: number
  }
  exercises?: Array<{
    exercise_id: string
    chapter: string
    section: string
    exercise_title: string
    exercise_type: string
    page: number
  }>
  questions?: Array<{
    exercise_item_id: string
    exercise_id: string
    question: string
    answer?: string
    position: number
    page?: string
    linked_images?: string[]
    linked_audio?: string[]
  }>
  images?: Array<{
    image_id: string
    page: number
    bbox: number[]
    ext: string
    description?: string
    data_size: number
  }>
  audio_refs?: Array<{
    exercise_id: string
    media_type: string
    numbers: number[]
  }>
  layout_blocks?: Array<{
    type: string
    text: string
    bbox: number[]
    page: number
    spans?: Array<{
      text: string
      bbox: number[]
      font_name: string
      font_size: number
    }>
  }>
  audio?: Array<{
    exercise_id: string
    media_type: string
    numbers: number[]
  }>
  relationships?: Array<{
    from_exercise_id: string
    to_exercise_id: string
    relationship_type: string
    confidence: number
    rationale: string
  }>
  knowledgeGraph?: {
    nodes: Array<{
      id: string
      type: string
      label: string
    }>
    links: Array<{
      relationship: string
      from: string
      to: string
      confidence: number
      rationale: string
    }>
  }
}

export interface ExtractJobData {
  userId: string
  assets: ExtractionAssetInput[]
  requireAnswer?: boolean
}

export interface ExtractionExercisesResponse {
  mode: 'llm' | 'heuristic'
  files: ExtractionFileResult[]
  flashcards: ExtractionFlashcard[]
}

export interface ExtractionJobStatus {
  id: string
  status: 'queued' | 'running' | 'done' | 'error'
  progress: number
  mode?: string
  result?: ExtractionExercisesResponse | null
  error?: string
  /** Phase 16 explicit states */
  needsReview?: boolean
  retrying?: boolean
}