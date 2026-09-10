import { http } from '@/lib/http';
import type { StudentDocument, StudentEnrollment, StudentGuardianLink } from '@/types/people';
import type { AddStudentDocumentInput, LinkGuardianInput } from './students.types';

/** Endpoints for what hangs off a student: enrolments, guardians, documents. */
export const StudentRelationEndpoints = {
  fetchEnrollments: (studentId: string) =>
    http.get<StudentEnrollment[]>(`/students/${studentId}/enrollments`),

  fetchGuardians: (studentId: string) =>
    http.get<StudentGuardianLink[]>(`/students/${studentId}/guardians`),

  linkGuardian: (studentId: string, values: LinkGuardianInput) =>
    http.post<StudentGuardianLink>(`/students/${studentId}/guardians`, values),

  unlinkGuardian: (studentId: string, linkId: string) =>
    http.delete<void>(`/students/${studentId}/guardians/${linkId}`),

  fetchDocuments: (studentId: string) =>
    http.get<StudentDocument[]>(`/students/${studentId}/documents`),

  addDocument: (studentId: string, values: AddStudentDocumentInput) =>
    http.post<StudentDocument>(`/students/${studentId}/documents`, values),

  removeDocument: (studentId: string, documentId: string) =>
    http.delete<void>(`/students/${studentId}/documents/${documentId}`),
};
