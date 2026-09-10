import type { ListQuery } from '@/types/api';
import { scoped, type Scope } from './query-scope';

/** Cache keys for behaviour, communication, imports, dashboards and public pages. */
export const engagementKeys = {
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
  }
,
} as const;
