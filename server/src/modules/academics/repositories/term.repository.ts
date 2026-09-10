import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { Term } from '../entities/term.entity';
import type { TermDTO } from '../dto/academics.dto';

const PROJECTION = `
  t.id, t.school_id AS "schoolId", t.session_id AS "sessionId",
  s.name AS "sessionName", t.name, t.sequence,
  to_char(t.start_date, 'YYYY-MM-DD') AS "startDate",
  to_char(t.end_date,   'YYYY-MM-DD') AS "endDate",
  t.teaching_weeks AS "teachingWeeks", t.is_current AS "isCurrent", t.status
`;

export class TermRepository extends TenantRepository<Term> {
  static Instance = new TermRepository();

  private constructor() {
    super(Term, 'term');
  }

  async fetchForSchool(schoolId: string, sessionId?: string): Promise<TermDTO[]> {
    const params: unknown[] = [schoolId];
    let filter = '';
    if (sessionId) {
      params.push(sessionId);
      filter = 'AND t.session_id = $2';
    }

    return this.repo.query(
      `SELECT ${PROJECTION}
       FROM terms t
       JOIN academic_sessions s ON s.id = t.session_id
       WHERE t.school_id = $1 AND t.deleted_at IS NULL ${filter}
       ORDER BY s.start_date DESC, t.sequence ASC`,
      params,
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<TermDTO | null> {
    const rows: TermDTO[] = await this.repo.query(
      `SELECT ${PROJECTION}
       FROM terms t
       JOIN academic_sessions s ON s.id = t.session_id
       WHERE t.school_id = $1 AND t.id = $2 AND t.deleted_at IS NULL`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async nextSequence(schoolId: string, sessionId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next
       FROM terms
       WHERE school_id = $1 AND session_id = $2 AND deleted_at IS NULL`,
      [schoolId, sessionId],
    );
    return Number(row?.next ?? 1);
  }

  async create(data: DeepPartial<Term>): Promise<Term> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<Term>): Promise<void> {
    await this.repo.update(id, patch as never);
  }

  /** One statement, so the school is never between two current terms. */
  async setCurrent(schoolId: string, termId: string): Promise<void> {
    await this.repo.query(
      `UPDATE terms
         SET is_current = (id = $2),
             status     = CASE WHEN id = $2 THEN 'ACTIVE' ELSE status END,
             updated_at = now()
       WHERE school_id = $1 AND deleted_at IS NULL`,
      [schoolId, termId],
    );
  }

  async deleteBySession(schoolId: string, sessionId: string): Promise<void> {
    await this.repo.softDelete({ schoolId, sessionId });
  }
}
