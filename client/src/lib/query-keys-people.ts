import type { ListQuery } from '@/types/api';
import { scoped, type Scope } from './query-scope';

/** Cache keys for the school itself, its academic structure and its people. */
export const peopleKeys = {
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
  }
,
} as const;
