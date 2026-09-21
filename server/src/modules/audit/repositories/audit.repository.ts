import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditLog } from '../entities/auditLog.entity';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import type { ReferenceType, ResolvedRecord } from '../services/auditReferences';
import { REFERENCE_TABLES } from './auditReferenceTables';

export interface AuditQuery {
  page: number;
  pageSize: number;
  action?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  entityType?: string;
  entityId?: string;
  search?: string;
}

export class AuditRepository {
  static Instance = new AuditRepository();

  private readonly repo = AppDataSource.getRepository(AuditLog);

  private constructor() {}

  async append(entry: Partial<AuditLog>): Promise<AuditLog> {
    return this.repo.save(this.repo.create(entry));
  }

  /** Batched writes for bulk operations — one INSERT rather than one per row. */
  async appendMany(entries: Partial<AuditLog>[]): Promise<void> {
    if (entries.length === 0) return;
    // `save` rather than `insert`: the jsonb `before`/`after` columns are plain
    // objects, which the insert builder's type would otherwise read as raw SQL
    // expressions.
    await this.repo.save(entries.map((entry) => this.repo.create(entry)));
  }

  async fetchPaginated(schoolId: string, query: AuditQuery): Promise<Paginated<AuditLog>> {
    const { page, pageSize, action, severity, entityType, entityId, search } = query;

    const qb = this.repo
      .createQueryBuilder('log')
      .where('log.schoolId = :schoolId', { schoolId })
      .orderBy('log.occurredAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (action) qb.andWhere('log.action = :action', { action });
    if (severity) qb.andWhere('log.severity = :severity', { severity });
    if (entityType) qb.andWhere('log.entityType = :entityType', { entityType });
    if (entityId) qb.andWhere('log.entityId = :entityId', { entityId });

    if (search) {
      qb.andWhere(
        '(log.actorName ILIKE :search OR log.action ILIKE :search OR log.entityLabel ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return paginatedResult(items, page, pageSize, total);
  }

  /**
   * Names for a set of records of one type, scoped to the school so an entry
   * can never surface another school's data. See `REFERENCE_TABLES`.
   */
  async lookupReferences(
    schoolId: string,
    type: ReferenceType,
    ids: string[],
  ): Promise<Map<string, ResolvedRecord>> {
    if (ids.length === 0) return new Map();
    const spec = REFERENCE_TABLES[type];
    const rows: { id: string; label: string | null; removed: boolean }[] = await this.repo.query(
      `SELECT t.id, ${spec.label} AS label,
              ${spec.softDeletable ? '(t.deleted_at IS NOT NULL)' : 'false'} AS removed
         FROM ${spec.from}
        WHERE t.school_id = $1 AND t.id = ANY($2::uuid[])`,
      [schoolId, ids],
    );
    return new Map(
      rows
        .filter((row) => row.label && row.label.trim() !== '')
        .map((row) => [row.id, { label: row.label as string, removed: row.removed }]),
    );
  }

  /**
   * The newest entries, for the dashboard's activity feed.
   *
   * Ordered newest-first here because the client renders the list as given and
   * does not sort it.
   */
  async recentForSchool(schoolId: string, limit: number): Promise<RecentActivityRow[]> {
    return this.repo.query(
      `SELECT id,
              actor_name   AS "actorName",
              action,
              entity_label AS "entityLabel",
              occurred_at  AS "occurredAt"
         FROM audit_logs
        WHERE school_id = $1
        ORDER BY occurred_at DESC
        LIMIT $2`,
      [schoolId, limit],
    );
  }
}

export interface RecentActivityRow {
  id: string;
  actorName: string;
  action: string;
  entityLabel: string | null;
  occurredAt: string;
}
