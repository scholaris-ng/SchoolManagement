import { http } from '@/lib/http';
import type { School } from '@/types/tenant';
import type { Role, Permission } from '@/types/rbac';
import type {
  WebsiteContent,
  AuditLogEntry,
  BirthdayRunSummary,
  SmsMessage,
  SmsStatus,
} from '@/types/engagement';
import type { ListQuery, Paginated } from '@/types/api';

export interface SaveRoleInput {
  name?: string;
  description?: string;
  permissions: Permission[];
}

/**
 * What `PATCH /schools/current` actually accepts: the server deep-merges
 * `settings` and `branding` into the existing row rather than replacing them
 * (see `SchoolService.updateCurrent`), so a caller may send just the one key
 * it means to change — a toggle's autosave does exactly that, deliberately
 * leaving out whatever else `Partial<School>` would otherwise require in full.
 */
export type SchoolUpdatePatch = Omit<Partial<School>, 'settings' | 'branding'> & {
  settings?: Partial<School['settings']>;
  branding?: Partial<School['branding']>;
};

/**
 * Endpoint layer for school settings, roles, the public website and the audit
 * log. The `version` argument travels as `If-Match`: two administrators editing
 * branding at the same time must not silently overwrite one another (spec §34).
 */
export const SettingsEndpoints = {
  fetchSchool: () => http.get<School>('/schools/current'),

  updateSchool: (values: SchoolUpdatePatch, version: number) =>
    http.patch<School>('/schools/current', values, { version }),

  fetchRoles: () => http.get<Role[]>('/roles'),

  createRole: (values: SaveRoleInput) => http.post<Role>('/roles', values),

  updateRole: (id: string, values: SaveRoleInput) => http.patch<Role>(`/roles/${id}`, values),

  fetchWebsite: () => http.get<WebsiteContent>('/website'),

  updateWebsite: (values: Partial<WebsiteContent>) =>
    http.patch<WebsiteContent>('/website', values),

  fetchAuditLog: (query: ListQuery) => http.get<Paginated<AuditLogEntry>>('/audit', { query }),

  // ─── Outbound SMS ──────────────────────────────────────────────────────────

  fetchSmsStatus: () => http.get<SmsStatus>('/messaging/sms/status'),

  fetchSmsLog: (query: ListQuery & { purpose?: string; status?: string }) =>
    http.get<Paginated<SmsMessage>>('/messaging/sms', { query }),

  sendTestSms: (values: { to: string; message: string }) =>
    http.post<SmsMessage | null>('/messaging/sms/test', values),

  /** Today's birthday greetings for this school, now. Anyone already greeted is skipped. */
  runBirthdayGreetings: () => http.post<BirthdayRunSummary>('/messaging/birthday-greetings/run'),
};
