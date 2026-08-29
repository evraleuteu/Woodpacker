/**
 * Page-level cache + resumable processing.
 * Cache intermediate results per page sha, not entire document.
 * A failure on page 80 must not require reprocessing pages 1–79.
 */

type CacheEntry<T> = { value: T; expiresAt: number }

class PageCache {
  private map = new Map<string, CacheEntry<any>>()
  private ttlMs: number

  constructor(ttlMs = 30 * 60 * 1000) { // 30 min default
    this.ttlMs = ttlMs
  }

  get<T>(key: string): T | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key)
      return undefined
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs?: number) {
    this.map.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.ttlMs) })
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  clear() { this.map.clear() }

  stats() { return { size: this.map.size } }
}

export const pageCache = new PageCache()

export function cacheKey(fileId: string, page: number, stage: string): string {
  return `${fileId}:p${page}:${stage}`
}

/**
 * Simple async memo with cache
 */
export async function withCache<T>(key: string, fn: () => Promise<T>, ttlMs?: number): Promise<T> {
  const cached = pageCache.get<T>(key)
  if (cached !== undefined) return cached
  const result = await fn()
  pageCache.set(key, result, ttlMs)
  return result
}
