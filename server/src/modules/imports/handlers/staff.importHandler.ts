import { StaffService } from '../../staff/services/staff.service';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { ROLES } from '../../../config/constants';
import type { CreateStaffInput, UpdateStaffInput } from '../../staff/validators/staff.schema';
import type { ImportEntityHandler, MappedRow, RowCheck, RowContext } from './importHandler.interface';
import { issue } from './importHandler.interface';
import { isIsoDate, normaliseSpacing, splitList, todayIso } from '../utils/cells';

/** Platform operators and portal accounts are provisioned elsewhere, not by import. */
const ASSIGNABLE_ROLES = ROLES.filter(
  (role) => role !== 'SUPER_ADMIN' && role !== 'PARENT' && role !== 'STUDENT',
);

/** A staff row with no roles still needs one to be able to sign in and work. */
const DEFAULT_ROLE = 'TEACHER';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+()\d\s-]{7,20}$/;

/**
 * Staff: staff number is the key.
 *
 * Alone among the handlers this one calls the service rather than repositories.
 * Hiring someone provisions a real login with an identity provider and emails
 * them a password — work that sits outside any database transaction and cannot
 * be rolled back, so it reuses the same path as hiring one person by hand.
 */
export class StaffImportHandler implements ImportEntityHandler {
  readonly entity = 'STAFF' as const;
  readonly naturalKeyField = 'staffNo';
  readonly naturalKeyLabel = 'staff number';

  private readonly staff = StaffRepository.Instance;
  private readonly users = UserRepository.Instance;

  naturalKey(row: MappedRow): string | null {
    return row.staffNo?.trim() || null;
  }

  async check({ context, rowNumber, row }: RowContext): Promise<RowCheck> {
    const issues = [];
    const staffNo = (row.staffNo ?? '').trim();
    const firstName = normaliseSpacing(row.firstName ?? '');
    const lastName = normaliseSpacing(row.lastName ?? '');
    const email = (row.email ?? '').trim().toLowerCase();
    const phone = (row.phone ?? '').trim();
    const gender = (row.gender ?? '').trim().toUpperCase();
    const designation = normaliseSpacing(row.designation ?? '');

    if (!staffNo) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A staff number is required.', 'staffNo'));
    if (!firstName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A first name is required.', 'firstName'));
    if (!lastName) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A surname is required.', 'lastName'));
    if (!designation) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A designation is required.', 'designation'));
    if (gender !== 'MALE' && gender !== 'FEMALE') {
      issues.push(issue(rowNumber, 'ERROR', 'INVALID_GENDER', 'Gender must be MALE or FEMALE.', 'gender', row.gender));
    }
    if (!email) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A work email is required.', 'email'));
    else if (!EMAIL.test(email)) {
      issues.push(issue(rowNumber, 'ERROR', 'INVALID_EMAIL', 'That does not look like an email address.', 'email', email));
    }
    if (!phone) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A phone number is required.', 'phone'));
    else if (!PHONE.test(phone)) {
      issues.push(issue(rowNumber, 'ERROR', 'INVALID_PHONE', 'That does not look like a phone number.', 'phone', phone));
    }

    const roles = splitList(row.roleNames).map((role) => role.toUpperCase());
    const unknown = roles.filter((role) => !(ASSIGNABLE_ROLES as readonly string[]).includes(role));
    if (unknown.length > 0) {
      issues.push(
        issue(
          rowNumber,
          'ERROR',
          'INVALID_ROLE',
          `${unknown.join(', ')} is not a role you can assign here. Use: ${ASSIGNABLE_ROLES.join(', ')}.`,
          'roleNames',
          row.roleNames,
        ),
      );
    }

    const employmentDate = (row.employmentDate ?? '').trim();
    if (employmentDate && !isIsoDate(employmentDate)) {
      issues.push(
        issue(rowNumber, 'ERROR', 'INVALID_DATE', 'Write dates as YYYY-MM-DD, for example 2023-01-09.', 'employmentDate', employmentDate),
      );
    } else if (!employmentDate) {
      issues.push(
        issue(rowNumber, 'WARNING', 'EMPLOYMENT_DATE_DEFAULTED', "No employment date given, so today's date was used.", 'employmentDate'),
      );
    }

    let willUpdate = false;
    if (staffNo) {
      const existing = await this.staff.findByStaffNo(context.schoolId, staffNo);
      if (existing?.deletedAt) {
        issues.push(
          issue(
            rowNumber,
            'ERROR',
            'STAFF_NO_ARCHIVED',
            `Staff number "${staffNo}" belongs to someone who has left. Restore their record instead of importing over it.`,
            'staffNo',
            staffNo,
          ),
        );
      } else if (existing) {
        willUpdate = true;
      }
    }

    // The email is a sign-in credential, so it must be free platform-wide, not
    // just within this school — unless it already belongs to this same person.
    if (email && EMAIL.test(email) && !willUpdate) {
      const inUse = await this.users.findByEmail(email);
      if (inUse) {
        issues.push(
          issue(rowNumber, 'ERROR', 'EMAIL_IN_USE', 'An account with that email address already exists.', 'email', email),
        );
      }
    }

    return {
      issues,
      willUpdate,
      // Every column the template offers appears here: the wizard draws one
      // cell per mapped column, so anything left out reads as blank to a
      // school checking its file.
      preview: {
        staffNo,
        firstName,
        lastName,
        email,
        phone,
        gender,
        designation,
        department: normaliseSpacing(row.department ?? ''),
        roleNames: (roles.length > 0 ? roles : [DEFAULT_ROLE]).join(';'),
        employmentDate: employmentDate || todayIso(),
      },
    };
  }

  async apply({ context, row }: RowContext): Promise<'CREATED' | 'UPDATED'> {
    const staffNo = row.staffNo.trim();
    const roles = splitList(row.roleNames).map((role) => role.toUpperCase());
    const roleNames = roles.length > 0 ? roles : [DEFAULT_ROLE];
    const employmentDate = (row.employmentDate ?? '').trim() || todayIso();

    const shared = {
      staffNo,
      firstName: normaliseSpacing(row.firstName),
      lastName: normaliseSpacing(row.lastName),
      email: row.email.trim().toLowerCase(),
      phone: row.phone.trim(),
      gender: row.gender.trim().toUpperCase() as 'MALE' | 'FEMALE',
      designation: normaliseSpacing(row.designation),
      department: normaliseSpacing(row.department ?? '') || undefined,
      roleNames,
    };

    const existing = await this.staff.findByStaffNo(context.schoolId, staffNo);
    if (existing) {
      // Employment type and status have no column in the template, so they are
      // left off the patch rather than reset to a default on every re-import.
      const patch: UpdateStaffInput = { ...shared, employmentDate };
      await StaffService.Instance.updateStaff(context, existing.id, patch, undefined);
      return 'UPDATED';
    }

    const input: CreateStaffInput = {
      ...shared,
      employmentType: 'FULL_TIME',
      employmentDate,
      status: 'ACTIVE',
      subjectIds: [],
      classIds: [],
      isFormTeacher: false,
    };
    await StaffService.Instance.createStaff(context, input);
    return 'CREATED';
  }
}
