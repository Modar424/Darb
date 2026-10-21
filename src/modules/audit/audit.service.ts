import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from '../../database/entities';
import { redact } from '../../common/logging/json-logger';
import type { RequestMeta } from '../../common/types';

export interface AuditEvent {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  meta?: RequestMeta;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  /**
   * Records a security-relevant event. Metadata is redacted so credentials/tokens can never be persisted.
   * Pass `manager` to write inside the caller's transaction (failure then rolls the transaction back).
   * Without a manager the write is best-effort and never breaks the primary operation.
   */
  async record(event: AuditEvent, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(AuditLog) : this.repo;
    const row = repo.create({
      actorId: event.actorId ?? null,
      action: event.action,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      metadata: event.metadata ? (redact(event.metadata) as Record<string, unknown>) : null,
      ipAddress: event.meta?.ip?.slice(0, 45) ?? null,
      userAgent: event.meta?.userAgent?.slice(0, 255) ?? null,
    });
    if (manager) {
      await repo.save(row);
      return;
    }
    try {
      await repo.save(row);
    } catch (err) {
      this.logger.error(
        `Failed to write audit event ${event.action}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
