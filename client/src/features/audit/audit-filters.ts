import type { FilterOption } from '@/components/data/filter-bar';
import { describeRecordType } from './audit-labels';

/**
 * Every kind of record the server writes audit entries for — the `entityType`
 * on each `audit.record(...)` call.
 *
 * The filter matches that stored name exactly, so an option's value has to be
 * `AdmissionApplication`, never a shortened `Admission`: a value the server
 * never writes returns an empty page and looks like "nothing happened". When a
 * module starts auditing a new kind of record, add its `entityType` here.
 */
const AUDITED_RECORD_TYPES = [
  'AcademicSession',
  'AdmissionApplication',
  'AttendanceRegister',
  'CbtAssessment',
  'Curriculum',
  'CustomBill',
  'Discount',
  'FeeItem',
  'FeeStructure',
  'Guardian',
  'House',
  'ImportJob',
  'Invoice',
  'Payment',
  'PaymentAccount',
  'PaymentDestination',
  'PaymentReceipt',
  'Role',
  'Room',
  'SchemeOfWork',
  'School',
  'SchoolClass',
  'SchoolLevel',
  'ScoreSheet',
  'Staff',
  'Student',
  'StudentDiscount',
  'Subject',
  'Term',
  'Timetable',
  'TimetableEntry',
  'TimetablePeriod',
  'User',
  'WebsiteContent',
] as const;

/** The "Record type" dropdown: stored name as the value, the school's own word as the label. */
export const RECORD_TYPE_OPTIONS: FilterOption[] = AUDITED_RECORD_TYPES.map((value) => ({
  value,
  label: describeRecordType(value),
})).sort((a, b) => a.label.localeCompare(b.label));
