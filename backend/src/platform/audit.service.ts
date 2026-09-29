import { Injectable, Logger } from '@nestjs/common';
import type { AuditCategory } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/auth.js';

export type AuditActor = Pick<AuthUser, 'id' | 'name' | 'role'> | 'system';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records an action. Never throws: a failed audit write must not break the action itself. */
  async log(actor: AuditActor, category: AuditCategory, action: string, target: string, ip?: string): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: actor === 'system'
          ? { actorName: 'System', actorRole: 'system', category, action, target, ip }
          : { actorId: actor.id, actorName: actor.name, actorRole: actor.role.toLowerCase(), category, action, target, ip },
      });
    } catch (err) {
      this.logger.error(`Audit write failed: ${category} ${action} ${target}`, err as Error);
    }
  }
}
