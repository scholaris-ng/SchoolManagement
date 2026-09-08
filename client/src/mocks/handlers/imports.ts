import { http, delay } from 'msw';
import { db, resolveContext, scoped } from '../context';
import { errors, latency, ok, paginate, readListParams } from '../http-helpers';
import type { ImportEntity, ImportJob, ImportMapping, ImportPreview, ImportResult, ImportRowIssue } from '@/types/imports';
import type { Student, Guardian, StaffMember, GuardianRelationship } from '@/types/people';
import type { Subject } from '@/types/academics';
import type { FeeItem } from '@/types/finance';

const base = '/api/v1';

let sequence = 60_000;
const nextId = (prefix: string) => `${prefix}_${(sequence += 1).toString(36)}`;

function issue(
  rowNumber: number,
  severity: ImportRowIssue['severity'],
  code: string,
  message: string,
  field?: string,
  value?: string,
): ImportRowIssue {
  return { rowNumber, field, severity, code, message, value };
}

function valueFor(row: Record<string, string>, mapping: ImportMapping, key: string): string {
  const header = mapping[key];
  return (header ? row[header] : undefined)?.trim() ?? '';
}

const RELATIONSHIPS: GuardianRelationship[] = ['FATHER', 'MOTHER', 'GUARDIAN', 'SPONSOR', 'OTHER'];
const FEE_CATEGORIES: FeeItem['category'][] = [
  'TUITION',
  'TRANSPORT',
  'BOARDING',
  'UNIFORM',
  'EXAM',
  'DEVELOPMENT',
  'OTHER',
];
const isTruthy = (value: string) => /^(true|yes|1)$/i.test(value);

interface PendingRow {
  rowNumber: number;
  issues: ImportRowIssue[];
  /** Present only when the row has no error — performs the actual write. */
  apply: (() => void) | null;
}

interface PendingImport {
  schoolId: string;
  entity: ImportEntity;
  fileName: string;
  rows: PendingRow[];
}

/**
 * Files that have been validated but not yet committed, keyed by `importId`.
 * `validate` writes nothing to `db`, so the rows it already resolved (which
 * class a name matched, whether a duplicate exists…) are held here until
 * `commit` asks to apply them, rather than being recomputed from scratch.
 */
const pendingImports = new Map<string, PendingImport>();

/**
 * What each import expects, kept as its own copy rather than importing the
 * client's `IMPORT_TARGETS` — the same separation `columns.ts` describes: the
 * browser's mapping is a convenience, never the authority on what gets written.
 */
