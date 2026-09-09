import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { AdmissionApplication, AdmissionFunnel, ApplicationStatus } from '@/types/admissions';
import type { Student } from '@/types/people';
import type { AdmissionFormValues, ConversionValues } from './schema';

export interface TransitionInput {
  status: ApplicationStatus;
  note?: string;
  screeningScore?: number;
  offeredClassId?: string;
}

export interface ConversionResult {
  student: Student;
  applicationId: string;
}

/**
 * Endpoint layer for admissions.
 *
 * A transition sends the status as an intent, not a write: the server decides
 * whether this actor may make that particular transition (offering a place
 * needs `admission.decide`, not merely `admission.manage`) and records it.
 */
export const AdmissionEndpoints = {
  fetchAll: (query: ListQuery) =>
    http.get<Paginated<AdmissionApplication>>('/admissions', { query }),

  fetchById: (id: string) => http.get<AdmissionApplication>(`/admissions/${id}`),

  fetchFunnel: (sessionId?: string) =>
    http.get<AdmissionFunnel>('/admissions/funnel', { query: { sessionId } }),

  create: (values: AdmissionFormValues) =>
    http.post<AdmissionApplication>('/admissions', values),

  transition: (id: string, input: TransitionInput) =>
    http.post<AdmissionApplication>(`/admissions/${id}/transition`, input),

  /**
   * Turns an accepted applicant into an enrolled student in one transaction —
   * personal details, guardians and uploaded documents all carry across, so
   * nothing the family typed is keyed in a second time (spec section 10).
   */
  convert: (id: string, values: ConversionValues) =>
    http.post<ConversionResult>(`/admissions/${id}/convert`, values),
};
