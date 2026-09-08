import type { Permission, RoleName } from '@/types/rbac';

/**
 * Development personas.
 *
 * These exist so every screen can be exercised as each role while the Express
 * API is being built. They are compiled out of production builds along with the
 * rest of `src/mocks` — see `env.useMockApi`.
 */
export interface DemoPersona {
  email: string;
  name: string;
  roleLabel: string;
  roles: RoleName[];
  /** Which seeded school this persona belongs to. */
  schoolIndex: 0 | 1;
  /** Links the persona to a seeded guardian/student/staff record. */
  link?: { type: 'guardian' | 'student' | 'staff'; index: number };
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    email: 'admin@brightfield.edu.ng',
    name: 'Adaeze Okonkwo',
    roleLabel: 'School administrator · Brightfield Academy',
    roles: ['SCHOOL_ADMIN'],
    schoolIndex: 0,
  },
  {
    email: 'principal@brightfield.edu.ng',
    name: 'Dr Emeka Nwosu',
    roleLabel: 'Principal · Brightfield Academy',
    roles: ['PRINCIPAL'],
    schoolIndex: 0,
  },
  {
    email: 'teacher@brightfield.edu.ng',
    name: 'Funmilayo Adeyemi',
    roleLabel: 'Form teacher · JSS 1 Gold',
    roles: ['TEACHER', 'FORM_TEACHER'],
    schoolIndex: 0,
    link: { type: 'staff', index: 0 },
  },
  {
    email: 'bursar@brightfield.edu.ng',
    name: 'Ibrahim Sule',
    roleLabel: 'Bursar · Brightfield Academy',
    roles: ['BURSAR'],
    schoolIndex: 0,
    link: { type: 'staff', index: 1 },
  },
  {
    email: 'parent@example.com',
    name: 'Mrs Chioma Eze',
    roleLabel: 'Parent · three children enrolled',
    roles: ['PARENT'],
    schoolIndex: 0,
    link: { type: 'guardian', index: 0 },
  },
  {
    email: 'student@brightfield.edu.ng',
    name: 'Tobenna Eze',
    roleLabel: 'Student · JSS 2 Silver',
    roles: ['STUDENT'],
    schoolIndex: 0,
    link: { type: 'student', index: 0 },
  },
  {
    email: 'admin@rivercrest.edu.ng',
    name: 'Grace Bello',
    roleLabel: 'School administrator · Rivercrest School (second tenant)',
    roles: ['SCHOOL_ADMIN'],
    schoolIndex: 1,
  },
];

/**
 * Default permission sets per role. The real source of truth is the RolePermission
 * table on the server; this mirror lets the mock API answer `/auth/session`
 * with a realistic payload.
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
    'curriculum.read', 'scheme.read', 'scheme.manage',
    'lessonnote.read', 'lessonnote.manage', 'timetable.read', 'calendar.read',
    'cbt.read', 'cbt.manage', 'question.manage',
    'result.read', 'result.enter', 'reportcard.read',
    'behaviour.read', 'behaviour.manage', 'discipline.read', 'discipline.manage',
    'house.read', 'message.read', 'message.send', 'announcement.read',
  ],

  FORM_TEACHER: [
    'academics.read', 'student.read', 'guardian.read',
    'attendance.read', 'attendance.manage',
    'curriculum.read', 'scheme.read', 'scheme.manage',
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
