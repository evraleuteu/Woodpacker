import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from 'ioredis'

export const CACHE_CLIENT = Symbol('CACHE_CLIENT')

/**
 * Redis DB 1 — cache/progress plane (Phase 16). BullMQ queues live on DB 0;
 * this client must never touch queue keys.
 */
@Global()
@Module({
  providers: [
    {
      provide: CACHE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get('REDIS_HOST', '127.0.0.1'),
          port: Number(config.get('REDIS_PORT', 6379)),
          password: config.get('REDIS_PASSWORD') || undefined,
          db: 1,
          maxRetriesPerRequest: null,
        }),
    },
  ],
  exports: [CACHE_CLIENT],
})
export class CacheModule {}
