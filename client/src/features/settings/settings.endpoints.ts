import { http } from '@/lib/http';
import type { School } from '@/types/tenant';
import type { Role, Permission } from '@/types/rbac';
import type { WebsiteContent, AuditLogEntry } from '@/types/engagement';
import type { ListQuery, Paginated } from '@/types/api';

export interface SaveRoleInput {
  name?: string;
  description?: string;
  permissions: Permission[];
}

/**
 * Endpoint layer for school settings, roles, the public website and the audit
 * log. The `version` argument travels as `If-Match`: two administrators editing
 * branding at the same time must not silently overwrite one another (spec §34).
 */
export const SettingsEndpoints = {
  fetchSchool: () => http.get<School>('/schools/current'),

  updateSchool: (values: Partial<School>, version: number) =>
    http.patch<School>('/schools/current', values, { version }),

  fetchRoles: () => http.get<Role[]>('/roles'),

  createRole: (values: SaveRoleInput) => http.post<Role>('/roles', values),

  updateRole: (id: string, values: SaveRoleInput) => http.patch<Role>(`/roles/${id}`, values),

  fetchWebsite: () => http.get<WebsiteContent>('/website'),

  updateWebsite: (values: Partial<WebsiteContent>) =>
    http.patch<WebsiteContent>('/website', values),

  fetchAuditLog: (query: ListQuery) => http.get<Paginated<AuditLogEntry>>('/audit', { query }),
};
