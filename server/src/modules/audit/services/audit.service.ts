import type { RequestContext } from '../../../shared/types/context';
import { NotificationsService } from '../../notifications/services/notifications.service';
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
    this.announceIfCritical(context, event);
  }

  /**
   * An entry for something that happened without anybody signed in.
   *
   * The public website is the only surface that reaches a write with no
   * session: a family submitting an application has no user id, no membership
   * and no role. The entry still has to exist, so the actor is recorded by the
   * name they gave and the address they came from, and `actorUserId` stays
   * null rather than being attributed to whoever happens to read it later.
   */
  async recordSystem(
    schoolId: string,
    event: AuditEvent & {
      actorName: string;
      actorRole?: string;
      ipAddress?: string | null;
      userAgent?: string | null;
      requestId?: string;
    },
  ): Promise<void> {
    try {
      await this.repo.append({
        schoolId,
        actorUserId: null,
        actorName: event.actorName,
        actorRole: event.actorRole ?? 'Public',
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        entityLabel: event.entityLabel ?? null,
        before: event.before ?? null,
        after: event.after ?? null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        requestId: event.requestId ?? null,
        severity: event.severity ?? 'INFO',
      });
    } catch (error) {
      console.error(`[${event.requestId ?? 'public'}] Audit write failed for ${event.action}:`, error);
    }
  }

  async recordMany(context: RequestContext, events: AuditEvent[]): Promise<void> {
    if (events.length === 0) return;
    try {
      await this.repo.appendMany(events.map((event) => this.toRow(context, event)));
    } catch (error) {
      console.error(`[${context.requestId}] Batched audit write failed:`, error);
    }
    events.forEach((event) => this.announceIfCritical(context, event));
  }

  /**
   * A critical entry is one somebody needs to know about, not merely one worth
   * keeping — so the administrators are told, and are told by the same call
   * that already decided the event was critical. As later modules start writing
   * audit entries this keeps working with no further wiring.
   *
   * Deliberately fire-and-forget: `notifySchoolAdmins` swallows its own
   * failures, and an audit call must stay as unfailing as it was before.
   */
  private announceIfCritical(context: RequestContext, event: AuditEvent): void {
    if (event.severity !== 'CRITICAL') return;

    void NotificationsService.Instance.notifySchoolAdmins(context.schoolId, {
      category: 'SYSTEM',
      title: 'Critical change recorded',
      body: `${context.user.displayName} performed ${event.action}${
        event.entityLabel ? ` on ${event.entityLabel}` : ''
      }.`,
      actionUrl: '/audit',
      severity: 'CRITICAL',
      entityType: event.entityType,
      entityId: event.entityId,
      exceptUserId: context.user.id,
    });
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
