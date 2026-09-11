import type { EntityManager } from 'typeorm';
import { StudentRepository } from '../../students/repositories/student.repository';
import { GuardianRepository } from '../../guardians/repositories/guardian.repository';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { HouseRepository } from '../../academics/repositories/facility.repository';
import { Student } from '../../students/entities/student.entity';
import { StudentEnrollment } from '../../students/entities/studentEnrollment.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import type { ImportEntityHandler, MappedRow, RowCheck, RowContext } from './importHandler.interface';
import { issue } from './importHandler.interface';
import { isIsoDate, normaliseSpacing, splitPersonName, todayIso } from '../utils/cells';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_STUDENT_AGE_YEARS = 30;

interface ResolvedClass {
  id: string;
  levelId: string;
  displayName: string;
}

/**
 * Students: admission number is the key.
 *
 * The write path deliberately mirrors `StudentsService.createStudent` rather
 * than calling it — that method opens its own transaction, which would commit
 * independently of the import's and defeat the all-or-nothing guarantee.
 */
export class StudentsImportHandler implements ImportEntityHandler {
  readonly entity = 'STUDENTS' as const;
  readonly naturalKeyField = 'admissionNo';
  readonly naturalKeyLabel = 'admission number';

  private readonly students = StudentRepository.Instance;
  private readonly guardians = GuardianRepository.Instance;
  private readonly classes = ClassRepository.Instance;
  private readonly houses = HouseRepository.Instance;

  naturalKey(row: MappedRow): string | null {
    return row.admissionNo?.trim() || null;
  }

