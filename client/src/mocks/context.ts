import { buildSeed, type MockDb } from './seed';
import type { AuthenticatedUser, SchoolMembership } from '@/types/tenant';
import type { Permission } from '@/types/rbac';

/**
 * Request context for the mock API.
 *
 * The important behaviour modelled here is that the tenant is derived from the
 * *session*, never from the `X-School-Id` header alone — a client that names a
 * school it has no membership in is refused, exactly as the real server must
 * behave (spec section 4).
 */
export const db: MockDb = buildSeed();

export interface RequestContext {
  user: AuthenticatedUser;
  membership: SchoolMembership;
  schoolId: string;
  permissions: Permission[];
  can: (permission: Permission) => boolean;
}

/** Identity + the membership a request is acting under, before any access check. */
export function findMembership(request: Request): { user: AuthenticatedUser; membership: SchoolMembership } | null {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token.startsWith('mock-token:')) return null;

  const email = token.slice('mock-token:'.length);
  const user = db.users.find((candidate) => candidate.email === email);
  if (!user) return null;

  const requestedSchoolId = request.headers.get('x-school-id');
  const membership =
    user.memberships.find((entry) => entry.schoolId === requestedSchoolId) ?? user.memberships[0];
  if (!membership) return null;

  return { user, membership };
}

/**
 * Why a staff membership may not be used right now, or `null` if it's fine.
 * A school's own roster is the single source of truth for this — there is no
 * separate "suspend this login" switch to forget to flip.
 */
export function staffBlockReason(membership: SchoolMembership): string | null {
  if (!membership.staffId) return null;
  const staff = db.staff.find((entry) => entry.id === membership.staffId);
  if (staff?.status === 'ON_LEAVE') {
    return 'This staff account is on leave and cannot sign in. Contact your school administrator.';
  }
  if (staff?.status === 'EXITED') {
    return 'This staff account has exited the school and can no longer sign in. Contact your school administrator.';
  }
  return null;
}

export function resolveContext(request: Request): RequestContext | null {
  const found = findMembership(request);
  if (!found) return null;
  const { user, membership } = found;

  // Blocked immediately, not just at the next sign-in: a school marking someone
  // on leave mid-session must not leave their existing session usable.
  if (staffBlockReason(membership)) return null;

  const permissions = membership.permissions;

  return {
    user,
    membership,
    schoolId: membership.schoolId,
    permissions,
    can: (permission) =>
      permissions.includes(permission) || permissions.includes('platform.manage'),
  };
}

/** Every list handler goes through this, so nothing can leak across tenants. */
export function scoped<T extends { schoolId: string }>(rows: T[], schoolId: string): T[] {
  return rows.filter((row) => row.schoolId === schoolId);
}

/**
 * The session the school is actually working in.
 *
 * The current *term* is the switch an administrator throws, so its session is
 * the authoritative answer; the flag on the session itself is a mirror of that
 * and only breaks the tie when no term is marked current at all.
 */
export function currentSession(schoolId: string) {
  const term = scoped(db.terms, schoolId).find((entry) => entry.isCurrent);
  const sessions = scoped(db.sessions, schoolId);
  return (
    (term && sessions.find((entry) => entry.id === term.sessionId)) ??
    sessions.find((entry) => entry.isCurrent) ??
    sessions[0] ??
    null
  );
}

/**
 * A parent or student sees only their own records. This mirrors the row-level
 * restriction the API applies on top of permission checks.
 */
export function visibleStudentIds(context: RequestContext): string[] | null {
  if (context.membership.guardianId) {
    return db.studentGuardians
      .filter((link) => link.guardianId === context.membership.guardianId)
      .map((link) => link.studentId);
  }
  if (context.membership.studentId) return [context.membership.studentId];
  return null; // Staff see the whole school.
}

/**
 * Which classes and subjects a caller may be *offered*.
 *
 * Every picker in the app is built from `/academics/classes` and
 * `/academics/subjects`, so narrowing them here narrows every dropdown at
 * once. A subject teacher choosing a class to mark attendance for should see
 * the three classes they teach, not the school's forty — an option a person
 * cannot legitimately act on is a mistake waiting to be made.
 *
 * `null` on either field means "no restriction": administrators, principals,
 * bursars and admissions officers all work across the whole school.
 */
