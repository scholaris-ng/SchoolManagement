import type { Permission, RoleName } from '@/types/rbac';

/**
 * Default permission sets per role.
 *
 * The real source of truth is the RolePermission table on the server; this
 * mirror exists so the Cypress e2e suite's `cy.login()` can build a realistic
 * stubbed session without drifting from what each role actually gets there —
 * see `cypress/support/session.ts`.
 */
export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
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
    'reportcard.read', 'reportcard.generate', 'transcript.read', 'transcript.issue', 'grading.manage',
    'finance.read', 'fee.manage', 'invoice.manage', 'payment.manage', 'payment.reconcile', 'discount.manage',
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
    'reportcard.read', 'reportcard.generate', 'transcript.read', 'transcript.issue', 'grading.manage',
    'finance.read',
    'behaviour.read', 'behaviour.manage', 'behaviour.configure',
    'discipline.read', 'discipline.review', 'house.read', 'house.manage',
    'collection.read', 'message.read', 'message.send',
    'announcement.read', 'announcement.manage', 'notification.send',
    'analytics.read', 'analytics.staff', 'analytics.retention',
  ],

  VICE_PRINCIPAL: [
    'school.read', 'academics.read', 'student.read', 'student.update', 'guardian.read', 'staff.read',
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
    // A teacher writes the curriculum for the classes they actually teach; the
    // API narrows that to their own assignment and their own authorship.
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
    'school.read', 'academics.read', 'student.read', 'student.create', 'guardian.read', 'guardian.manage',
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

export function permissionsForRoles(roles: RoleName[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) set.add(permission);
  }
  return Array.from(set);
}