  async check({ context, rowNumber, row, manager }: RowContext): Promise<RowCheck> {
    const issues = [];
    const admissionNo = (row.admissionNo ?? '').trim();
    const firstName = normaliseSpacing(row.firstName ?? '');
    const lastName = normaliseSpacing(row.lastName ?? '');
    const gender = (row.gender ?? '').trim().toUpperCase();
    const className = normaliseSpacing(row.className ?? '');

    if (!admissionNo) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'An admission number is required.', 'admissionNo'));
    if (!firstName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A first name is required.', 'firstName'));
    if (!lastName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A surname is required.', 'lastName'));
    if (gender !== 'MALE' && gender !== 'FEMALE') {
      issues.push(issue(rowNumber, 'ERROR', 'INVALID_GENDER', 'Gender must be MALE or FEMALE.', 'gender', row.gender));
    }

    issues.push(...this.checkDate(rowNumber, row.dateOfBirth, 'dateOfBirth', true));
    if ((row.admissionDate ?? '').trim()) {
      issues.push(...this.checkDate(rowNumber, row.admissionDate, 'admissionDate', false));
    }

    let resolvedClass: ResolvedClass | null = null;
    if (!className) {
      issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A class is required.', 'className'));
    } else {
      const matches = await this.classes.findByDisplayName(context.schoolId, className, manager);
      if (matches.length === 0) {
        issues.push(
          issue(rowNumber, 'ERROR', 'CLASS_NOT_FOUND', `There is no class called "${className}".`, 'className', className),
        );
      } else if (matches.length > 1) {
        issues.push(
          issue(
            rowNumber,
            'ERROR',
            'CLASS_AMBIGUOUS',
            `"${className}" matches ${matches.length} classes. Rename one, or use its full name including the arm.`,
            'className',
            className,
          ),
        );
      } else {
        resolvedClass = matches[0];
      }
    }

    const houseName = normaliseSpacing(row.houseName ?? '');
    if (houseName) {
      const house = await this.houses.findByNameInsensitive(context.schoolId, houseName, manager);
      if (!house) {
        issues.push(
          issue(rowNumber, 'WARNING', 'HOUSE_NOT_FOUND', `No house called "${houseName}" — left unset.`, 'houseName', houseName),
        );
      }
    }

    // A guardian record cannot exist without an email: it is both required and
    // the key we match on. The child still imports; only the adult is left off.
    const guardianName = normaliseSpacing(row.guardianName ?? '');
    const guardianEmail = (row.guardianEmail ?? '').trim().toLowerCase();
    if ((guardianName || (row.guardianPhone ?? '').trim()) && !guardianEmail) {
      issues.push(
        issue(
          rowNumber,
          'WARNING',
          'GUARDIAN_EMAIL_MISSING',
          'A guardian needs an email address, so no guardian was created for this student.',
          'guardianEmail',
        ),
      );
    } else if (guardianEmail && !EMAIL.test(guardianEmail)) {
      issues.push(
        issue(rowNumber, 'WARNING', 'INVALID_GUARDIAN_EMAIL', 'That guardian email is not valid, so none was created.', 'guardianEmail', guardianEmail),
      );
    } else if (guardianEmail && !guardianName) {
      issues.push(
        issue(rowNumber, 'WARNING', 'GUARDIAN_NAME_MISSING', 'A guardian email was given without a name, so none was created.', 'guardianName'),
      );
    }

    let willUpdate = false;
    if (admissionNo) {
      const existing = await this.students.findByAdmissionNo(context.schoolId, admissionNo, manager);
      if (existing?.deletedAt) {
        issues.push(
          issue(
            rowNumber,
            'ERROR',
            'ADMISSION_NO_ARCHIVED',
            `Admission number "${admissionNo}" belongs to a withdrawn student. Restore them instead of importing over them.`,
            'admissionNo',
            admissionNo,
          ),
        );
      } else if (existing) {
        willUpdate = true;
      }
    }

    return {
      issues,
      willUpdate,
      preview: {
        admissionNo,
        firstName,
        lastName,
        gender,
        dateOfBirth: (row.dateOfBirth ?? '').trim(),
        className: resolvedClass?.displayName ?? className,
        houseName,
      },
    };
  }

  async apply({ context, row, manager }: RowContext): Promise<'CREATED' | 'UPDATED'> {
    if (!manager) throw new Error('Student import must run inside a transaction.');

    const admissionNo = row.admissionNo.trim();
    const className = normaliseSpacing(row.className);
    const [schoolClass] = await this.classes.findByDisplayName(context.schoolId, className, manager);
    if (!schoolClass) throw new Error(`Class "${className}" could not be resolved.`);

    const houseName = normaliseSpacing(row.houseName ?? '');
    const house = houseName
      ? await this.houses.findByNameInsensitive(context.schoolId, houseName, manager)
      : null;

    const fields = {
      firstName: normaliseSpacing(row.firstName),
      middleName: normaliseSpacing(row.middleName ?? '') || null,
      lastName: normaliseSpacing(row.lastName),
      gender: row.gender.trim().toUpperCase() as 'MALE' | 'FEMALE',
      dateOfBirth: row.dateOfBirth.trim(),
      address: normaliseSpacing(row.address ?? '') || null,
      houseId: house?.id ?? null,
    };

    const existing = await this.students.findByAdmissionNo(context.schoolId, admissionNo, manager);

    let studentId: string;
    let outcome: 'CREATED' | 'UPDATED';

    if (existing) {
      const movedClass = existing.currentClassId !== schoolClass.id;
      await this.students.update(existing.id, { ...fields, currentClassId: schoolClass.id }, manager);
      if (movedClass) {
        if (existing.currentClassId) {
          await manager.decrement(SchoolClass, { id: existing.currentClassId }, 'enrolledCount', 1);
        }
        await manager.increment(SchoolClass, { id: schoolClass.id }, 'enrolledCount', 1);
      }
      studentId = existing.id;
      outcome = 'UPDATED';
    } else {
      const admissionDate = (row.admissionDate ?? '').trim() || todayIso();
      const student = await manager.save(
        manager.create(Student, {
          schoolId: context.schoolId,
          admissionNo,
          ...fields,
          admissionDate,
          status: 'ACTIVE',
          currentClassId: schoolClass.id,
          photoConsent: false,
          customFields: {},
        }),
      );

      // Admission opens the first enrolment, exactly as adding a student by
      // hand does — without it the child has a class but no history.
      const sessionId = await this.currentSessionId(manager, context.schoolId);
      if (sessionId) {
        await manager.save(
          manager.create(StudentEnrollment, {
            schoolId: context.schoolId,
            studentId: student.id,
            sessionId,
            levelId: schoolClass.levelId,
            classId: schoolClass.id,
            status: 'ACTIVE',
            enrolledOn: admissionDate,
          }),
        );
      }

      await manager.increment(SchoolClass, { id: schoolClass.id }, 'enrolledCount', 1);
      studentId = student.id;
      outcome = 'CREATED';
    }

    await this.attachGuardian(context.schoolId, studentId, row, manager);
    return outcome;
  }

  private async attachGuardian(
    schoolId: string,
    studentId: string,
    row: MappedRow,
    manager: EntityManager,
  ): Promise<void> {
    const email = (row.guardianEmail ?? '').trim().toLowerCase();
    const fullName = normaliseSpacing(row.guardianName ?? '');
    if (!email || !fullName || !EMAIL.test(email)) return;

    const { firstName, lastName } = splitPersonName(fullName);
    const phone = (row.guardianPhone ?? '').trim();

    let guardian = await this.guardians.findByEmail(schoolId, email, manager);
    if (!guardian) {
      guardian = await this.guardians.create(
        { schoolId, firstName, lastName, email, phone: phone || 'Not given' },
        manager,
      );
    }

    const link = await this.guardians.findLinkByPair(schoolId, studentId, guardian.id, manager);
    if (link) return;

    const existingLinks = await this.guardians.countLinksForStudent(schoolId, studentId, manager);
    await this.guardians.createLink(
      {
        schoolId,
        studentId,
        guardianId: guardian.id,
        relationship: 'GUARDIAN',
        isPrimaryContact: existingLinks === 0,
        isEmergencyContact: existingLinks === 0,
      },
      manager,
    );
  }

  private async currentSessionId(manager: EntityManager, schoolId: string): Promise<string | null> {
    const [row] = await manager.query(
      `SELECT id FROM academic_sessions
        WHERE school_id = $1 AND is_current = TRUE AND deleted_at IS NULL
        LIMIT 1`,
      [schoolId],
    );
    return row?.id ?? null;
  }

  private checkDate(rowNumber: number, raw: string | undefined, field: string, required: boolean) {
    const value = (raw ?? '').trim();
    if (!value) {
      return required
        ? [issue(rowNumber, 'ERROR' as const, 'REQUIRED', 'A date of birth is required.', field)]
        : [];
    }
    if (!isIsoDate(value)) {
      return [
        issue(
          rowNumber,
          'ERROR' as const,
          'INVALID_DATE',
          'Write dates as YYYY-MM-DD, for example 2014-05-12.',
          field,
          value,
        ),
      ];
    }
    if (field === 'dateOfBirth') {
      const born = new Date(`${value}T00:00:00Z`).getTime();
      if (born >= Date.now()) {
        return [issue(rowNumber, 'ERROR' as const, 'INVALID_DATE', 'A date of birth cannot be in the future.', field, value)];
      }
      const years = (Date.now() - born) / (365.25 * 24 * 60 * 60 * 1000);
      if (years >= MAX_STUDENT_AGE_YEARS) {
        return [issue(rowNumber, 'ERROR' as const, 'IMPLAUSIBLE_DATE', 'That date of birth looks wrong for a student.', field, value)];
      }
    }
    return [];
  }
}
