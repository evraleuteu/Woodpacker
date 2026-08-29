import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ExtractionModule } from '../extraction/extraction.module'
import { PrismaModule } from '../prisma/prisma.module'
import { SearchModule } from '../search/search.module'
import { IngestController } from './ingest.controller'
import { IngestService } from './ingest.service'
import {
  CourseLinkProcessor,
  ExtractPdfProcessor,
  RegisterMediaProcessor,
} from './ingest.processor'
import { QUEUES } from './ingest.service'

@Module({
  imports: [
    PrismaModule,
    ExtractionModule,
    SearchModule,
    BullModule.registerQueue(
      { name: QUEUES.extractPdf },
      { name: QUEUES.registerMedia },
      { name: QUEUES.courseLink },
    ),
    BullModule.registerFlowProducer({ name: 'ingest-flow' }),
  ],
  controllers: [IngestController],
  providers: [IngestService, ExtractPdfProcessor, RegisterMediaProcessor, CourseLinkProcessor],
  exports: [IngestService],
})
export class IngestModule {}
