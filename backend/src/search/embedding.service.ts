import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface EmbeddingResult {
  text: string
  vector: number[]
  model: string
}

/**
 * Embedding client backed by an OpenAI-compatible embeddings endpoint
 * (OpenRouter by default). Used to index exercise prompts for semantic
 * knowledge search.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name)
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly model: string

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.apiKey = this.config.get('EMBEDDING_API_KEY') ?? this.config.get('OPENCODE_API_KEY') ?? ''
    this.baseUrl = (this.config.get('EMBEDDING_API_URL') ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
    this.model = this.config.get('EMBEDDING_MODEL') ?? 'openai/text-embedding-3-small'
  }

  get enabled(): boolean {
    return this.apiKey.length > 0
  }

  get modelName(): string {
    return this.model
  }

  async embed(text: string): Promise<number[]> {
    if (!this.enabled) {
      throw new Error('Embedding service is not configured (EMBEDDING_API_KEY)')
    }
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, input: text }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`embedding request failed: HTTP ${res.status} ${body.slice(0, 200)}`)
    }
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> }
    const embedding = json.data?.[0]?.embedding
    if (!Array.isArray(embedding)) {
      throw new Error('embedding response missing data[0].embedding')
    }
    return embedding
  }
}