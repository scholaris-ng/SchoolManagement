/**
 * Public surface of the student module.
 *
 * The hooks live in sibling files split by sub-feature — the record itself, its
 * relations, and its history across other modules — so no one file outgrows the
 * limit in section 17 of the frontend guide. This barrel keeps one import path.
 */
export type {
  AddStudentDocumentInput,
  LinkGuardianInput,
  PromotionResult,
  StudentAttendanceRange,
  StudentAttendanceResult,
  StudentLedgerResult,
  StudentPickupResult,
} from './students.endpoints';
export { StudentEndpoints } from './students.endpoints';
export * from './use-students';
export * from './use-student-relations';
export * from './use-student-history';
