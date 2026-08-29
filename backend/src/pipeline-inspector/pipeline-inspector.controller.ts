import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { PipelineInspectorService } from './pipeline-inspector.service';
import {
  PipelineSearchDto,
  ExercisePipelineViewDto,
  PipelineEventDto,
  ReplayPipelineDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UseGuards } from '@nestjs/common';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'developer', 'superadmin')
@Controller('api/pipeline-inspector')
export class PipelineInspectorController {
  constructor(private readonly inspector: PipelineInspectorService) {}

  @Post('search')
  async searchExercises(@Body() dto: PipelineSearchDto): Promise<ExercisePipelineViewDto[]> {
    return this.inspector.searchExercises(dto);
  }

  @Get('exercise/:exerciseId')
  async getExerciseView(@Param('exerciseId') exerciseId: string): Promise<ExercisePipelineViewDto> {
    return this.inspector.getExercisePipelineView(exerciseId);
  }

  @Get('exercise/:exerciseId/events')
  async getExerciseEvents(@Param('exerciseId') exerciseId: string): Promise<PipelineEventDto[]> {
    return this.inspector.getPipelineEvents(exerciseId);
  }

  @Post('exercise/:exerciseId/replay')
  async replayPipeline(
    @Param('exerciseId') exerciseId: string,
    @Body() dto: ReplayPipelineDto,
  ): Promise<{ success: boolean; message: string; jobId?: string }> {
    return this.inspector.replayPipeline(exerciseId, dto.stages);
  }

  @Get('health')
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        extraction: 'available',
        search: 'available',
      },
    };
  }
}