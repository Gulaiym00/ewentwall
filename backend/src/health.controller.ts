import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/auth.js';
import { PrismaService } from './prisma/prisma.service.js';

const DB_TIMEOUT_MS = 5000;

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly log = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    try {
      // Answer within a few seconds even if the database hangs, so the host's health check gets a reply.
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`no answer from the database in ${DB_TIMEOUT_MS} ms`)), DB_TIMEOUT_MS)),
      ]);
      return { status: 'ok', database: 'up' };
    } catch (err) {
      this.log.error(`Database check failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
  }
}
