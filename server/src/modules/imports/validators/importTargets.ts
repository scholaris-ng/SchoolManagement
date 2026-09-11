import type { ImportEntityName } from '../entities/importJob.entity';

/**
 * What each import requires, as the server sees it.
 *
 * `client/src/features/imports/columns.ts` holds the browser's copy, which it
 * uses to suggest a mapping. This one is the authority: a caller can send any
 * mapping it likes, and the fields listed here still have to be in it.
 */
export const REQUIRED_TARGETS: Record<ImportEntityName, string[]> = {
  STUDENTS: ['admissionNo', 'firstName', 'lastName', 'gender', 'dateOfBirth', 'className'],
  GUARDIANS: ['firstName', 'lastName', 'email', 'phone'],
  STAFF: ['staffNo', 'firstName', 'lastName', 'email', 'phone', 'gender', 'designation'],
  SUBJECTS: ['name', 'code'],
  FEES: ['name', 'code', 'amount', 'category'],
};

/** Label used in the "this column is not mapped" message. */
export const TARGET_LABELS: Record<string, string> = {
  admissionNo: 'Admission number',
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Surname',
  gender: 'Gender',
  dateOfBirth: 'Date of birth',
  className: 'Class',
  houseName: 'House',
  admissionDate: 'Admission date',
  address: 'Home address',
  guardianName: 'Guardian name',
  guardianPhone: 'Guardian phone',
  guardianEmail: 'Guardian email',
  email: 'Email',
  phone: 'Phone',
  relationship: 'Relationship',
  studentAdmissionNo: 'Child admission number',
  occupation: 'Occupation',
  staffNo: 'Staff number',
  designation: 'Designation',
  department: 'Department',
  roleNames: 'Roles',
  employmentDate: 'Employment date',
  name: 'Name',
  code: 'Code',
  category: 'Category',
  isCore: 'Core subject',
  levelNames: 'Levels',
  amount: 'Amount',
  isOptional: 'Optional',
  description: 'Description',
};
