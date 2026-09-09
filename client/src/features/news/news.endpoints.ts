import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { NewsPost } from '@/types/engagement';

/** Endpoint layer for the school news feed. */
export const NewsEndpoints = {
  fetchAll: (query: ListQuery) => http.get<Paginated<NewsPost>>('/news', { query }),

  fetchById: (id: string) => http.get<NewsPost>(`/news/${id}`),

  create: (values: Partial<NewsPost>) => http.post<NewsPost>('/news', values),

  update: (id: string, values: Partial<NewsPost>) => http.patch<NewsPost>(`/news/${id}`, values),
};
