import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { CacheModule } from './cache/cache.module'
import { ExtractionModule } from './extraction/extraction.module'
import { IngestModule } from './ingest/ingest.module'
import { PipelineInspectorModule } from './pipeline-inspector/pipeline-inspector.module'
import { PrismaModule } from './prisma/prisma.module'
import { SearchModule } from './search/search.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', '127.0.0.1'),
          port: Number(config.get('REDIS_PORT', 6379)),
          password: config.get('REDIS_PASSWORD') || undefined,
          db: Number(config.get('REDIS_DB', 0)),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5_000,
            // Jitter avoids thundering-herd retries across workers.
          },
          removeOnComplete: false,
          removeOnFail: false,
        },
      }),
    }),
    PrismaModule,
    CacheModule,
    ExtractionModule,
    IngestModule,
    PipelineInspectorModule,
    SearchModule,
  ],
})
export class AppModule {}