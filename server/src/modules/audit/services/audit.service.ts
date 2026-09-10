import type { RequestContext } from '../../../shared/types/context';
import { AuditRepository, type AuditQuery } from '../repositories/audit.repository';
import type { AuditLog } from '../entities/auditLog.entity';
import type { Paginated } from '../../../shared/response/apiResponse';

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
}

/**
 * The abstraction services depend on (spec section 2, `IAuditService`), so a
 * caller never reaches for the repository or the entity directly.
 */
export interface IAuditService {
  record(context: RequestContext, event: AuditEvent): Promise<void>;
  recordMany(context: RequestContext, events: AuditEvent[]): Promise<void>;
}

/**
 * Who changed what (spec section 33).
 *
 * Recording never fails the operation it describes. A permission change that
 * succeeded but whose log write failed must not be rolled back and reported as
 * an error to the user — the change happened, and the right response is a
 * server-side error log, not a lie to the caller.
 */
export class AuditService implements IAuditService {
  static Instance = new AuditService();

  private constructor(private readonly repo = AuditRepository.Instance) {}

  async record(context: RequestContext, event: AuditEvent): Promise<void> {
    try {
      await this.repo.append(this.toRow(context, event));
    } catch (error) {
      console.error(`[${context.requestId}] Audit write failed for ${event.action}:`, error);
    }
  }

  async recordMany(context: RequestContext, events: AuditEvent[]): Promise<void> {
    if (events.length === 0) return;
    try {
      await this.repo.appendMany(events.map((event) => this.toRow(context, event)));
    } catch (error) {
      console.error(`[${context.requestId}] Batched audit write failed:`, error);
    }
  }

  async fetch(context: RequestContext, query: AuditQuery): Promise<Paginated<AuditLog>> {
    return this.repo.fetchPaginated(context.schoolId, query);
  }

  private toRow(context: RequestContext, event: AuditEvent): Partial<AuditLog> {
    return {
      schoolId: context.schoolId,
      actorUserId: context.user.id,
      // Captured as they are now. The entry must still read correctly after the
      // person is renamed or leaves the school.
      actorName: context.user.displayName,
      actorRole:
        context.membership.roles[0] ?? context.membership.customRoleNames[0] ?? 'Member',
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      entityLabel: event.entityLabel ?? null,
      before: event.before ?? null,
      after: event.after ?? null,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
      severity: event.severity ?? 'INFO',
    };
  }
}
