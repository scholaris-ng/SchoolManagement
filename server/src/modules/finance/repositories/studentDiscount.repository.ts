import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { StudentDiscount } from '../entities/studentDiscount.entity';
import type { StudentDiscountDTO } from '../dto/finance.dto';
import type { ApplicableDiscount } from '../services/discountCalculator';

const PROJECTION = `
  sd.id, sd.student_id AS "studentId",
  concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "studentName",
  sd.discount_id AS "discountId", d.name AS "discountName", d.type, d.mode,
  d.value::float AS value, d.applies_to_fee_item_ids AS "appliesToFeeItemIds",
  sd.session_id AS "sessionId", ses.name AS "sessionName",
  sd.term_id AS "termId", t.name AS "termName",
  COALESCE(u.display_name, 'Unknown') AS "grantedByName",
  sd.created_at AS "grantedAt", sd.note
`;

const JOINS = `
  FROM student_discounts sd
  JOIN students s ON s.id = sd.student_id
  JOIN discounts d ON d.id = sd.discount_id
  LEFT JOIN academic_sessions ses ON ses.id = sd.session_id
  LEFT JOIN terms t ON t.id = sd.term_id
  LEFT JOIN users u ON u.id = sd.granted_by_user_id
`;

export class StudentDiscountRepository extends TenantRepository<StudentDiscount> {
  static Instance = new StudentDiscountRepository();

  private constructor() {
    super(StudentDiscount, 'studentDiscount');
  }

  /** Every grant still in force for one pupil, newest first. Revoked ones stay in the table, not here. */
  async fetchActiveForStudent(schoolId: string, studentId: string): Promise<StudentDiscountDTO[]> {
    return this.repo.query(
      `SELECT ${PROJECTION} ${JOINS}
        WHERE sd.school_id = $1 AND sd.student_id = $2 AND sd.is_active = TRUE
        ORDER BY sd.created_at DESC`,
      [schoolId, studentId],
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<StudentDiscountDTO | null> {
    const rows: StudentDiscountDTO[] = await this.repo.query(
      `SELECT ${PROJECTION} ${JOINS} WHERE sd.school_id = $1 AND sd.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async findEntity(schoolId: string, id: string): Promise<StudentDiscount | null> {
    return this.repo.findOne({ where: { schoolId, id } });
  }

  /** An identical grant already in force — same discount, same scope. */
  async findActiveMatch(
    schoolId: string,
    studentId: string,
    discountId: string,
    sessionId: string | null,
    termId: string | null,
  ): Promise<StudentDiscount | null> {
    return this.repo
      .createQueryBuilder('sd')
      .where('sd.schoolId = :schoolId AND sd.studentId = :studentId', { schoolId, studentId })
      .andWhere('sd.discountId = :discountId AND sd.isActive = TRUE', { discountId })
      .andWhere(sessionId ? 'sd.sessionId = :sessionId' : 'sd.sessionId IS NULL', { sessionId })
      .andWhere(termId ? 'sd.termId = :termId' : 'sd.termId IS NULL', { termId })
      .getOne();
  }

  /**
   * The discounts each of these pupils should be billed with for one term,
   * in the order they were granted. One query for the whole cohort — a bulk
   * run must not make four hundred round trips to find out who has a
   * scholarship.
   *
   * A grant whose discount has since been switched off (or deleted) stops
   * applying, and a pupil holding the same discount under two overlapping
   * scopes — "this term" and "until revoked" — gets it once, not twice.
   */
  async fetchApplicable(
    schoolId: string,
    studentIds: string[],
    sessionId: string,
    termId: string,
    manager?: EntityManager,
  ): Promise<Map<string, ApplicableDiscount[]>> {
    const result = new Map<string, ApplicableDiscount[]>();
    if (studentIds.length === 0) return result;

    const runner = manager ?? this.repo.manager;
    const rows: (ApplicableDiscount & { studentId: string })[] = await runner.query(
      `SELECT "studentId", "discountId", name, type, mode, value, "appliesToFeeItemIds"
         FROM (
           SELECT DISTINCT ON (sd.student_id, sd.discount_id)
                  sd.student_id AS "studentId", sd.discount_id AS "discountId",
                  d.name, d.type, d.mode, d.value::float AS value,
                  d.applies_to_fee_item_ids AS "appliesToFeeItemIds",
                  sd.created_at AS granted_at
             FROM student_discounts sd
             JOIN discounts d ON d.id = sd.discount_id
                             AND d.deleted_at IS NULL AND d.is_active = TRUE
            WHERE sd.school_id = $1
              AND sd.student_id = ANY($2::uuid[])
              AND sd.is_active = TRUE
              AND (sd.session_id IS NULL OR sd.session_id = $3)
              AND (sd.term_id IS NULL OR sd.term_id = $4)
            ORDER BY sd.student_id, sd.discount_id, sd.created_at
         ) grants
        ORDER BY granted_at, "discountId"`,
      [schoolId, studentIds, sessionId, termId],
    );

    for (const { studentId, ...discount } of rows) {
      const list = result.get(studentId) ?? [];
      list.push(discount);
      result.set(studentId, list);
    }
    return result;
  }

  async create(data: DeepPartial<StudentDiscount>): Promise<StudentDiscount> {
    return this.repo.save(this.repo.create(data));
  }

  async revoke(id: string, userId: string): Promise<void> {
    await this.repo.update(
      { id },
      { isActive: false, revokedAt: new Date(), revokedByUserId: userId },
    );
  }
}