function processStudentRow(
  schoolId: string,
  mapping: ImportMapping,
  row: Record<string, string>,
  rowNumber: number,
): PendingRow {
  const issues: ImportRowIssue[] = [];
  const admissionNo = valueFor(row, mapping, 'admissionNo');
  const firstName = valueFor(row, mapping, 'firstName');
  const middleName = valueFor(row, mapping, 'middleName');
  const lastName = valueFor(row, mapping, 'lastName');
  const genderRaw = valueFor(row, mapping, 'gender').toUpperCase();
  const dateOfBirth = valueFor(row, mapping, 'dateOfBirth');
  const className = valueFor(row, mapping, 'className');
  const houseName = valueFor(row, mapping, 'houseName');

  if (!admissionNo) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Admission number is required.', 'admissionNo'));
  if (!firstName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'First name is required.', 'firstName'));
  if (!lastName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Surname is required.', 'lastName'));
  if (!dateOfBirth) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Date of birth is required.', 'dateOfBirth'));
  else if (Number.isNaN(Date.parse(dateOfBirth)))
    issues.push(issue(rowNumber, 'ERROR', 'INVALID', 'Date of birth is not a valid date.', 'dateOfBirth', dateOfBirth));

  let gender: Student['gender'] | null = null;
  if (!genderRaw) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Gender is required.', 'gender'));
  else if (genderRaw !== 'MALE' && genderRaw !== 'FEMALE')
    issues.push(issue(rowNumber, 'ERROR', 'INVALID', 'Gender must be Male or Female.', 'gender', genderRaw));
  else gender = genderRaw;

  let schoolClass = null;
  if (!className) {
    issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Class is required.', 'className'));
  } else {
    schoolClass =
      scoped(db.classes, schoolId).find((entry) => entry.name.toLowerCase() === className.toLowerCase()) ?? null;
    if (!schoolClass)
      issues.push(issue(rowNumber, 'ERROR', 'NOT_FOUND', `No class named "${className}" was found.`, 'className', className));
  }

  if (
    admissionNo &&
    scoped(db.students, schoolId).some((entry) => entry.admissionNo.toLowerCase() === admissionNo.toLowerCase())
  ) {
    issues.push(
      issue(rowNumber, 'ERROR', 'DUPLICATE', 'A student with this admission number already exists.', 'admissionNo', admissionNo),
    );
  }

  const house = houseName
    ? (scoped(db.houses, schoolId).find((entry) => entry.name.toLowerCase() === houseName.toLowerCase()) ?? null)
    : null;
  if (houseName && !house)
    issues.push(issue(rowNumber, 'WARNING', 'NOT_FOUND', `No house named "${houseName}" was found; left blank.`, 'houseName', houseName));

  const hasError = issues.some((entry) => entry.severity === 'ERROR');
  const apply =
    hasError || !schoolClass || !gender
      ? null
      : () => {
          const now = new Date().toISOString();
          const student: Student = {
            id: nextId('std'),
            schoolId,
            admissionNo,
            firstName,
            middleName: middleName || null,
            lastName,
            fullName: [firstName, middleName, lastName].filter(Boolean).join(' '),
            gender,
            dateOfBirth,
            photoUrl: null,
            photoConsent: false,
            admissionDate: valueFor(row, mapping, 'admissionDate') || now.slice(0, 10),
            status: 'ACTIVE',
            currentClassId: schoolClass.id,
            currentClassName: schoolClass.name,
            currentLevelName: schoolClass.levelName,
            houseId: house?.id ?? null,
            houseName: house?.name ?? null,
            bloodGroup: null,
            medicalNotes: null,
            emergencyContactName: null,
            emergencyContactPhone: null,
            address: valueFor(row, mapping, 'address') || null,
            nationality: null,
            stateOfOrigin: null,
            religion: null,
            guardianCount: 0,
            createdAt: now,
            updatedAt: now,
            version: 1,
          };
          db.students.unshift(student);
          schoolClass.enrolledCount += 1;
        };

  return { rowNumber, issues, apply };
}

function processGuardianRow(
  schoolId: string,
  mapping: ImportMapping,
  row: Record<string, string>,
  rowNumber: number,
): PendingRow {
  const issues: ImportRowIssue[] = [];
  const firstName = valueFor(row, mapping, 'firstName');
  const lastName = valueFor(row, mapping, 'lastName');
  const email = valueFor(row, mapping, 'email');
  const phone = valueFor(row, mapping, 'phone');
  const studentAdmissionNo = valueFor(row, mapping, 'studentAdmissionNo');

  if (!firstName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'First name is required.', 'firstName'));
  if (!lastName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Surname is required.', 'lastName'));
  if (!email) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Email is required.', 'email'));
  if (!phone) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Phone is required.', 'phone'));

  if (email && scoped(db.guardians, schoolId).some((entry) => entry.email.toLowerCase() === email.toLowerCase())) {
    issues.push(issue(rowNumber, 'ERROR', 'DUPLICATE', 'A guardian with this email already exists.', 'email', email));
  }

  let student: Student | null = null;
  if (studentAdmissionNo) {
    student =
      scoped(db.students, schoolId).find(
        (entry) => entry.admissionNo.toLowerCase() === studentAdmissionNo.toLowerCase(),
      ) ?? null;
    if (!student)
      issues.push(
        issue(
          rowNumber,
          'WARNING',
          'NOT_FOUND',
          `No student with admission number "${studentAdmissionNo}" was found; guardian will be added unlinked.`,
          'studentAdmissionNo',
          studentAdmissionNo,
        ),
      );
  }

  const hasError = issues.some((entry) => entry.severity === 'ERROR');
  const apply = hasError
    ? null
    : () => {
        const now = new Date().toISOString();
        const relationshipRaw = valueFor(row, mapping, 'relationship').toUpperCase();
        const relationship = (RELATIONSHIPS as string[]).includes(relationshipRaw)
          ? (relationshipRaw as GuardianRelationship)
          : 'GUARDIAN';

        const guardian: Guardian = {
          id: nextId('gdn'),
          schoolId,
          userId: null,
          title: null,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          email,
          phone,
          altPhone: null,
          occupation: valueFor(row, mapping, 'occupation') || null,
          address: valueFor(row, mapping, 'address') || null,
          photoUrl: null,
          hasPortalAccess: false,
          lastLoginAt: null,
          studentCount: student ? 1 : 0,
          createdAt: now,
          version: 1,
        };
        db.guardians.unshift(guardian);

        if (student) {
          db.studentGuardians.push({
            id: nextId('sgl'),
            studentId: student.id,
            studentName: student.fullName,
            studentAdmissionNo: student.admissionNo,
            studentPhotoUrl: student.photoUrl ?? null,
            guardianId: guardian.id,
            guardianName: guardian.fullName,
            guardianPhone: guardian.phone,
            guardianEmail: guardian.email,
            relationship,
            isPrimaryContact: true,
            isEmergencyContact: true,
            isFinanciallyResponsible: true,
            canPickUp: true,
          });
          student.guardianCount += 1;
        }
      };

  return { rowNumber, issues, apply };
}

