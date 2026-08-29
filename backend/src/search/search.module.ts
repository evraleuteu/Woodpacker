import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { EmbeddingService } from './embedding.service'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'

@Module({
  imports: [PrismaModule],
  controllers: [SearchController],
  providers: [EmbeddingService, SearchService],
  exports: [SearchService, EmbeddingService],
})
export class SearchModule {}