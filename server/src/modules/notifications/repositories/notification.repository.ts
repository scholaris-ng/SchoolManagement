import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { Notification } from '../entities/notification.entity';
import type { NotificationDTO } from '../dto/notifications.dto';

const PROJECTION = `
  n.id, n.school_id AS "schoolId", n.category, n.title, n.body,
  n.action_url AS "actionUrl", n.read_at AS "readAt", n.created_at AS "createdAt",
  n.severity, n.entity_type AS "entityType", n.entity_id AS "entityId"
`;

export interface NotificationFilter {
  page: number;
  pageSize: number;
  search?: string;
}

/**
 * Every method takes both the school and the user.
 *
 * An inbox is the one place where tenant scoping alone is not enough: two
 * administrators at the same school must not read each other's notifications,
 * so `user_id` is part of the predicate on reads and writes alike.
 */
export class NotificationRepository extends TenantRepository<Notification> {
  static Instance = new NotificationRepository();

  private constructor() {
    super(Notification, 'notification');
  }

  async fetchPaginated(
    schoolId: string,
    userId: string,
    filter: NotificationFilter,
  ): Promise<Paginated<NotificationDTO>> {
    const params: unknown[] = [schoolId, userId];
    const where = ['n.school_id = $1', 'n.user_id = $2'];

    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(`(n.title ILIKE $${i} OR n.body ILIKE $${i})`);
    }

    const whereSql = where.join(' AND ');

    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total FROM notifications n WHERE ${whereSql}`,
      params,
    );

    // Newest first, always. An inbox ordered any other way is not an inbox, so
    // this is not driven by the sort parameters the shared list query carries.
    const rows: NotificationDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
       FROM notifications n
       WHERE ${whereSql}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );

    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  async findOneDTO(
    schoolId: string,
    userId: string,
    id: string,
  ): Promise<NotificationDTO | null> {
    const rows: NotificationDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
       FROM notifications n
       WHERE n.school_id = $1 AND n.user_id = $2 AND n.id = $3`,
      [schoolId, userId, id],
    );
    return rows[0] ?? null;
  }

  async countUnread(schoolId: string, userId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COUNT(*)::int AS total
         FROM notifications
        WHERE school_id = $1 AND user_id = $2 AND read_at IS NULL`,
      [schoolId, userId],
    );
    return Number(row?.total ?? 0);
  }

  /**
   * Idempotent: reading an already-read notification is a no-op rather than an
   * error, and `COALESCE` keeps the original timestamp instead of moving it.
   * False means no such row for this user — which is what "not found" means to
   * the caller, whether the id is wrong or belongs to somebody else.
   */
  async markRead(schoolId: string, userId: string, id: string): Promise<boolean> {
    const affected = await this.runUpdate(
      `UPDATE notifications
          SET read_at = COALESCE(read_at, now()), updated_at = now()
        WHERE school_id = $1 AND user_id = $2 AND id = $3`,
      [schoolId, userId, id],
    );
    return affected > 0;
  }

  /** Returns how many were *newly* marked, so the client can report a real number. */
  async markAllRead(schoolId: string, userId: string): Promise<number> {
    return this.runUpdate(
      `UPDATE notifications
          SET read_at = now(), updated_at = now()
        WHERE school_id = $1 AND user_id = $2 AND read_at IS NULL`,
      [schoolId, userId],
    );
  }

  /**
   * How many rows an UPDATE actually touched.
   *
   * TypeORM's raw `query()` returns `[rows, rowCount]` for UPDATE and DELETE,
   * unlike the plain row array a SELECT gives back. Reading that tuple as if it
   * were the rows themselves reports 2 for every statement — including ones
   * that matched nothing — so the shape is unpacked here once rather than at
   * each call site.
   */
  private async runUpdate(sql: string, params: unknown[]): Promise<number> {
    const result = await this.repo.query(sql, params);
    if (Array.isArray(result) && result.length === 2 && typeof result[1] === 'number') {
      return result[1];
    }
    return 0;
  }

  async createMany(rows: DeepPartial<Notification>[]): Promise<Notification[]> {
    if (rows.length === 0) return [];
    return this.repo.save(rows.map((row) => this.repo.create(row)));
  }
}
