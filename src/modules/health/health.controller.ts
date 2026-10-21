import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators';

@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Liveness: process is up. */
  @Get()
  live() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  /** Readiness: database reachable within 2s. */
  @Get('ready')
  async ready() {
    try {
      await Promise.race([
        this.ds.query('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000).unref()),
      ]);
      return { status: 'ready', database: 'up' };
    } catch {
      throw new ServiceUnavailableException('Database not reachable');
    }
  }
}
