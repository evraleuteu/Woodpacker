import { Controller, Get, ForbiddenException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Dev-only token issuer for the local Pipeline Inspector console.
 * There is no login flow in this app; this endpoint mints a short-lived
 * developer JWT so the local frontend can call the guarded inspector API
 * and gateway. Disabled unless NODE_ENV !== 'production'.
 */
@Controller('api/auth')
export class DevAuthController {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Get('dev-token')
  issueDevToken(): { token: string } {
    const allowDevToken = this.config.get('ALLOW_DEV_TOKEN') === 'true' || this.config.get('ENABLE_DEV_AUTH') === 'true';
    if (this.config.get('NODE_ENV') === 'production' && !allowDevToken) {
      throw new ForbiddenException('Dev token endpoint is disabled in production (set ALLOW_DEV_TOKEN=true to enable)');
    }

    const expiresIn = '1h';
    const token = this.jwtService.sign(
      {
        sub: 'local@woodpacker.local',
        email: 'local@woodpacker.local',
        role: 'developer',
      },
      { expiresIn },
    );
    return { token };
  }
}
