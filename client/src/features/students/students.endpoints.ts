import { StudentRecordEndpoints } from './student-record.endpoints';
import { StudentRelationEndpoints } from './student-relations.endpoints';
import { StudentHistoryEndpoints } from './student-history.endpoints';

export type {
  AddStudentDocumentInput,
  LinkGuardianInput,
  PromotionResult,
  StudentAttendanceRange,
  StudentAttendanceResult,
  StudentLedgerResult,
  StudentPickupResult,
} from './students.types';
export { StudentRecordEndpoints } from './student-record.endpoints';
export { StudentRelationEndpoints } from './student-relations.endpoints';
export { StudentHistoryEndpoints } from './student-history.endpoints';

/**
 * A student touches nearly every module, so its calls live in three files: the
 * record itself, what hangs off it, and its history elsewhere. This is the
 * combined surface hooks import.
 */
export const StudentEndpoints = {
  ...StudentRecordEndpoints,
  ...StudentRelationEndpoints,
  ...StudentHistoryEndpoints,
};
