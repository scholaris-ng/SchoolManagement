import type { ImportColumnDefinition, ImportEntity } from '@/types/imports';
import type { ColumnDropdown } from '@/lib/xlsx';
import { ROLES } from '@/types/rbac';

export interface ImportTarget extends ImportColumnDefinition {
  /** Extra header spellings matched during automatic column mapping. */
  aliases?: string[];
  /** Offers this column as an in-cell dropdown on the downloaded template. */
  dropdown?: { options: string[]; mode?: ColumnDropdown['mode'] };
}

const GENDERS = ['MALE', 'FEMALE'];

/** Roles a school can hand out on import; platform operators are provisioned elsewhere. */
const ASSIGNABLE_ROLES = ROLES.filter(
  (role) => role !== 'SUPER_ADMIN' && role !== 'PARENT' && role !== 'STUDENT',
);

/**
 * What each import expects.
 *
 * The definitions live on the client as well as the server: the client uses
 * them to suggest a mapping and to render the preview, and the server uses its
 * own copy to validate — the browser's mapping is a convenience, never the
 * authority on what gets written.
 */
export const IMPORT_TARGETS: Record<ImportEntity, ImportTarget[]> = {
  STUDENTS: [
    {
      key: 'admissionNo',
      label: 'Admission number',
      required: true,
      example: 'SCH/2026/0142',
      aliases: ['admission no', 'adm no', 'reg no', 'registration number'],
    },
    { key: 'firstName', label: 'First name', required: true, example: 'Chidinma', aliases: ['given name'] },
    { key: 'middleName', label: 'Middle name', required: false, example: 'Amara' },
    { key: 'lastName', label: 'Surname', required: true, example: 'Okafor', aliases: ['last name', 'family name'] },
    { key: 'gender', label: 'Gender', required: true, example: 'FEMALE', aliases: ['sex'] },
    {
      key: 'dateOfBirth',
      label: 'Date of birth',
      required: true,
      example: '2014-05-12',
      aliases: ['dob', 'birth date'],
    },
    { key: 'className', label: 'Class', required: true, example: 'JSS 1 Gold', aliases: ['class name', 'current class'] },
    { key: 'houseName', label: 'House', required: false, example: 'Blue' },
    {
      key: 'admissionDate',
      label: 'Admission date',
      required: false,
      example: '2024-09-09',
      aliases: ['date admitted', 'enrolment date'],
    },
    { key: 'address', label: 'Home address', required: false },
    { key: 'guardianName', label: 'Guardian name', required: false, aliases: ['parent name'] },
    { key: 'guardianPhone', label: 'Guardian phone', required: false, aliases: ['parent phone'] },
    { key: 'guardianEmail', label: 'Guardian email', required: false, aliases: ['parent email'] },
  ],

  GUARDIANS: [
    { key: 'firstName', label: 'First name', required: true, example: 'Ngozi' },
    { key: 'lastName', label: 'Surname', required: true, example: 'Eze' },
    { key: 'email', label: 'Email', required: true, example: 'ngozi@example.com' },
    { key: 'phone', label: 'Phone', required: true, example: '+234 802 000 0000' },
    { key: 'relationship', label: 'Relationship', required: false, example: 'MOTHER' },
    {
      key: 'studentAdmissionNo',
      label: 'Child admission number',
      required: false,
      description: 'Links this guardian to an existing student.',
      aliases: ['student admission no', 'child adm no'],
    },
    { key: 'occupation', label: 'Occupation', required: false },
    { key: 'address', label: 'Address', required: false },
  ],

  STAFF: [
    { key: 'staffNo', label: 'Staff number', required: true, example: 'STF/018' },
    { key: 'firstName', label: 'First name', required: true },
    { key: 'lastName', label: 'Surname', required: true },
    { key: 'email', label: 'Work email', required: true },
    { key: 'phone', label: 'Phone', required: true },
    { key: 'gender', label: 'Gender', required: true, example: 'MALE', dropdown: { options: GENDERS } },
    { key: 'designation', label: 'Designation', required: true, example: 'Mathematics teacher' },
    { key: 'department', label: 'Department', required: false },
    {
      key: 'roleNames',
      label: 'Roles',
      required: false,
      description: 'Separate several with a semicolon.',
      example: 'TEACHER;FORM_TEACHER',
      dropdown: { options: [...ASSIGNABLE_ROLES], mode: 'suggest' },
    },
    { key: 'employmentDate', label: 'Employment date', required: false, example: '2023-01-09' },
  ],

  SUBJECTS: [
    { key: 'name', label: 'Subject name', required: true, example: 'Basic Science' },
    { key: 'code', label: 'Subject code', required: true, example: 'BSC' },
    { key: 'category', label: 'Category', required: false, example: 'Sciences' },
    { key: 'isCore', label: 'Core subject', required: false, example: 'TRUE' },
    {
      key: 'levelNames',
      label: 'Levels',
      required: false,
      description: 'Separate several with a semicolon.',
      example: 'JSS 1;JSS 2',
    },
  ],

  FEES: [
    { key: 'name', label: 'Fee item', required: true, example: 'Tuition' },
    { key: 'code', label: 'Code', required: true, example: 'TUI' },
    { key: 'amount', label: 'Amount', required: true, example: '85000' },
    { key: 'category', label: 'Category', required: true, example: 'TUITION' },
    { key: 'isOptional', label: 'Optional', required: false, example: 'FALSE' },
    { key: 'description', label: 'Description', required: false },
  ],
};

export const IMPORT_ENTITY_LABEL: Record<ImportEntity, string> = {
  STUDENTS: 'Students',
  GUARDIANS: 'Guardians',
  STAFF: 'Staff',
  SUBJECTS: 'Subjects',
  FEES: 'Fee items',
};

export const IMPORT_ENTITY_DESCRIPTION: Record<ImportEntity, string> = {
  STUDENTS: 'Your existing register — one row per child, with their class.',
  GUARDIANS: 'Parents and guardians, optionally linked to children by admission number.',
  STAFF: 'Teaching and non-teaching staff, with the roles they should hold.',
  SUBJECTS: 'The subjects your school teaches, and the levels they apply to.',
  FEES: 'Fee items that fee structures and invoices are built from.',
};

/**
 * Builds a starter workbook so a school never has to guess the column names:
 * the labelled header row plus one filled-in example to copy down.
 */
export function templateSheetFor(entity: ImportEntity): {
  headers: string[];
  rows: Record<string, string>[];
  dropdowns: ColumnDropdown[];
} {
  const targets = IMPORT_TARGETS[entity];
  const headers = targets.map((target) => target.label);
  const example: Record<string, string> = {};
  for (const target of targets) example[target.label] = target.example ?? '';
  const dropdowns: ColumnDropdown[] = targets
    .filter((target): target is ImportTarget & { dropdown: NonNullable<ImportTarget['dropdown']> } =>
      Boolean(target.dropdown),
    )
    .map((target) => ({
      header: target.label,
      options: target.dropdown.options,
      mode: target.dropdown.mode,
    }));
  return { headers, rows: [example], dropdowns };
}