function processStaffRow(
  schoolId: string,
  mapping: ImportMapping,
  row: Record<string, string>,
  rowNumber: number,
): PendingRow {
  const issues: ImportRowIssue[] = [];
  const staffNo = valueFor(row, mapping, 'staffNo');
  const firstName = valueFor(row, mapping, 'firstName');
  const lastName = valueFor(row, mapping, 'lastName');
  const email = valueFor(row, mapping, 'email');
  const phone = valueFor(row, mapping, 'phone');
  const genderRaw = valueFor(row, mapping, 'gender').toUpperCase();
  const designation = valueFor(row, mapping, 'designation');

  if (!staffNo) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Staff number is required.', 'staffNo'));
  if (!firstName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'First name is required.', 'firstName'));
  if (!lastName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Surname is required.', 'lastName'));
  if (!email) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Work email is required.', 'email'));
  if (!phone) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Phone is required.', 'phone'));
  if (!designation) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Designation is required.', 'designation'));

  let gender: StaffMember['gender'] | null = null;
  if (!genderRaw) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Gender is required.', 'gender'));
  else if (genderRaw !== 'MALE' && genderRaw !== 'FEMALE')
    issues.push(issue(rowNumber, 'ERROR', 'INVALID', 'Gender must be Male or Female.', 'gender', genderRaw));
  else gender = genderRaw;

  if (staffNo && scoped(db.staff, schoolId).some((entry) => entry.staffNo.toLowerCase() === staffNo.toLowerCase())) {
    issues.push(issue(rowNumber, 'ERROR', 'DUPLICATE', 'A staff member with this staff number already exists.', 'staffNo', staffNo));
  }
  if (email && scoped(db.staff, schoolId).some((entry) => entry.email.toLowerCase() === email.toLowerCase())) {
    issues.push(issue(rowNumber, 'ERROR', 'DUPLICATE', 'A staff member with this email already exists.', 'email', email));
  }

  const hasError = issues.some((entry) => entry.severity === 'ERROR');
  const apply =
    hasError || !gender
      ? null
      : () => {
          const now = new Date().toISOString();
          const roleNames = valueFor(row, mapping, 'roleNames')
            .split(';')
            .map((entry) => entry.trim())
            .filter(Boolean);

          const member: StaffMember = {
            id: nextId('stf'),
            schoolId,
            userId: null,
            staffNo,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            email,
            phone,
            gender,
            photoUrl: null,
            designation,
            department: valueFor(row, mapping, 'department') || null,
            employmentType: 'FULL_TIME',
            employmentDate: valueFor(row, mapping, 'employmentDate') || now.slice(0, 10),
            status: 'ACTIVE',
            roleNames,
            subjectIds: [],
            subjectNames: [],
            classIds: [],
            classNames: [],
            isFormTeacher: false,
            createdAt: now,
            version: 1,
          };
          db.staff.unshift(member);
        };

  return { rowNumber, issues, apply };
}

