import { http } from '@/lib/http';
import type { PlatformSchool } from '@/types/platform';

export const PlatformEndpoints = {
  /** Every school, soonest to lapse first. */
  fetchSchools: () => http.get<PlatformSchool[]>('/platform/schools'),

  /** Adds `months` months to the school's access, and returns the school as it now stands. */
  activateSchool: (id: string, months: number) =>
    http.post<PlatformSchool>(`/platform/schools/${id}/activate`, { months }),
};
