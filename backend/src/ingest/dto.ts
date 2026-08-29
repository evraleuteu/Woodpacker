export interface IngestAssetInput {
  /** Object key in MinIO, e.g. uploads/<uploadId>/<file> or courses/<id>/source/... */
  objectKey: string
  filename: string
  kind: 'pdf' | 'docx' | 'pptx' | 'text' | 'audio' | 'video' | 'image' | string
  /** Content hash when known — enables deterministic idempotent job IDs. */
  sha256?: string
  size?: number
}

export interface CourseIngestRequest {
  userId?: string
  courseId: string
  assets: IngestAssetInput[]
  requireAnswer?: boolean
}

export type PipelineJobState =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'NEEDS_REVIEW'

export interface AssetJobStatus {
  jobId: string
  operation: 'extract' | 'register' | 'link'
  objectKey?: string
  state: PipelineJobState
  attemptsMade?: number
  exercisesExtracted?: number
  status?: string
  error?: string
}

export interface CourseIngestStatus {
  courseId: string
  state: PipelineJobState
  parentJobId: string
  totals: { assets: number; completed: number; failed: number; needsReview: number }
  assets: AssetJobStatus[]
}
