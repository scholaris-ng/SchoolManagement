/**
 * Roles and granular permissions (spec section 5).
 *
 * Role names are convenience defaults only — every authorisation decision in
 * the UI is made against a *permission*, so a school that invents its own role
 * still gets correct navigation and controls. The backend remains the
 * authority; hiding UI here is UX, never security.
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

export interface Role {
  id: string;
  schoolId: string | null;
  name: string;
  key: string;
  description?: string;
  isSystem: boolean;
  permissions: Permission[];
  memberCount?: number;
}

/** The persona a dashboard is rendered for, derived from the active membership. */
export type PersonaKey = 'admin' | 'teacher' | 'parent' | 'student' | 'bursar';

export const ROLE_PERSONA: Record<RoleName, PersonaKey> = {
  SUPER_ADMIN: 'admin',
  SCHOOL_ADMIN: 'admin',
  PRINCIPAL: 'admin',
  VICE_PRINCIPAL: 'admin',
  TEACHER: 'teacher',
  FORM_TEACHER: 'teacher',
  BURSAR: 'bursar',
  ADMISSION_OFFICER: 'admin',
  PARENT: 'parent',
  STUDENT: 'student',
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