function processSubjectRow(
  schoolId: string,
  mapping: ImportMapping,
  row: Record<string, string>,
  rowNumber: number,
): PendingRow {
  const issues: ImportRowIssue[] = [];
  const name = valueFor(row, mapping, 'name');
  const code = valueFor(row, mapping, 'code');

  if (!name) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Subject name is required.', 'name'));
  if (!code) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Subject code is required.', 'code'));
  if (code && scoped(db.subjects, schoolId).some((entry) => entry.code.toLowerCase() === code.toLowerCase())) {
    issues.push(issue(rowNumber, 'ERROR', 'DUPLICATE', 'A subject with this code already exists.', 'code', code));
  }

  const levelNames = valueFor(row, mapping, 'levelNames')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const levels = levelNames
    .map((levelName) => scoped(db.levels, schoolId).find((entry) => entry.name.toLowerCase() === levelName.toLowerCase()))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const unresolved = levelNames.length - levels.length;
  if (unresolved > 0) {
    issues.push(
      issue(
        rowNumber,
        'WARNING',
        'NOT_FOUND',
        `${unresolved} level${unresolved === 1 ? '' : 's'} could not be matched and will be skipped.`,
        'levelNames',
        levelNames.join(';'),
      ),
    );
  }

  const hasError = issues.some((entry) => entry.severity === 'ERROR');
  const apply = hasError
    ? null
    : () => {
        const subject: Subject = {
          id: nextId('sub'),
          schoolId,
          name,
          code,
          category: valueFor(row, mapping, 'category') || null,
          isCore: isTruthy(valueFor(row, mapping, 'isCore')),
          levelIds: levels.map((entry) => entry.id),
          levelNames: levels.map((entry) => entry.name),
          teacherCount: 0,
          isActive: true,
          schedule: [],
        };
        db.subjects.unshift(subject);
      };

  return { rowNumber, issues, apply };
}

function processFeeRow(
  schoolId: string,
  mapping: ImportMapping,
  row: Record<string, string>,
  rowNumber: number,
): PendingRow {
  const issues: ImportRowIssue[] = [];
  const name = valueFor(row, mapping, 'name');
  const code = valueFor(row, mapping, 'code');
  const amountRaw = valueFor(row, mapping, 'amount');
  const categoryRaw = valueFor(row, mapping, 'category').toUpperCase();

  if (!name) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Fee item name is required.', 'name'));
  if (!code) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Code is required.', 'code'));
  if (code && scoped(db.feeItems, schoolId).some((entry) => entry.code.toLowerCase() === code.toLowerCase())) {
    issues.push(issue(rowNumber, 'ERROR', 'DUPLICATE', 'A fee item with this code already exists.', 'code', code));
  }

  const amount = Number(amountRaw.replace(/,/g, ''));
  if (!amountRaw) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Amount is required.', 'amount'));
  else if (!Number.isFinite(amount) || amount <= 0)
    issues.push(issue(rowNumber, 'ERROR', 'INVALID', 'Amount must be a positive number.', 'amount', amountRaw));

  if (!categoryRaw) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'Category is required.', 'category'));
  else if (!(FEE_CATEGORIES as string[]).includes(categoryRaw))
    issues.push(
      issue(rowNumber, 'ERROR', 'INVALID', `Category must be one of ${FEE_CATEGORIES.join(', ')}.`, 'category', categoryRaw),
    );

  const hasError = issues.some((entry) => entry.severity === 'ERROR');
  const apply = hasError
    ? null
    : () => {
        const feeItem: FeeItem = {
          id: nextId('fee'),
          schoolId,
          name,
          code,
          description: valueFor(row, mapping, 'description') || null,
          amount,
          category: categoryRaw as FeeItem['category'],
          isOptional: isTruthy(valueFor(row, mapping, 'isOptional')),
          isRecurring: true,
          isActive: true,
        };
        db.feeItems.unshift(feeItem);
      };

  return { rowNumber, issues, apply };
}

