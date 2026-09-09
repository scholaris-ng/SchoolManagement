import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { Announcement } from '@/types/engagement';

/**
 * Endpoint layer for announcements.
 *
 * The channels sent on a save are *requests*, not guarantees: the server
 * honours each recipient's notification preferences and records what was
 * actually delivered on each channel (spec section 28).
 */
export const AnnouncementEndpoints = {
  fetchAll: (query: ListQuery) => http.get<Paginated<Announcement>>('/announcements', { query }),

  fetchById: (id: string) => http.get<Announcement>(`/announcements/${id}`),

  create: (values: Partial<Announcement>) => http.post<Announcement>('/announcements', values),

  update: (id: string, values: Partial<Announcement>) =>
    http.patch<Announcement>(`/announcements/${id}`, values),
};
