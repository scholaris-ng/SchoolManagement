import { AppDataSource } from '../../../infrastructure/database/dataSource';
import type { RequestContext } from '../../../shared/types/context';

/**
 * Which classes and subjects a caller may be offered.
 *
 * Every picker in the app is built from `/academics/classes` and
 * `/academics/subjects`, so narrowing them here narrows every dropdown at once.
 * A subject teacher choosing a class should see the three they teach, not the
 * school's forty — an option someone cannot legitimately act on is a mistake
 * waiting to be made.
 *
 * `null` on a field means no restriction: administrators, principals, bursars
 * and admissions officers all work across the whole school.
 */
export interface AcademicScope {
  classIds: string[] | null;
  subjectIds: string[] | null;
  /**
   * Verified (class, subject) pairs — the ground truth for "does this person
   * teach this subject to this class". `classIds` and `subjectIds` are only a
   * flattening of these for single-field filters, and must never be checked
   * independently to answer a paired question: a teacher taking Biology in
   * JSS 1 and Mathematics in SSS 1 has both subjects and both classes in those
   * flat lists, which must not read as "takes Mathematics in JSS 1".
   */
  pairs: { classId: string; subjectId: string }[] | null;
}

const UNRESTRICTED: AcademicScope = { classIds: null, subjectIds: null, pairs: null };

/** Roles whose remit is their own timetable rather than the whole school. */
const TEACHING_ONLY_ROLES = new Set(['TEACHER', 'FORM_TEACHER']);

export class AcademicScopeService {
  static Instance = new AcademicScopeService();

  private constructor() {}

  async forContext(context: RequestContext): Promise<AcademicScope> {
    // Anyone who may edit the academic structure necessarily works across all of
    // it, so the permission is the line rather than the role name.
    if (context.can('academics.manage')) return UNRESTRICTED;

    const { staffId, studentId, guardianId, roles } = context.membership;

    if (studentId || guardianId) {
      // Narrowed to the child's own class once the students table lands in
      // phase 2 (spec section 51). Until then a parent or pupil membership is
      // scoped to nothing rather than to everything — failing closed.
      return { classIds: [], subjectIds: [], pairs: [] };
    }

    if (!staffId) return UNRESTRICTED;

    const teachingOnly = roles.length > 0 && roles.every((role) => TEACHING_ONLY_ROLES.has(role));
    if (!teachingOnly) return UNRESTRICTED;

    const [assignments, formClasses] = await Promise.all([
      AppDataSource.query(
        `SELECT class_id AS "classId", subject_id AS "subjectId"
         FROM teaching_assignments
         WHERE school_id = $1 AND staff_id = $2`,
        [context.schoolId, staffId],
      ) as Promise<{ classId: string; subjectId: string }[]>,
      AppDataSource.query(
        `SELECT class_id AS "classId"
         FROM class_form_teachers
         WHERE school_id = $1 AND staff_id = $2`,
        [context.schoolId, staffId],
      ) as Promise<{ classId: string }[]>,
    ]);

    return {
      // A form teacher's own class counts even when nobody remembered to add it
      // to their teaching list.
      classIds: [
        ...new Set([
          ...assignments.map((row) => row.classId),
          ...formClasses.map((row) => row.classId),
        ]),
      ],
      subjectIds: [...new Set(assignments.map((row) => row.subjectId))],
      // Built from the assignments alone, never from classIds × subjectIds —
      // that cross-product is exactly the bug this field exists to prevent. The
      // form class is left out here too, so it cannot combine with an unrelated
      // subject into a pairing nobody assigned.
      pairs: assignments.map((row) => ({ classId: row.classId, subjectId: row.subjectId })),
    };
  }

  /**
   * Classes a caller may take the daily register for.
   *
   * Narrower than `forContext`: teaching a subject to a class is enough to see
   * its curriculum, but the register is the form teacher's responsibility, not
   * every teacher who passes through the room over the week.
   */
  async formTeacherClassIds(context: RequestContext): Promise<string[] | null> {
    const { staffId, roles } = context.membership;
    if (!staffId) return null;

    const teachingOnly = roles.length > 0 && roles.every((role) => TEACHING_ONLY_ROLES.has(role));
    if (!teachingOnly) return null;

    const rows: { classId: string }[] = await AppDataSource.query(
      `SELECT class_id AS "classId"
       FROM class_form_teachers
       WHERE school_id = $1 AND staff_id = $2`,
      [context.schoolId, staffId],
    );
    return rows.map((row) => row.classId);
  }
}

/**
 * True when `scope` permits the given class, and subject when one is named.
 *
 * With both named and verified pairs present, membership is checked as a pair —
 * "teaches this class" and "teaches this subject somewhere" do not add up to
 * "teaches this subject to this class".
 */
export function scopeAllows(
  scope: AcademicScope,
  target: { classId?: string | null; subjectId?: string | null },
): boolean {
  if (target.classId && target.subjectId && scope.pairs) {
    return scope.pairs.some(
      (pair) => pair.classId === target.classId && pair.subjectId === target.subjectId,
    );
  }
  if (target.classId && scope.classIds && !scope.classIds.includes(target.classId)) return false;
  if (target.subjectId && scope.subjectIds && !scope.subjectIds.includes(target.subjectId)) {
    return false;
  }
  return true;
}
