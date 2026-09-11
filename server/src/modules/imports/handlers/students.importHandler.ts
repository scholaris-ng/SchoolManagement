import type { EntityManager } from 'typeorm';
import { StudentRepository } from '../../students/repositories/student.repository';
import { GuardianRepository } from '../../guardians/repositories/guardian.repository';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { HouseRepository } from '../../academics/repositories/facility.repository';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { Student } from '../../students/entities/student.entity';
import { StudentEnrollment } from '../../students/entities/studentEnrollment.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import type { RequestContext } from '../../../shared/types/context';
import type { ImportEntityHandler, MappedRow, RowCheck, RowContext } from './importHandler.interface';
import { issue, matchKey } from './importHandler.interface';
import { isIsoDate, normaliseSpacing, splitPersonName, todayIso } from '../utils/cells';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_STUDENT_AGE_YEARS = 30;

interface ResolvedClass {
  id: string;
  levelId: string;
  displayName: string;
}

interface StudentLookups {
  /**
   * Several spellings point at the same class — its name, its name with the
   * arm, and its code — so the value is a list: two classes answering to one
   * spelling is an ambiguity the row has to be told about, not resolved by
   * picking the first.
   */
  classesByName: Map<string, ResolvedClass[]>;
  housesByName: Map<string, { id: string }>;
  existingByAdmissionNo: Map<string, { id: string; currentClassId: string | null; deletedAt: Date | null }>;
  /** The school's current session, if one is open — the same for every row. */
  sessionId: string | null;
}

/**
 * Students: admission number is the key.
 *
 * The write path deliberately mirrors `StudentsService.createStudent` rather
 * than calling it — that method opens its own transaction, which would commit
 * independently of the import's and defeat the all-or-nothing guarantee.
 */
export class StudentsImportHandler implements ImportEntityHandler<StudentLookups> {
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

  async prepare(
    context: RequestContext,
    rows: MappedRow[],
    manager?: EntityManager,
  ): Promise<StudentLookups> {
    const admissionNos = rows.map((row) => this.naturalKey(row)).filter((no): no is string => Boolean(no));

    const [classes, houses, existing, session] = await Promise.all([
      this.classes.findAllForMatching(context.schoolId, manager),
      this.houses.findAllForMatching(context.schoolId, manager),
      this.students.findManyByAdmissionNo(context.schoolId, admissionNos, manager),
      this.currentSessionId(manager ?? AppDataSource.manager, context.schoolId),
    ]);

    const classesByName = new Map<string, ResolvedClass[]>();
    const add = (key: string, entry: ResolvedClass) => {
      const normalised = matchKey(key);
      if (!normalised) return;
      const bucket = classesByName.get(normalised);
      if (bucket) {
        if (!bucket.some((item) => item.id === entry.id)) bucket.push(entry);
      } else {
        classesByName.set(normalised, [entry]);
      }
    };

    for (const row of classes) {
      const entry: ResolvedClass = { id: row.id, levelId: row.levelId, displayName: row.displayName };
      add(row.name, entry);
      add(row.displayName, entry);
      if (row.arm) add(`${row.name} ${row.arm}`, entry);
      if (row.code) add(row.code, entry);
    }

    return {
      classesByName,
      housesByName: new Map(houses.map((house) => [matchKey(house.name), { id: house.id }])),
      existingByAdmissionNo: new Map(existing.map((row) => [row.admissionNo, row])),
      sessionId: session,
    };
  }

  async check({ rowNumber, row, lookups }: RowContext<StudentLookups>): Promise<RowCheck> {
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
      const matches = lookups.classesByName.get(matchKey(className)) ?? [];
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
    if (houseName && !lookups.housesByName.has(matchKey(houseName))) {
      issues.push(
        issue(rowNumber, 'WARNING', 'HOUSE_NOT_FOUND', `No house called "${houseName}" — left unset.`, 'houseName', houseName),
      );
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
      const existing = lookups.existingByAdmissionNo.get(admissionNo);
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
      // Every column the template offers appears here: the wizard draws one
      // cell per mapped column, so anything left out reads as blank to a
      // school checking its file.
      preview: {
        admissionNo,
        firstName,
        middleName: normaliseSpacing(row.middleName ?? ''),
        lastName,
        gender,
        dateOfBirth: (row.dateOfBirth ?? '').trim(),
        className: resolvedClass?.displayName ?? className,
        houseName,
        admissionDate: (row.admissionDate ?? '').trim() || todayIso(),
        address: normaliseSpacing(row.address ?? ''),
        guardianName,
        guardianPhone: (row.guardianPhone ?? '').trim(),
        guardianEmail,
      },
    };
  }

  async apply({ context, row, lookups, manager }: RowContext<StudentLookups>): Promise<'CREATED' | 'UPDATED'> {
    if (!manager) throw new Error('Student import must run inside a transaction.');

    const admissionNo = row.admissionNo.trim();
    const className = normaliseSpacing(row.className);
    const [schoolClass] = lookups.classesByName.get(matchKey(className)) ?? [];
    if (!schoolClass) throw new Error(`Class "${className}" could not be resolved.`);

    const houseName = normaliseSpacing(row.houseName ?? '');
    const house = houseName ? lookups.housesByName.get(matchKey(houseName)) : undefined;

    const fields = {
      firstName: normaliseSpacing(row.firstName),
      middleName: normaliseSpacing(row.middleName ?? '') || null,
      lastName: normaliseSpacing(row.lastName),
      gender: row.gender.trim().toUpperCase() as 'MALE' | 'FEMALE',
      dateOfBirth: row.dateOfBirth.trim(),
      address: normaliseSpacing(row.address ?? '') || null,
      houseId: house?.id ?? null,
    };

    const existing = lookups.existingByAdmissionNo.get(admissionNo);

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
      if (lookups.sessionId) {
        await manager.save(
          manager.create(StudentEnrollment, {
            schoolId: context.schoolId,
            studentId: student.id,
            sessionId: lookups.sessionId,
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
      // Keeps an admission number repeated later in the same file an update.
      lookups.existingByAdmissionNo.set(admissionNo, {
        id: student.id,
        currentClassId: schoolClass.id,
        deletedAt: null,
      });
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
