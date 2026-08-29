import type {
  ExercisePipelineViewDto,
  PipelineEventDto,
  PipelineSearchType,
} from '@/lib/types/pipeline-inspector'

export interface SearchExercisesParams {
  type: PipelineSearchType
  query: string
}

export interface Material {
  id: string
  title: string
  kind: string
  words: number
  pages?: number
  status: string
  objectKey?: string
  text?: string
  size?: number
}

export interface ExtractionJobResponse {
  id: string
  status: string
}

export interface ExtractionJobStatus {
  id: string
  status: 'queued' | 'running' | 'done' | 'error'
  progress: number
  mode?: string
  result?: unknown
  error?: string
}

const TOKEN_CACHE_KEY = 'woodpacker:pi-dev-token'

function b64UrlDecode(b64url: string): string {
  // Handle base64url -> base64
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  if (pad) b64 += '='.repeat(4 - pad)
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    try {
      return Buffer.from(b64, 'base64').toString('utf-8')
    } catch {}
  }
  if (typeof atob === 'function') {
    return atob(b64)
  }
  // Fallback: return raw (will fail JSON parse and be treated as expired)
  return b64
}

function isJwtExpired(token: string, skewSeconds = 30): boolean {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return true
    const payload = JSON.parse(b64UrlDecode(parts[1]))
    if (!payload.exp) return false
    const now = Math.floor(Date.now() / 1000)
    return payload.exp <= now + skewSeconds
  } catch {
    return true
  }
}

export class PipelineInspectorClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  }

  /**
   * The backend guards the inspector API with a JWT. There is no login flow in
   * this app, so the local backend exposes a dev-only token endpoint; the token
   * is cached for the browser session.
   */
  async getDevToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.token) {
      if (!isJwtExpired(this.token)) return this.token
      this.clearToken()
    }
    if (!forceRefresh && typeof window !== 'undefined') {
      const cached = window.sessionStorage.getItem(TOKEN_CACHE_KEY)
      if (cached) {
        if (!isJwtExpired(cached)) {
          this.token = cached
          return cached
        }
        // cached token expired — drop it and fetch fresh
        window.sessionStorage.removeItem(TOKEN_CACHE_KEY)
      }
    }

    const res = await fetch(`${this.baseUrl}/api/auth/dev-token`)
    if (!res.ok) {
      throw new Error(`Failed to obtain dev token (HTTP ${res.status})`)
    }
    const { token } = (await res.json()) as { token: string }
    this.token = token
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(TOKEN_CACHE_KEY, token)
    }
    return token
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const doFetch = async (token: string) =>
      fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options?.headers,
        },
        credentials: 'include',
      })

    let token = await this.getDevToken()
    let res = await doFetch(token)

    // Token may have expired (1h) while cached in sessionStorage — clear and retry once on 401
    if (res.status === 401) {
      this.token = null
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(TOKEN_CACHE_KEY)
      }
      try {
        token = await this.getDevToken()
        res = await doFetch(token)
      } catch {
        // fall through to error handling below
      }
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Pipeline Inspector API error ${res.status}: ${body || res.statusText}`)
    }

    return res.json() as Promise<T>
  }

  /** Clear cached token (e.g. on logout or 401). */
  clearToken(): void {
    this.token = null
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(TOKEN_CACHE_KEY)
    }
  }

  /** Expose expiry check for WS reconnect logic. */
  isTokenExpired(token: string): boolean {
    return isJwtExpired(token)
  }

  /** Fetch a fresh token regardless of cache (used after WS auth failure). */
  async refreshToken(): Promise<string> {
    this.clearToken()
    return this.getDevToken(true)
  }

  /** Lightweight health probe — does not throw on 401 retry, used to show API status. */
  async checkHealth(): Promise<{ ok: boolean; status: number; body?: unknown }> {
    try {
      const token = await this.getDevToken()
      const res = await fetch(`${this.baseUrl}/api/pipeline-inspector/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json().catch(() => null)
      if (res.status === 401) {
        // expired token — try once with fresh token
        const fresh = await this.refreshToken()
        const retry = await fetch(`${this.baseUrl}/api/pipeline-inspector/health`, {
          headers: { Authorization: `Bearer ${fresh}` },
        })
        const retryBody = await retry.json().catch(() => null)
        return { ok: retry.ok, status: retry.status, body: retryBody }
      }
      return { ok: res.ok, status: res.status, body }
    } catch (e) {
      return { ok: false, status: 0, body: String(e) }
    }
  }

  async searchExercises(params: SearchExercisesParams): Promise<ExercisePipelineViewDto[]> {
    return this.request<ExercisePipelineViewDto[]>(`/api/pipeline-inspector/search`, {
      method: 'POST',
      body: JSON.stringify({ type: params.type, query: params.query }),
    })
  }

  async getExercisePipelineView(exerciseId: string): Promise<ExercisePipelineViewDto> {
    return this.request<ExercisePipelineViewDto>(`/api/pipeline-inspector/exercise/${encodeURIComponent(exerciseId)}`)
  }

  async getEvents(exerciseId: string): Promise<PipelineEventDto[]> {
    return this.request<PipelineEventDto[]>(`/api/pipeline-inspector/exercise/${encodeURIComponent(exerciseId)}/events`)
  }

  async replayPipeline(exerciseId: string): Promise<{ success: boolean; message: string; jobId?: string }> {
    return this.request<{ success: boolean; message: string; jobId?: string }>(
      `/api/pipeline-inspector/exercise/${encodeURIComponent(exerciseId)}/replay`,
      { method: 'POST', body: JSON.stringify({}) }
    )
  }

  async triggerExtraction(
    asset: { id: string; name: string; kind: string; objectKey?: string; text?: string; size?: number },
    options?: { requireAnswer?: boolean }
  ): Promise<ExtractionJobResponse> {
    // Truncate large text payloads — the Python service chunks per page and
    // 274 pages × LLM would exceed the HTTP timeout. 60k chars (≈65 pages
    // with concurrency 4) stays well within the 15 min backend timeout while
    // still exercising the real pipeline.
    const MAX_INSPECTOR_TEXT = 60_000
    const truncated =
      asset.text && asset.text.length > MAX_INSPECTOR_TEXT ? asset.text.slice(0, MAX_INSPECTOR_TEXT) : asset.text
    const hasText = truncated && truncated.trim().length > 0
    return this.request<ExtractionJobResponse>(
      `/api/extract`,
      {
        method: 'POST',
        body: JSON.stringify({
          assets: [
            {
              id: asset.id,
              name: asset.name,
              kind: asset.kind,
              objectKey: asset.objectKey,
              // Always send truncated text when available — the text path is
              // faster than the object path for large PDFs (object path would
              // process all 274 pages). Backend prefers text when present.
              ...(hasText ? { text: truncated } : {}),
              size: asset.size,
            },
          ],
          requireAnswer: options?.requireAnswer ?? false,
        }),
      }
    )
  }

  // Backwards compat: allow passing just an objectKey string (used by older callers)
  async triggerExtractionByKey(objectKey: string, options?: { requireAnswer?: boolean }): Promise<ExtractionJobResponse> {
    return this.triggerExtraction({ id: `pdf-${Date.now()}`, name: objectKey.split('/').pop() || 'file.pdf', kind: 'pdf', objectKey }, options)
  }

  async getExtractionStatus(jobId: string): Promise<ExtractionJobStatus> {
    return this.request<ExtractionJobStatus>(`/api/extract/${encodeURIComponent(jobId)}`)
  }
}