export interface AcademicScope {
  classIds: string[] | null;
  subjectIds: string[] | null;
  /**
   * Verified (class, subject) pairs — the ground truth for "does this person
   * teach this subject in this class". `classIds` and `subjectIds` are only
   * a flattening of those pairs for simple single-field filters (a class
   * picker, a subject picker); they must never be checked independently to
   * answer a paired question. A teacher who teaches Biology to JSS 1 and
   * Mathematics to SSS 1 has both "Biology" and "Mathematics" in
   * `subjectIds` and both "JSS 1" and "SSS 1" in `classIds`, but that must
   * not be read as "teaches Mathematics to JSS 1" — `pairs` is what actually
   * answers that. `null` means unrestricted, same as the other fields.
   */
  pairs: { classId: string; subjectId: string }[] | null;
}

const UNRESTRICTED: AcademicScope = { classIds: null, subjectIds: null, pairs: null };

/** Roles whose remit is their own timetable rather than the whole school. */
const TEACHING_ONLY_ROLES = new Set(['TEACHER', 'FORM_TEACHER']);

export function academicScope(context: RequestContext): AcademicScope {
  // A student sees their own class; a parent, their children's.
  const studentIds = visibleStudentIds(context);
  if (studentIds) {
    const classIds = Array.from(
      new Set(
        db.students
          .filter((student) => studentIds.includes(student.id))
          .map((student) => student.currentClassId)
          .filter((classId): classId is string => Boolean(classId)),
      ),
    );
    const levelIds = new Set(
      db.classes.filter((entry) => classIds.includes(entry.id)).map((entry) => entry.levelId),
    );
    return {
      classIds,
      subjectIds: scoped(db.subjects, context.schoolId)
        .filter((subject) => subject.levelIds.some((levelId) => levelIds.has(levelId)))
        .map((subject) => subject.id),
      // A student genuinely takes every subject offered at their level, so
      // there is no narrower pairing to enforce — leaving this null falls
      // back to the independent classId/subjectId checks above, which is the
      // correct (and only) relationship here.
      pairs: null,
    };
  }

  // Anyone who may edit the academic structure necessarily works across all of
  // it, so `academics.manage` is the line rather than the role name.
  if (context.can('academics.manage')) return UNRESTRICTED;

  const { staffId, roles } = context.membership;
  if (!staffId) return UNRESTRICTED;
  const teachingOnly =
    roles.length > 0 && roles.every((role) => TEACHING_ONLY_ROLES.has(role));
  if (!teachingOnly) return UNRESTRICTED; // Bursars, admissions officers, and so on.

  const staff = db.staff.find((entry) => entry.id === staffId);
  if (!staff) return UNRESTRICTED;

  // A form teacher's own class counts even when nobody remembered to add it to
  // the teaching list.
  const formClassIds = scoped(db.classes, context.schoolId)
    .filter((entry) => entry.formTeacherIds.includes(staff.id))
    .map((entry) => entry.id);

  return {
    classIds: Array.from(new Set([...staff.classIds, ...formClassIds])),
    subjectIds: Array.from(new Set(staff.subjectIds)),
    // Deliberately built from teachingAssignments alone, not from classIds ×
    // subjectIds — that cross-product is exactly the bug this field exists
    // to prevent. The form teacher's own class is left out too: it only
    // widens `classIds` above, so it can't combine with some unrelated
    // subject the teacher happens to teach elsewhere into a pairing nobody
    // actually assigned.
    pairs: staff.teachingAssignments.map((entry) => ({
      classId: entry.classId,
      subjectId: entry.subjectId,
    })),
  };
}

/**
 * True when `scope` permits the given class (and subject, when named).
 *
 * When both a class and a subject are named and `scope` carries verified
 * pairs, membership is checked as a pair, not as two independent set
 * memberships — "teaches this class" and "teaches this subject somewhere"
 * do not add up to "teaches this subject in this class".
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

/**
 * Classes a caller may take the daily register for.
 *
 * Narrower than `academicScope`: teaching a subject to a class is enough to
 * see its curriculum, but the daily register is the *form* teacher's
 * responsibility, not every teacher who passes through the room over the
 * week. `null` means unrestricted — administrators, principals and vice
 * principals all need to see every class's attendance, so only the
 * teaching-only roles are narrowed here.
 */
export function formTeacherClassIds(context: RequestContext): string[] | null {
  const { staffId, roles } = context.membership;
  if (!staffId) return null;
  const teachingOnly = roles.length > 0 && roles.every((role) => TEACHING_ONLY_ROLES.has(role));
  if (!teachingOnly) return null;

  return scoped(db.classes, context.schoolId)
    .filter((entry) => entry.formTeacherIds.includes(staffId))
    .map((entry) => entry.id);
}
