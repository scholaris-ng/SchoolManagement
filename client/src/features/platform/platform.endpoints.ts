import { http } from '@/lib/http';
import type { PlatformSchool, PlatformSmsStatus, SchoolSmsCredits } from '@/types/platform';

export const PlatformEndpoints = {
  /** Every school, soonest to lapse first. */
  fetchSchools: () => http.get<PlatformSchool[]>('/platform/schools'),

  /** Adds `months` months to the school's access, and returns the school as it now stands. */
  activateSchool: (id: string, months: number) =>
    http.post<PlatformSchool>(`/platform/schools/${id}/activate`, { months }),

  /** The gateway account's balance, and the credit promised to schools in total. */
  fetchSmsStatus: () => http.get<PlatformSmsStatus>('/platform/sms/status'),

  /** The school's SMS credit balance and recent movements. */
  fetchSmsCredits: (id: string) => http.get<SchoolSmsCredits>(`/platform/schools/${id}/sms-credits`),

  /** Adds SMS credit worth `amountNgn` at the platform's per-page price, with a note of how it was paid. */
  topUpSmsCredits: (id: string, values: { amountNgn: number; note?: string }) =>
    http.post<SchoolSmsCredits & { unitsAdded: number }>(`/platform/schools/${id}/sms-credits`, values),
};
