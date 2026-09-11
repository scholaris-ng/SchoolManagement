import { GuardianRepository } from '../../guardians/repositories/guardian.repository';
import { StudentRepository } from '../../students/repositories/student.repository';
import type { GuardianRelationship } from '../../guardians/entities/studentGuardian.entity';
import type { ImportEntityHandler, MappedRow, RowCheck, RowContext } from './importHandler.interface';
import { issue } from './importHandler.interface';
import { normaliseSpacing } from '../utils/cells';

const RELATIONSHIPS = ['FATHER', 'MOTHER', 'GUARDIAN', 'SPONSOR', 'OTHER'] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+()\d\s-]{7,20}$/;

/** Guardians: email is the key; a child's admission number attaches them. */
export class GuardiansImportHandler implements ImportEntityHandler {
  readonly entity = 'GUARDIANS' as const;
  readonly naturalKeyField = 'email';
  readonly naturalKeyLabel = 'email address';

  private readonly guardians = GuardianRepository.Instance;
  private readonly students = StudentRepository.Instance;

  naturalKey(row: MappedRow): string | null {
    return row.email?.trim().toLowerCase() || null;
  }

  async check({ context, rowNumber, row, manager }: RowContext): Promise<RowCheck> {
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
    if (admissionNo) {
      const student = await this.students.findByAdmissionNo(context.schoolId, admissionNo, manager);
      if (!student || student.deletedAt) {
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
    }

    const existing = email ? await this.guardians.findByEmail(context.schoolId, email, manager) : null;

    return {
      issues,
      willUpdate: Boolean(existing),
      preview: {
        firstName,
        lastName,
        email,
        phone,
        relationship: this.relationshipOf(row),
        studentAdmissionNo: admissionNo,
      },
    };
  }

  async apply({ context, row, manager }: RowContext): Promise<'CREATED' | 'UPDATED'> {
    const firstName = normaliseSpacing(row.firstName);
    const lastName = normaliseSpacing(row.lastName);
    const email = row.email.trim().toLowerCase();
    const phone = row.phone.trim();
    const occupation = normaliseSpacing(row.occupation ?? '') || null;
    const address = normaliseSpacing(row.address ?? '') || null;

    const existing = await this.guardians.findByEmail(context.schoolId, email, manager);

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
    }

    const admissionNo = (row.studentAdmissionNo ?? '').trim();
    if (admissionNo) {
      const student = await this.students.findByAdmissionNo(context.schoolId, admissionNo, manager);
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
