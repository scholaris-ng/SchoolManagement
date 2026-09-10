import { AppDataSource } from '../../../infrastructure/database/dataSource';
import type { RequestContext } from '../../../shared/types/context';

/**
 * Which pupils a caller may see at all (spec section 8).
 *
 * This is row-level access, applied *on top of* the `student.read` permission
 * rather than instead of it. A parent holds `student.read` and still must only
 * ever see their own children; a pupil, only themselves. Staff see the school.
 *
 * `null` means unrestricted. An empty array means "none", which is a different
 * answer and must not be collapsed into `null` — that mistake turns a parent
 * with no linked children into an administrator.
 */
export class StudentAccessService {
  static Instance = new StudentAccessService();

  private constructor() {}

  async visibleStudentIds(context: RequestContext): Promise<string[] | null> {
    const { guardianId, studentId } = context.membership;

    if (guardianId) {
      const rows: { studentId: string }[] = await AppDataSource.query(
        `SELECT sg.student_id AS "studentId"
         FROM student_guardians sg
         JOIN students s ON s.id = sg.student_id AND s.deleted_at IS NULL
         WHERE sg.school_id = $1 AND sg.guardian_id = $2`,
        [context.schoolId, guardianId],
      );
      return rows.map((row) => row.studentId);
    }

    if (studentId) return [studentId];

    return null;
  }

  /**
   * Whether this caller may see one particular pupil.
   *
   * Callers treat a false here as "not found" rather than "forbidden": that a
   * given child attends this school is not something an unrelated parent gets
   * to confirm.
   */
  async canSeeStudent(context: RequestContext, studentId: string): Promise<boolean> {
    const visible = await this.visibleStudentIds(context);
    return visible === null || visible.includes(studentId);
  }
}
