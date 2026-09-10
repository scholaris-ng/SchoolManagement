/**
 * Roles and permissions (spec section 5).
 *
 * This list is the mirror image of the client's `src/types/rbac.ts`. The client
 * uses it to decide what to *show*; this copy is what actually enforces access.
 * They must stay in step — a permission the UI offers but the API rejects is a
 * button that fails, and one the API allows but the UI hides is a hole.
 */
export const PERMISSIONS = [
  // Platform
  'platform.manage',
  'school.read',
  'school.manage',
  'settings.manage',
  'branding.manage',
  'audit.read',

  // Academic structure
  'academics.read',
  'academics.manage',

  // People
  'student.read',
  'student.create',
  'student.update',
  'student.delete',
  'student.promote',
  'guardian.read',
  'guardian.manage',
  'staff.read',
  'staff.manage',
  'role.manage',

  // Import
  'import.run',

  // Admissions
  'admission.read',
  'admission.manage',
  'admission.decide',

  // Attendance
  'attendance.read',
  'attendance.manage',

  // Curriculum & teaching
  'curriculum.read',
  'curriculum.manage',
  'scheme.read',
  'scheme.manage',
  'scheme.approve',
  'lessonnote.read',
  'lessonnote.manage',
  'lessonnote.approve',
  'timetable.read',
  'timetable.manage',
  'calendar.read',
  'calendar.manage',

  // Assessment
  'cbt.read',
  'cbt.manage',
  'cbt.take',
  'question.manage',

  // Results
  'result.read',
  'result.enter',
  'result.approve',
  'result.publish',
  'result.amend',
  'reportcard.read',
  'reportcard.generate',
  'transcript.read',
  'transcript.issue',
  'grading.manage',

  // Finance
  'finance.read',
  'fee.manage',
  'invoice.manage',
  'payment.manage',
  'payment.reconcile',
  'discount.manage',

  // Behaviour & safety
  'behaviour.read',
  'behaviour.manage',
  'behaviour.configure',
  'discipline.read',
  'discipline.manage',
  'discipline.review',
  'house.read',
  'house.manage',
  'collection.read',
  'collection.manage',

  // Engagement
  'message.read',
  'message.send',
  'announcement.read',
  'announcement.manage',
  'news.manage',
  'notification.send',
  'website.manage',

  // Analytics
  'analytics.read',
  'analytics.staff',
  'analytics.retention',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET: ReadonlySet<string> = new Set<string>(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

export const ROLES = [
  'SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'TEACHER',
  'FORM_TEACHER',
  'BURSAR',
  'ADMISSION_OFFICER',
  'PARENT',
  'STUDENT',
] as const;

export type RoleName = (typeof ROLES)[number];

/**
 * Sensible defaults only. A school may edit any of these, and may invent roles
 * of its own — which is why every check in the API is against a permission and
 * never against a role name (spec section 5).
 *
 * These sets are the mirror image of `ROLE_PERMISSIONS` in the client's
 * `src/mocks/personas.ts`. They must match: the client hides controls against
 * its copy, so a permission granted here but missing there is a feature nobody
 * can reach, and one granted there but missing here is a button that fails.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  // `platform.manage` implies every other permission, so it is never listed out.
  SUPER_ADMIN: ['platform.manage'],

  SCHOOL_ADMIN: [
    'school.read', 'school.manage', 'settings.manage', 'branding.manage', 'audit.read',
    'academics.read', 'academics.manage',
    'student.read', 'student.create', 'student.update', 'student.delete', 'student.promote',
    'guardian.read', 'guardian.manage', 'staff.read', 'staff.manage', 'role.manage',
    'import.run',
    'admission.read', 'admission.manage', 'admission.decide',
    'attendance.read', 'attendance.manage',
    'curriculum.read', 'curriculum.manage', 'scheme.read', 'scheme.manage', 'scheme.approve',
    'lessonnote.read', 'lessonnote.manage', 'lessonnote.approve',
    'timetable.read', 'timetable.manage', 'calendar.read', 'calendar.manage',
    'cbt.read', 'cbt.manage', 'cbt.take', 'question.manage',
    'result.read', 'result.enter', 'result.approve', 'result.publish', 'result.amend',
    'reportcard.read', 'reportcard.generate', 'transcript.read', 'transcript.issue',
    'grading.manage',
    'finance.read', 'fee.manage', 'invoice.manage', 'payment.manage', 'payment.reconcile',
    'discount.manage',
    'behaviour.read', 'behaviour.manage', 'behaviour.configure',
    'discipline.read', 'discipline.manage', 'discipline.review',
    'house.read', 'house.manage', 'collection.read', 'collection.manage',
    'message.read', 'message.send', 'announcement.read', 'announcement.manage',
    'news.manage', 'notification.send', 'website.manage',
    'analytics.read', 'analytics.staff', 'analytics.retention',
  ],

  PRINCIPAL: [
    'school.read', 'audit.read', 'academics.read', 'academics.manage',
    'student.read', 'student.update', 'student.promote', 'guardian.read', 'staff.read',
    'admission.read', 'admission.decide',
    'attendance.read', 'attendance.manage',
    'curriculum.read', 'curriculum.manage', 'scheme.read', 'scheme.approve',
    'lessonnote.read', 'lessonnote.approve', 'timetable.read', 'timetable.manage',
    'calendar.read', 'calendar.manage', 'cbt.read', 'question.manage',
    'result.read', 'result.approve', 'result.publish', 'result.amend',
    'reportcard.read', 'reportcard.generate', 'transcript.read', 'transcript.issue',
    'grading.manage',
    'finance.read',
    'behaviour.read', 'behaviour.manage', 'behaviour.configure',
    'discipline.read', 'discipline.review', 'house.read', 'house.manage',
    'collection.read', 'message.read', 'message.send',
    'announcement.read', 'announcement.manage', 'notification.send',
    'analytics.read', 'analytics.staff', 'analytics.retention',
  ],

  VICE_PRINCIPAL: [
    'school.read', 'academics.read', 'student.read', 'student.update', 'guardian.read',
    'staff.read',
    'attendance.read', 'attendance.manage', 'curriculum.read', 'scheme.read', 'scheme.approve',
    'lessonnote.read', 'lessonnote.approve', 'timetable.read', 'calendar.read', 'calendar.manage',
    'result.read', 'result.approve', 'reportcard.read', 'behaviour.read', 'behaviour.manage',
    'discipline.read', 'discipline.review', 'house.read', 'collection.read',
    'message.read', 'message.send', 'announcement.read', 'analytics.read',
  ],

  TEACHER: [
    'academics.read', 'student.read', 'guardian.read',
    'attendance.read', 'attendance.manage',
    // A teacher writes the curriculum for the classes they actually teach; the
    // API narrows that to their own assignment and their own authorship.
    'curriculum.read', 'curriculum.manage', 'scheme.read', 'scheme.manage',
    'lessonnote.read', 'lessonnote.manage', 'timetable.read', 'calendar.read',
    'cbt.read', 'cbt.manage', 'question.manage',
    'result.read', 'result.enter', 'reportcard.read',
    'behaviour.read', 'behaviour.manage', 'discipline.read', 'discipline.manage',
    'house.read', 'message.read', 'message.send', 'announcement.read',
  ],

  FORM_TEACHER: [
    'academics.read', 'student.read', 'guardian.read',
    'attendance.read', 'attendance.manage',
    'curriculum.read', 'curriculum.manage', 'scheme.read', 'scheme.manage',
    'lessonnote.read', 'lessonnote.manage', 'timetable.read', 'calendar.read',
    'cbt.read', 'cbt.manage', 'question.manage',
    'result.read', 'result.enter', 'reportcard.read', 'reportcard.generate',
    'behaviour.read', 'behaviour.manage', 'discipline.read', 'discipline.manage',
    'house.read', 'collection.read', 'collection.manage',
    'message.read', 'message.send', 'announcement.read',
  ],

  BURSAR: [
    'school.read', 'academics.read', 'student.read', 'guardian.read',
    'finance.read', 'fee.manage', 'invoice.manage', 'payment.manage',
    'payment.reconcile', 'discount.manage', 'import.run',
    'message.read', 'message.send', 'announcement.read', 'notification.send',
    'analytics.read', 'analytics.retention',
  ],

  ADMISSION_OFFICER: [
    'school.read', 'academics.read', 'student.read', 'student.create',
    'guardian.read', 'guardian.manage',
    'admission.read', 'admission.manage', 'admission.decide',
    'import.run', 'message.read', 'message.send', 'announcement.read', 'analytics.read',
  ],

  PARENT: [
    'student.read', 'attendance.read', 'result.read', 'reportcard.read',
    'finance.read', 'behaviour.read', 'calendar.read',
    'message.read', 'message.send', 'announcement.read', 'collection.read', 'house.read',
  ],

  STUDENT: [
    'attendance.read', 'result.read', 'reportcard.read', 'timetable.read',
    'calendar.read', 'cbt.take', 'announcement.read', 'house.read', 'behaviour.read',
  ],
};

export const ROLE_LABEL: Record<RoleName, string> = {
  SUPER_ADMIN: 'Super administrator',
  SCHOOL_ADMIN: 'School administrator',
  PRINCIPAL: 'Principal',
  VICE_PRINCIPAL: 'Vice principal',
  TEACHER: 'Teacher',
  FORM_TEACHER: 'Form teacher',
  BURSAR: 'Bursar',
  ADMISSION_OFFICER: 'Admissions officer',
  PARENT: 'Parent / guardian',
  STUDENT: 'Student',
};

/** Error codes the client narrows on — see `client/src/types/api.ts`. */
export const ErrorCode = {
  Validation: 'VALIDATION_ERROR',
  Unauthenticated: 'UNAUTHENTICATED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  VersionConflict: 'VERSION_CONFLICT',
  RateLimited: 'RATE_LIMITED',
  Internal: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export const DEFAULT_PAGE_SIZE = 25;

/**
 * The ceiling exists to stop a caller pulling an unbounded page, not to force
 * pickers to paginate. Several screens legitimately want a whole list in one
 * request — the teacher dropdown, the guardian dropdown, a class roster during
 * promotion, a batch of report cards — and each asks for 200. Refusing them at
 * 100 turned a full dropdown into a validation error rather than a short list,
 * which is the worse failure of the two.
 *
 * Note this still truncates silently for a school with more than 200 staff,
 * guardians or pupils in one class. A picker that must be complete needs its
 * own typeahead endpoint, the way `/students/search` already does.
 */
export const MAX_PAGE_SIZE = 200;
