import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PipelineInspectorController } from './pipeline-inspector.controller';
import { PipelineInspectorService } from './pipeline-inspector.service';
import { PipelineInspectorGateway } from './pipeline-inspector.gateway';
import { DevAuthController } from '../auth/dev-auth.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ExtractionModule } from '../extraction/extraction.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    forwardRef(() => ExtractionModule),
    SearchModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET') || 'dev-secret',
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [PipelineInspectorController, DevAuthController],
  providers: [
    PipelineInspectorService,
    PipelineInspectorGateway,
    {
      provide: PrismaService,
      useFactory: () => new PrismaService(),
    },
  ],
  exports: [PipelineInspectorService, PipelineInspectorGateway],
})
export class PipelineInspectorModule {}