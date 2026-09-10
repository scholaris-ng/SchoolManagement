import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditLog } from '../entities/auditLog.entity';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';

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
}
