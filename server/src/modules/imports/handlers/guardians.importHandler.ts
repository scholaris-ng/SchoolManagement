import type { EntityManager } from 'typeorm';
import type { RequestContext } from '../../../shared/types/context';
import { GuardianRepository } from '../../guardians/repositories/guardian.repository';
import { StudentRepository } from '../../students/repositories/student.repository';
import type { GuardianRelationship } from '../../guardians/entities/studentGuardian.entity';
import type { ImportEntityHandler, MappedRow, RowCheck, RowContext } from './importHandler.interface';
import { issue } from './importHandler.interface';
import { normaliseSpacing } from '../utils/cells';

const RELATIONSHIPS = ['FATHER', 'MOTHER', 'GUARDIAN', 'SPONSOR', 'OTHER'] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+()\d\s-]{7,20}$/;

interface GuardianLookups {
  existingByEmail: Map<string, { id: string }>;
  /** Students the file refers to by admission number; absent means no such pupil. */
  studentsByAdmissionNo: Map<string, { id: string }>;
}

/** Guardians: email is the key; a child's admission number attaches them. */
export class GuardiansImportHandler implements ImportEntityHandler<GuardianLookups> {
  readonly entity = 'GUARDIANS' as const;
  readonly naturalKeyField = 'email';
  readonly naturalKeyLabel = 'email address';

  private readonly guardians = GuardianRepository.Instance;
  private readonly students = StudentRepository.Instance;

  naturalKey(row: MappedRow): string | null {
    return row.email?.trim().toLowerCase() || null;
  }

  async prepare(
    context: RequestContext,
    rows: MappedRow[],
    manager?: EntityManager,
  ): Promise<GuardianLookups> {
    const emails = rows.map((row) => this.naturalKey(row)).filter((email): email is string => Boolean(email));
    const admissionNos = rows
      .map((row) => (row.studentAdmissionNo ?? '').trim())
      .filter((value) => value.length > 0);

    const [existing, students] = await Promise.all([
      this.guardians.findManyByEmail(context.schoolId, emails, manager),
      this.students.findManyByAdmissionNo(context.schoolId, admissionNos, manager),
    ]);

    return {
      existingByEmail: new Map(existing.map((row) => [row.email.toLowerCase(), { id: row.id }])),
      studentsByAdmissionNo: new Map(
        students.filter((row) => !row.deletedAt).map((row) => [row.admissionNo, { id: row.id }]),
      ),
    };
  }

  async check({ rowNumber, row, lookups }: RowContext<GuardianLookups>): Promise<RowCheck> {
    const issues = [];
    const firstName = normaliseSpacing(row.firstName ?? '');
    const lastName = normaliseSpacing(row.lastName ?? '');
    const email = (row.email ?? '').trim().toLowerCase();
    const phone = (row.phone ?? '').trim();

    if (!firstName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A first name is required.', 'firstName'));
    if (!lastName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A surname is required.', 'lastName'));
    if (!email) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'An email address is required.', 'email'));
    else if (!EMAIL.test(email)) {
      issues.push(issue(rowNumber, 'ERROR', 'INVALID_EMAIL', 'That does not look like an email address.', 'email', email));
    }
    if (!phone) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A phone number is required.', 'phone'));
    else if (!PHONE.test(phone)) {
      issues.push(issue(rowNumber, 'ERROR', 'INVALID_PHONE', 'That does not look like a phone number.', 'phone', phone));
    }

    const relationshipCell = (row.relationship ?? '').trim().toUpperCase();
    if (relationshipCell && !(RELATIONSHIPS as readonly string[]).includes(relationshipCell)) {
      issues.push(
        issue(
          rowNumber,
          'WARNING',
          'UNKNOWN_RELATIONSHIP',
          `"${row.relationship}" is not a relationship we recognise, so OTHER was used.`,
          'relationship',
          row.relationship,
        ),
      );
    }

    // An admission number that names nobody is a mistake worth stopping for:
    // the guardian would import detached from the child they belong to.
    const admissionNo = (row.studentAdmissionNo ?? '').trim();
    if (admissionNo && !lookups.studentsByAdmissionNo.has(admissionNo)) {
      issues.push(
        issue(
          rowNumber,
          'ERROR',
          'STUDENT_NOT_FOUND',
          `No student has admission number "${admissionNo}".`,
          'studentAdmissionNo',
          admissionNo,
        ),
      );
    }

    return {
      issues,
      willUpdate: Boolean(email && lookups.existingByEmail.has(email)),
      // Every column the template offers appears here: the wizard draws one
      // cell per mapped column, so anything left out reads as blank to a
      // school checking its file.
      preview: {
        firstName,
        lastName,
        email,
        phone,
        relationship: this.relationshipOf(row),
        studentAdmissionNo: admissionNo,
        occupation: normaliseSpacing(row.occupation ?? ''),
        address: normaliseSpacing(row.address ?? ''),
      },
    };
  }

  async apply({ context, row, lookups, manager }: RowContext<GuardianLookups>): Promise<'CREATED' | 'UPDATED'> {
    const firstName = normaliseSpacing(row.firstName);
    const lastName = normaliseSpacing(row.lastName);
    const email = row.email.trim().toLowerCase();
    const phone = row.phone.trim();
    const occupation = normaliseSpacing(row.occupation ?? '') || null;
    const address = normaliseSpacing(row.address ?? '') || null;

    const existing = lookups.existingByEmail.get(email);

    let guardianId: string;
    let outcome: 'CREATED' | 'UPDATED';
    if (existing) {
      await this.guardians.update(existing.id, { firstName, lastName, phone, occupation, address }, manager);
      guardianId = existing.id;
      outcome = 'UPDATED';
    } else {
      const created = await this.guardians.create(
        { schoolId: context.schoolId, firstName, lastName, email, phone, occupation, address },
        manager,
      );
      guardianId = created.id;
      outcome = 'CREATED';
      // Keeps an address repeated later in the same file an update, not a clash.
      lookups.existingByEmail.set(email, { id: created.id });
    }

    const admissionNo = (row.studentAdmissionNo ?? '').trim();
    const student = admissionNo ? lookups.studentsByAdmissionNo.get(admissionNo) : undefined;
    if (student) {
      const link = await this.guardians.findLinkByPair(context.schoolId, student.id, guardianId, manager);
      if (!link) {
        // The first adult attached to a child becomes the one the school calls.
        const existingLinks = await this.guardians.countLinksForStudent(context.schoolId, student.id, manager);
        await this.guardians.createLink(
          {
            schoolId: context.schoolId,
            studentId: student.id,
            guardianId,
            relationship: this.relationshipOf(row) as GuardianRelationship,
            isPrimaryContact: existingLinks === 0,
            isEmergencyContact: existingLinks === 0,
          },
          manager,
        );
      }
    }

    return outcome;
  }

  /** Blank means "not stated" and takes the default; unreadable becomes OTHER. */
  private relationshipOf(row: MappedRow): string {
    const text = (row.relationship ?? '').trim().toUpperCase();
    if (!text) return 'GUARDIAN';
    return (RELATIONSHIPS as readonly string[]).includes(text) ? text : 'OTHER';
  }
}
