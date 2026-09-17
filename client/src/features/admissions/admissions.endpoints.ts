import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  AdmissionApplication,
  AdmissionApplicationGuardianLink,
  AdmissionFunnel,
  ApplicationStatus,
  InterviewOutcome,
} from '@/types/admissions';
import type { Student } from '@/types/people';
import type { AdmissionFormValues, ConversionValues } from './schema';

export interface TransitionInput {
  status: ApplicationStatus;
  note?: string;
  screeningScore?: number;
  offeredClassId?: string;
  offerExpiresOn?: string;
}

export interface LinkApplicationGuardianInput {
  guardianId: string;
  relationship: string;
  isPrimaryContact: boolean;
}

/** Any field left out is left alone; send `null` to clear one that was set. */
export interface ScheduleInterviewInput {
  interviewDate?: string | null;
  interviewVenue?: string | null;
  interviewOutcome?: InterviewOutcome | null;
  interviewNote?: string | null;
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

  scheduleInterview: (id: string, input: ScheduleInterviewInput) =>
    http.patch<AdmissionApplication>(`/admissions/${id}/interview`, input),

  /**
   * Turns an accepted applicant into an enrolled student in one transaction —
   * personal details, guardians and uploaded documents all carry across, so
   * nothing the family typed is keyed in a second time (spec section 10).
   */
  convert: (id: string, values: ConversionValues) =>
    http.post<ConversionResult>(`/admissions/${id}/convert`, values),

  /**
   * Attaches an existing guardian record to the application, before
   * enrollment — for a family the office already knows. Grants nothing by
   * itself; portal access, billing and pickup rights still wait for
   * `convert`.
   */
  linkGuardian: (id: string, values: LinkApplicationGuardianInput) =>
    http.post<AdmissionApplicationGuardianLink>(`/admissions/${id}/guardians`, values),

  unlinkGuardian: (id: string, linkId: string) =>
    http.delete<void>(`/admissions/${id}/guardians/${linkId}`),
};
