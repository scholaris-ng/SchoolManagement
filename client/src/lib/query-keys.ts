import type { ListQuery } from '@/types/api';

/**
 * Every cache key is namespaced by the active school. Switching tenant can
 * therefore never surface another school's cached rows, which is the
 * client-side half of the tenant-isolation guarantee.
 */
type Scope = string | null | undefined;

const scoped = (schoolId: Scope, ...parts: unknown[]) => ['school', schoolId ?? 'none', ...parts];

export const queryKeys = {
  session: () => ['session'] as const,

  /**
   * Every cached query for one school — the prefix `scoped()` builds every
   * other key from. React Query matches a query key by prefix, so
   * invalidating this evicts everything below it in one call. Use it for a
   * change with no fixed blast radius, such as which term is current: that
   * drives attendance, results, invoicing, the timetable and every
   * dashboard, and enumerating each of those keys individually is exactly
   * how one gets missed.
   */
  all: (schoolId: Scope) => scoped(schoolId),

  school: {
    detail: (schoolId: Scope) => scoped(schoolId, 'school'),
    branches: (schoolId: Scope) => scoped(schoolId, 'branches'),
    settings: (schoolId: Scope) => scoped(schoolId, 'settings'),
    website: (schoolId: Scope) => scoped(schoolId, 'website'),
  },

  academics: {
    sessions: (schoolId: Scope) => scoped(schoolId, 'academic-sessions'),
    terms: (schoolId: Scope, sessionId?: string) => scoped(schoolId, 'terms', sessionId ?? 'all'),
    levels: (schoolId: Scope) => scoped(schoolId, 'levels'),
    classes: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'classes', query ?? {}),
    classDetail: (schoolId: Scope, classId: string) => scoped(schoolId, 'classes', classId),
    subjects: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'subjects', query ?? {}),
    rooms: (schoolId: Scope) => scoped(schoolId, 'rooms'),
    houses: (schoolId: Scope) => scoped(schoolId, 'houses'),
    periods: (schoolId: Scope) => scoped(schoolId, 'periods'),
  },

  students: {
    list: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'students', query ?? {}),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'students', id),
    enrollments: (schoolId: Scope, id: string) => scoped(schoolId, 'students', id, 'enrollments'),
    guardians: (schoolId: Scope, id: string) => scoped(schoolId, 'students', id, 'guardians'),
    documents: (schoolId: Scope, id: string) => scoped(schoolId, 'students', id, 'documents'),
    ledger: (schoolId: Scope, id: string) => scoped(schoolId, 'students', id, 'ledger'),
    results: (schoolId: Scope, id: string, termId?: string) =>
      scoped(schoolId, 'students', id, 'results', termId ?? 'current'),
    attendance: (schoolId: Scope, id: string, range?: ListQuery) =>
      scoped(schoolId, 'students', id, 'attendance', range ?? {}),
    behaviour: (schoolId: Scope, id: string, termId?: string) =>
      scoped(schoolId, 'students', id, 'behaviour', termId ?? 'current'),
    pickupPersons: (schoolId: Scope, id: string) => scoped(schoolId, 'students', id, 'pickup'),
  },

  guardians: {
    list: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'guardians', query ?? {}),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'guardians', id),
    children: (schoolId: Scope, id: string) => scoped(schoolId, 'guardians', id, 'children'),
  },

  staff: {
    list: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'staff', query ?? {}),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'staff', id),
    performance: (schoolId: Scope, termId?: string) =>
      scoped(schoolId, 'staff-performance', termId ?? 'current'),
  },

  roles: {
    list: (schoolId: Scope) => scoped(schoolId, 'roles'),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'roles', id),
  },

  admissions: {
    list: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'admissions', query ?? {}),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'admissions', id),
    funnel: (schoolId: Scope, sessionId?: string) =>
      scoped(schoolId, 'admissions-funnel', sessionId ?? 'current'),
  },

  attendance: {
    register: (schoolId: Scope, classId: string, date: string) =>
      scoped(schoolId, 'attendance', 'register', classId, date),
    summary: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'attendance', 'summary', query ?? {}),
    trend: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'attendance', 'trend', query ?? {}),
  },

  results: {
    schemes: (schoolId: Scope) => scoped(schoolId, 'grading-schemes'),
    schemeDetail: (schoolId: Scope, id: string) => scoped(schoolId, 'grading-schemes', id),
    scoreSheets: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'score-sheets', query ?? {}),
    scoreSheet: (schoolId: Scope, id: string) => scoped(schoolId, 'score-sheets', id),
    reportCard: (schoolId: Scope, studentId: string, termId: string) =>
      scoped(schoolId, 'report-cards', studentId, termId),
    reportCards: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'report-cards', query ?? {}),
    broadsheet: (schoolId: Scope, classId: string, termId: string) =>
      scoped(schoolId, 'broadsheet', classId, termId),
    comments: (schoolId: Scope) => scoped(schoolId, 'comment-templates'),
    analytics: (schoolId: Scope, termId?: string) =>
      scoped(schoolId, 'result-analytics', termId ?? 'current'),
    transcript: (schoolId: Scope, studentId: string) => scoped(schoolId, 'transcripts', studentId),
  },

  finance: {
    overview: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'finance', query ?? {}),
    feeItems: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'fee-items', query ?? {}),
    structures: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'fee-structures', query ?? {}),
    structure: (schoolId: Scope, id: string) => scoped(schoolId, 'fee-structures', id),
    discounts: (schoolId: Scope) => scoped(schoolId, 'discounts'),
    invoices: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'invoices', query ?? {}),
    invoice: (schoolId: Scope, id: string) => scoped(schoolId, 'invoices', id),
    payments: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'payments', query ?? {}),
    payment: (schoolId: Scope, id: string) => scoped(schoolId, 'payments', id),
    receipt: (schoolId: Scope, paymentId: string) => scoped(schoolId, 'receipts', paymentId),
    debtors: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'debtors', query ?? {}),
  },

  curriculum: {
    list: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'curricula', query ?? {}),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'curricula', id),
    topics: (schoolId: Scope, id: string) => scoped(schoolId, 'curricula', id, 'topics'),
    coverage: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'coverage', query ?? {}),
    schemes: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'schemes', query ?? {}),
    scheme: (schoolId: Scope, id: string) => scoped(schoolId, 'schemes', id),
    lessonNotes: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'lesson-notes', query ?? {}),
    lessonNote: (schoolId: Scope, id: string) => scoped(schoolId, 'lesson-notes', id),
  },

  timetable: {
    list: (schoolId: Scope) => scoped(schoolId, 'timetables'),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'timetables', id),
    forClass: (schoolId: Scope, classId: string) => scoped(schoolId, 'timetables', 'class', classId),
    forTeacher: (schoolId: Scope, staffId: string) =>
      scoped(schoolId, 'timetables', 'teacher', staffId),
    periods: (schoolId: Scope) => scoped(schoolId, 'periods'),
  },

  calendar: {
    events: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'calendar', query ?? {}),
    event: (schoolId: Scope, id: string) => scoped(schoolId, 'calendar', id),
  },

  cbt: {
    questions: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'questions', query ?? {}),
    assessments: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'assessments', query ?? {}),
    assessment: (schoolId: Scope, id: string) => scoped(schoolId, 'assessments', id),
    attempt: (schoolId: Scope, id: string) => scoped(schoolId, 'attempts', id),
    attemptResult: (schoolId: Scope, id: string) => scoped(schoolId, 'attempts', id, 'result'),
    myAttempts: (schoolId: Scope) => scoped(schoolId, 'attempts', 'mine'),
  },

  behaviour: {
    traits: (schoolId: Scope) => scoped(schoolId, 'behaviour-traits'),
    scales: (schoolId: Scope) => scoped(schoolId, 'behaviour-scales'),
    observations: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'behaviour-observations', query ?? {}),
    housePoints: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'house-points', query ?? {}),
    houseLeaderboard: (schoolId: Scope, termId?: string) =>
      scoped(schoolId, 'house-leaderboard', termId ?? 'current'),
    studentLeaderboard: (schoolId: Scope, termId?: string) =>
      scoped(schoolId, 'student-leaderboard', termId ?? 'current'),
  },

  discipline: {
    list: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'discipline', query ?? {}),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'discipline', id),
  },

  collection: {
    events: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'collection', query ?? {}),
  },

  messaging: {
    conversations: (schoolId: Scope, query?: ListQuery) =>
      scoped(schoolId, 'conversations', query ?? {}),
    conversation: (schoolId: Scope, id: string) => scoped(schoolId, 'conversations', id),
    contacts: (schoolId: Scope, studentId?: string) =>
      scoped(schoolId, 'message-contacts', studentId ?? 'all'),
  },

  news: {
    list: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'news', query ?? {}),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'news', id),
  },

  announcements: {
    list: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'announcements', query ?? {}),
    detail: (schoolId: Scope, id: string) => scoped(schoolId, 'announcements', id),
  },

  notifications: {
    inbox: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'notifications', query ?? {}),
    unreadCount: (schoolId: Scope) => scoped(schoolId, 'notifications', 'unread-count'),
    preferences: (schoolId: Scope) => scoped(schoolId, 'notification-preferences'),
  },

  imports: {
    jobs: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'imports', query ?? {}),
    templates: (schoolId: Scope, entity: string) => scoped(schoolId, 'import-template', entity),
  },

  audit: {
    list: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'audit', query ?? {}),
  },

  dashboard: {
    admin: (schoolId: Scope) => scoped(schoolId, 'dashboard', 'admin'),
    teacher: (schoolId: Scope) => scoped(schoolId, 'dashboard', 'teacher'),
    parent: (schoolId: Scope) => scoped(schoolId, 'dashboard', 'parent'),
    student: (schoolId: Scope) => scoped(schoolId, 'dashboard', 'student'),
    bursar: (schoolId: Scope) => scoped(schoolId, 'dashboard', 'bursar'),
    retention: (schoolId: Scope, query?: ListQuery) => scoped(schoolId, 'retention', query ?? {}),
  },

  public: {
    verification: (code: string) => ['public', 'verify', code] as const,
    website: (slug: string) => ['public', 'website', slug] as const,
  },
} as const;
