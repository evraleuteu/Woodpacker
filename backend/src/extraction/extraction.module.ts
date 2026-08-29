import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { EXTRACTION_QUEUE, ExtractionProcessor } from './extraction.processor'
import { ExtractionController } from './extraction.controller'
import { ExtractionService } from './extraction.service'
import { SearchModule } from '../search/search.module'

@Module({
  imports: [BullModule.registerQueue({ name: EXTRACTION_QUEUE }), SearchModule],
  controllers: [ExtractionController],
  providers: [ExtractionService, ExtractionProcessor],
  exports: [ExtractionService],
})
export class ExtractionModule {}