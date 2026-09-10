import type { Permission } from '@/types/rbac';

/** Fixed option lists shared by `roles-settings-page` and its parts. */

export const PERMISSION_GROUPS: {
  id: string;
  label: string;
  description: string;
  permissions: { key: Permission; label: string; hint?: string }[];
}[] = [
  {
    id: 'school',
    label: 'School & platform',
    description: 'Configuration that affects everyone at the school.',
    permissions: [
      { key: 'school.read', label: 'View school profile' },
      { key: 'school.manage', label: 'Edit school profile' },
      { key: 'settings.manage', label: 'Manage school settings' },
      { key: 'branding.manage', label: 'Manage branding' },
      { key: 'role.manage', label: 'Manage roles and access', hint: 'Can grant any permission' },
      { key: 'audit.read', label: 'Read the audit trail' },
      { key: 'website.manage', label: 'Manage the public website' },
    ],
  },
  {
    id: 'academics',
    label: 'Academic structure',
    description: 'Sessions, terms, levels, classes and subjects.',
    permissions: [
      { key: 'academics.read', label: 'View academic structure' },
      { key: 'academics.manage', label: 'Manage academic structure' },
      { key: 'grading.manage', label: 'Configure grading schemes' },
      { key: 'timetable.read', label: 'View timetable' },
      { key: 'timetable.manage', label: 'Manage timetable' },
      { key: 'calendar.read', label: 'View calendar' },
      { key: 'calendar.manage', label: 'Manage calendar' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    description: 'Students, guardians and staff records.',
    permissions: [
      { key: 'student.read', label: 'View students' },
      { key: 'student.create', label: 'Register students' },
      { key: 'student.update', label: 'Edit students' },
      { key: 'student.delete', label: 'Delete students' },
      { key: 'student.promote', label: 'Promote and transfer students' },
      { key: 'guardian.read', label: 'View guardians' },
      { key: 'guardian.manage', label: 'Manage guardians' },
      { key: 'staff.read', label: 'View staff' },
      { key: 'staff.manage', label: 'Manage staff' },
      { key: 'import.run', label: 'Run bulk imports' },
    ],
  },
  {
    id: 'admissions',
    label: 'Admissions',
    description: 'Applications through to enrolment.',
    permissions: [
      { key: 'admission.read', label: 'View applications' },
      { key: 'admission.manage', label: 'Manage applications' },
      { key: 'admission.decide', label: 'Offer, accept and reject' },
    ],
  },
  {
    id: 'teaching',
    label: 'Teaching',
    description: 'Attendance, curriculum and lesson planning.',
    permissions: [
      { key: 'attendance.read', label: 'View attendance' },
      { key: 'attendance.manage', label: 'Take and correct registers' },
      { key: 'curriculum.read', label: 'View curriculum' },
      { key: 'curriculum.manage', label: 'Manage curriculum' },
      { key: 'scheme.read', label: 'View schemes of work' },
      { key: 'scheme.manage', label: 'Write schemes of work' },
      { key: 'scheme.approve', label: 'Approve schemes of work' },
      { key: 'lessonnote.read', label: 'View lesson notes' },
      { key: 'lessonnote.manage', label: 'Write lesson notes' },
      { key: 'lessonnote.approve', label: 'Approve lesson notes' },
    ],
  },
  {
    id: 'results',
    label: 'Assessment & results',
    description: 'Score entry through to publication.',
    permissions: [
      { key: 'result.read', label: 'View results' },
      { key: 'result.enter', label: 'Enter scores' },
      { key: 'result.approve', label: 'Approve results' },
      { key: 'result.publish', label: 'Publish results' },
      {
        key: 'result.amend',
        label: 'Amend published results',
        hint: 'Every change is audited',
      },
      { key: 'reportcard.read', label: 'View report cards' },
      { key: 'reportcard.generate', label: 'Generate report cards' },
      { key: 'transcript.read', label: 'View transcripts' },
      { key: 'transcript.issue', label: 'Issue transcripts' },
      { key: 'cbt.read', label: 'View assessments' },
      { key: 'cbt.manage', label: 'Manage assessments' },
      { key: 'cbt.take', label: 'Sit assessments' },
      { key: 'question.manage', label: 'Manage the question bank' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Fees, invoices and payments.',
    permissions: [
      { key: 'finance.read', label: 'View finance' },
      { key: 'fee.manage', label: 'Manage fee items and structures' },
      { key: 'invoice.manage', label: 'Create and adjust invoices' },
      { key: 'payment.manage', label: 'Record payments' },
      { key: 'payment.reconcile', label: 'Reconcile payments' },
      { key: 'discount.manage', label: 'Manage discounts and scholarships' },
    ],
  },
  {
    id: 'wellbeing',
    label: 'Behaviour & safety',
    description: 'Behaviour, discipline, houses and child collection.',
    permissions: [
      { key: 'behaviour.read', label: 'View behaviour' },
      { key: 'behaviour.manage', label: 'Record behaviour' },
      { key: 'behaviour.configure', label: 'Configure traits and scales' },
      { key: 'discipline.read', label: 'View discipline records' },
      { key: 'discipline.manage', label: 'Log incidents' },
      { key: 'discipline.review', label: 'Review and resolve incidents' },
      { key: 'house.read', label: 'View houses' },
      { key: 'house.manage', label: 'Manage houses and points' },
      { key: 'collection.read', label: 'View child collection' },
      { key: 'collection.manage', label: 'Release children' },
    ],
  },
  {
    id: 'engagement',
    label: 'Communication',
    description: 'Messaging, announcements and the news feed.',
    permissions: [
      { key: 'message.read', label: 'Read messages' },
      { key: 'message.send', label: 'Send messages' },
      { key: 'announcement.read', label: 'Read announcements' },
      { key: 'announcement.manage', label: 'Publish announcements' },
      { key: 'news.manage', label: 'Manage the news feed' },
      { key: 'notification.send', label: 'Send notifications' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Management reporting.',
    permissions: [
      { key: 'analytics.read', label: 'View analytics' },
      { key: 'analytics.staff', label: 'View staff performance' },
      { key: 'analytics.retention', label: 'View retention risk' },
    ],
  },
];
