import { Redis } from 'ioredis'

export interface RedisConnectionOptions {
  host: string
  port: number
  password?: string
  db?: number
}

export function redisConnectionOptions(): RedisConnectionOptions {
  return {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : undefined,
  }
}

/**
 * BullMQ requires `maxRetriesPerRequest: null` on its connections.
 * Producers and consumers must not share a single connection; create one per role.
 */
export function createRedisConnection(): Redis {
  return new Redis({ ...redisConnectionOptions(), maxRetriesPerRequest: null })
}