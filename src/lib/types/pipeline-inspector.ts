export type PipelineSearchType = 'page' | 'exercise_id' | 'chapter' | 'text' | 'file'

export interface PipelineEventDto {
  timestamp: string
  stage: string
  status: 'started' | 'completed' | 'failed' | 'warning'
  message: string
  durationMs?: number
  metadata?: Record<string, unknown>
}

export interface PipelineStageDto {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startedAt?: string
  completedAt?: string
  durationMs?: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  warnings?: string[]
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface PipelineErrorDto {
  stage: string
  message: string
  stack?: string
  timestamp: string
}

export interface ExercisePipelineViewDto {
  exerciseId: string
  page: number
  title: string
  exerciseType: string
  prompt: string
  instructions?: string
  question?: string
  blanks?: Array<{ id: string; text: string; expected?: string[] }>
  options?: string[]
  answer?: string
  metadata: Record<string, unknown>
  rawExtractedData: Record<string, unknown>
  classification: {
    predictedType: string
    confidence: number
    alternativePredictions: Array<{ type: string; confidence: number }>
    reasoning?: string
    fallbackUsed?: boolean
  }
  assets: {
    audio: Array<{ id: string; name: string; path: string; confidence: number; objectKey?: string }>
    video: Array<{ id: string; name: string; path: string; confidence: number; objectKey?: string }>
    images: Array<{ id: string; name: string; page: number; bbox: number[]; ext: string; description?: string; confidence: number; objectKey?: string }>
    solutions: Array<{ id: string; source: string; page: number; answer?: string; confidence: number }>
  }
  relationshipGraph: {
    nodes: Array<{ id: string; type: string; label: string; data?: Record<string, unknown> }>
    edges: Array<{ id: string; source: string; target: string; relationship: string; confidence: number }>
  }
  langGraphExecution: {
    nodes: Array<{
      id: string
      name: string
      type: string
      status: string
      durationMs: number
      input?: Record<string, unknown>
      output?: Record<string, unknown>
      tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number }
      error?: string
    }>
    edges: Array<{ source: string; target: string }>
    totalDurationMs: number
  }
  langChainChains: Array<{
    name: string
    prompt: string
    output: string
    intermediateSteps?: Array<{ action: string; observation: string }>
    durationMs: number
  }>
  ocrData: {
    text: string
    blocks: Array<{
      type: string
      text: string
      bbox: number[]
      page: number
      confidence: number
      spans?: Array<{ text: string; bbox: number[]; fontName: string; fontSize: number }>
    }>
    confidenceScores: Array<{ blockIndex: number; confidence: number }>
    engine: string
    durationMs: number
  }
  rawJson: {
    rawOcrJson: Record<string, unknown>
    parsedPageJson: Record<string, unknown>
    exerciseJson: Record<string, unknown>
    assetJson: Record<string, unknown>
    relationshipJson: Record<string, unknown>
    solutionJson: Record<string, unknown>
    finalDatabaseJson: Record<string, unknown>
  }
  /** Raw Validation-agent outputs (snake_case as produced by the Python service). */
  confidence_score?: number
  validation_result?: {
    status?: string
    confidence?: number
    human_review?: string
    checks?: string[]
    [key: string]: unknown
  }
  diff: {
    removed: string[]
    added: string[]
    modified: Array<{ path: string; from: unknown; to: unknown }>
  }
  events: PipelineEventDto[]
  errors: PipelineErrorDto[]
  databaseRecords: {
    exercise: Record<string, unknown>
    assets: Record<string, unknown>[]
    relationships: Record<string, unknown>[]
    solutions: Record<string, unknown>[]
  }
  performanceMetrics: {
    stages: Array<{ name: string; durationMs: number; avgDurationMs: number }>
    totalDurationMs: number
    failureCount: number
    retryCount: number
  }
}