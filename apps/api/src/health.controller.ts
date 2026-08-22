import { Controller, Get, HttpStatus, Res, SetMetadata } from '@nestjs/common';
import type { Response } from 'express';
import { IS_PUBLIC_METADATA } from './common/http/endpoint.decorator';
import { PrismaService } from './common/prisma/prisma.service';

/**
 * A health check for the hosting environment. It is deliberately not in the
 * contracts - it is not part of the application's public API and has no type
 * link to the frontend.
 */
interface HealthReport {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * An unreachable database has to end in status 503, not 200.
   * Otherwise neither Docker's `HEALTHCHECK` nor a load balancer would ever
   * notice that the instance is useless - the health check would be mere
   * decoration.
   */
  @SetMetadata(IS_PUBLIC_METADATA, true)
  @Get()
  async check(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthReport> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'degraded', database: 'down' };
    }
  }
}
