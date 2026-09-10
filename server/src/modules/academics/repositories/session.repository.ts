import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { AcademicSession } from '../entities/academicSession.entity';
import type { AcademicSessionDTO } from '../dto/academics.dto';

export class SessionRepository extends TenantRepository<AcademicSession> {
  static Instance = new SessionRepository();

  private constructor() {
    super(AcademicSession, 'session');
  }

  /**
   * Sessions with their term count.
   *
   * The count is a correlated subquery, so a session with no terms still comes
   * back with zero rather than dropping out of an inner join.
   */
  async fetchForSchool(schoolId: string): Promise<AcademicSessionDTO[]> {
    return this.repo.query(
      `
      SELECT
        s.id, s.school_id AS "schoolId", s.name,
        to_char(s.start_date, 'YYYY-MM-DD') AS "startDate",
        to_char(s.end_date,   'YYYY-MM-DD') AS "endDate",
        s.is_current AS "isCurrent", s.status,
        (
          SELECT COUNT(*)::int FROM terms t
          WHERE t.session_id = s.id AND t.deleted_at IS NULL
        ) AS "termCount"
      FROM academic_sessions s
      WHERE s.school_id = $1 AND s.deleted_at IS NULL
      ORDER BY s.start_date DESC
      `,
      [schoolId],
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<AcademicSessionDTO | null> {
    const rows: AcademicSessionDTO[] = await this.repo.query(
      `
      SELECT
        s.id, s.school_id AS "schoolId", s.name,
        to_char(s.start_date, 'YYYY-MM-DD') AS "startDate",
        to_char(s.end_date,   'YYYY-MM-DD') AS "endDate",
        s.is_current AS "isCurrent", s.status,
        (
          SELECT COUNT(*)::int FROM terms t
          WHERE t.session_id = s.id AND t.deleted_at IS NULL
        ) AS "termCount"
      FROM academic_sessions s
      WHERE s.school_id = $1 AND s.id = $2 AND s.deleted_at IS NULL
      `,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async findByName(schoolId: string, name: string): Promise<AcademicSession | null> {
    return this.repo.findOne({ where: { schoolId, name } });
  }

  async create(data: DeepPartial<AcademicSession>): Promise<AcademicSession> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<AcademicSession>): Promise<void> {
    await this.repo.update(id, patch as never);
  }

  /**
   * Marks one session current and every other one not, in a single statement.
   *
   * Doing it as one UPDATE rather than a read-and-loop means there is no window
   * in which two sessions are both current, or none is.
   */
  async setCurrent(schoolId: string, sessionId: string): Promise<void> {
    await this.repo.query(
      `UPDATE academic_sessions
         SET is_current = (id = $2),
             status     = CASE WHEN id = $2 AND status = 'PLANNED' THEN 'ACTIVE' ELSE status END,
             updated_at = now()
       WHERE school_id = $1 AND deleted_at IS NULL`,
      [schoolId, sessionId],
    );
  }
}
