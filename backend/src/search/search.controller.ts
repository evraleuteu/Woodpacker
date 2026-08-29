import { Body, Controller, Get, HttpException, HttpStatus, Logger, Post, Query } from '@nestjs/common'
import { SearchService } from './search.service'

@Controller('api/search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name)

  constructor(private readonly search: SearchService) {}

  @Post('exercises')
  async searchExercises(@Body() body: { query?: string; limit?: number }) {
    const query = body?.query?.trim()
    if (!query) {
      throw new HttpException('query required', HttpStatus.BAD_REQUEST)
    }
    const hits = await this.search.searchExercises(query, body.limit ?? 10)
    return { query, count: hits.length, hits }
  }

  @Get('exercises')
  async searchExercisesGet(@Query('q') q?: string, @Query('limit') limit?: string) {
    const query = q?.trim()
    if (!query) {
      throw new HttpException('q required', HttpStatus.BAD_REQUEST)
    }
    const hits = await this.search.searchExercises(query, limit ? Number(limit) : 10)
    return { query, count: hits.length, hits }
  }
}