function processRows(
  entity: ImportEntity,
  schoolId: string,
  mapping: ImportMapping,
  rows: Record<string, string>[],
): PendingRow[] {
  const processRow =
    entity === 'STUDENTS'
      ? processStudentRow
      : entity === 'GUARDIANS'
        ? processGuardianRow
        : entity === 'STAFF'
          ? processStaffRow
          : entity === 'SUBJECTS'
            ? processSubjectRow
            : processFeeRow;

  return rows.map((row, index) => processRow(schoolId, mapping, row, index + 1));
}

export const importsHandlers = [
  http.get(`${base}/imports`, async ({ request }) => {
    await delay(latency());
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('import.run')) return errors.forbidden();

    const url = new URL(request.url);
    const { page, pageSize } = readListParams(url);
    const rows = scoped(db.importJobs, context.schoolId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

    return ok(paginate(rows, page, pageSize));
  }),

  http.post(`${base}/imports/validate`, async ({ request }) => {
    await delay(latency() * 2);
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('import.run')) return errors.forbidden();

    const body = (await request.json()) as {
      entity: ImportEntity;
      fileName: string;
      mapping: ImportMapping;
      rows: Record<string, string>[];
    };

    const rows = processRows(body.entity, context.schoolId, body.mapping, body.rows);
    const issues = rows.flatMap((row) => row.issues);
    const errorRowCount = rows.filter((row) => row.issues.some((entry) => entry.severity === 'ERROR')).length;
    const warningRowCount = rows.filter((row) => row.issues.some((entry) => entry.severity === 'WARNING')).length;
    const duplicateRowCount = rows.filter((row) => row.issues.some((entry) => entry.code === 'DUPLICATE')).length;

    const importId = nextId('imv');
    pendingImports.set(importId, {
      schoolId: context.schoolId,
      entity: body.entity,
      fileName: body.fileName,
      rows,
    });

    const preview: ImportPreview = {
      importId,
      entity: body.entity,
      totalRows: rows.length,
      validRows: rows.length - errorRowCount,
      errorRows: errorRowCount,
      warningRows: warningRowCount,
      duplicateRows: duplicateRowCount,
      issues,
      preview: body.rows.slice(0, 10).map((row) => {
        const mapped: Record<string, string> = {};
        for (const key of Object.keys(body.mapping)) mapped[key] = valueFor(row, body.mapping, key);
        return mapped;
      }),
    };

    return ok(preview);
  }),

  http.post(`${base}/imports/commit`, async ({ request }) => {
    await delay(latency() * 3);
    const context = resolveContext(request);
    if (!context) return errors.unauthenticated();
    if (!context.can('import.run')) return errors.forbidden();

    const body = (await request.json()) as { importId: string; skipInvalidRows: boolean };
    const pending = pendingImports.get(body.importId);
    if (!pending || pending.schoolId !== context.schoolId) return errors.notFound('Import');

    const errorRows = pending.rows.filter((row) => row.issues.some((entry) => entry.severity === 'ERROR'));
    if (errorRows.length > 0 && !body.skipInvalidRows) {
      pendingImports.delete(body.importId);
      return errors.validation('Some rows have errors. Skip the bad rows or fix the file and try again.');
    }

    let createdCount = 0;
    for (const row of pending.rows) {
      if (!row.apply) continue;
      row.apply();
      createdCount += 1;
    }
    const skippedCount = pending.rows.length - createdCount;
    pendingImports.delete(body.importId);

    const now = new Date().toISOString();
    const result: ImportResult = {
      importId: body.importId,
      entity: pending.entity,
      status: createdCount === 0 ? 'FAILED' : skippedCount > 0 ? 'PARTIAL' : 'COMPLETED',
      created: createdCount,
      updated: 0,
      skipped: skippedCount,
      failed: 0,
      issues: pending.rows.flatMap((row) => row.issues),
      errorReportUrl: null,
      completedAt: now,
    };

    const job: ImportJob = {
      id: nextId('imp'),
      schoolId: context.schoolId,
      entity: pending.entity,
      fileName: pending.fileName,
      status: result.status,
      totalRows: pending.rows.length,
      created: createdCount,
      failed: 0,
      startedByName: context.user.displayName,
      startedAt: now,
      completedAt: now,
    };
    db.importJobs.unshift(job);

    return ok(result);
  }),
];
