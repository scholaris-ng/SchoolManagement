import { randomInt } from 'node:crypto';
import type { DeepPartial, EntityManager } from 'typeorm';
import type { RequestContext } from '../../../shared/types/context';
import { AppError } from '../../../shared/errors/AppError';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { getIdentityProvider } from '../../../shared/services/identity.service';
import { sendStaffAccountEmail } from '../../../shared/utils/mailer';
import { AuditService } from '../../audit/services/audit.service';
import { UserRepository } from '../../auth/repositories/user.repository';
import { User } from '../../auth/entities/user.entity';
import { SchoolMembership } from '../../auth/entities/schoolMembership.entity';
import { MembershipRole } from '../../rbac/entities/membershipRole.entity';
import { RoleRepository } from '../../rbac/repositories/role.repository';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { SubjectRepository } from '../../academics/repositories/subject.repository';
import { TeachingAssignment } from '../entities/teachingAssignment.entity';
import { ClassFormTeacher } from '../../academics/entities/classFormTeacher.entity';
import { StaffRepository } from '../repositories/staff.repository';
import { Staff } from '../entities/staff.entity';
import type { StaffMemberDTO } from '../dto/staff.dto';
import type { CreateStaffInput, FetchStaffQuery, UpdateStaffInput } from '../validators/staff.schema';

/** Empty strings from an optional form field mean "not provided", not "set to blank". */
function nullIfBlank<T extends string | null | undefined>(value: T): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed ? trimmed : null;
}

/**
 * A password nobody chose and nobody but the admin creating the account ever
 * sees — it is returned once, in the create response, and the school hands it
 * to the new employee to change at first sign-in. One of each character class
 * is forced in so it clears a typical strength check outright rather than
 * merely by chance.
 */
function generateTemporaryPassword(): string {
  const classes = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnpqrstuvwxyz',
    '23456789',
    '!@#$%^&*-_',
  ];
  const all = classes.join('');
  const pick = (charset: string) => charset[randomInt(charset.length)];

  const required = classes.map(pick);
  const rest = Array.from({ length: 8 }, () => pick(all));
  const chars = [...required, ...rest];

  // Fisher-Yates, so the forced characters are not always the first four.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export interface CreateStaffResult {
  member: StaffMemberDTO;
  temporaryPassword: string;
}

/**
 * The staff roster, and the one account-provisioning flow that goes with
 * hiring someone: creating a member of staff opens their access at the same
 * time, because the form collects their roles up front rather than deferring
 * them to an acceptance step (spec section 5 / ARCHITECTURE.md `IdentityProvider`).
 *
 * `staff.read` gates every read below and is deliberately not held by a
 * teacher: a colleague's phone number, salary grade and employment history are
 * not theirs to browse. There is no per-row narrowing the way students have,
 * because there is no role that may see some employees and not others.
 */
export class StaffService {
  static Instance = new StaffService();

  private constructor(
    private readonly staff = StaffRepository.Instance,
    private readonly users = UserRepository.Instance,
    private readonly roles = RoleRepository.Instance,
    private readonly classes = ClassRepository.Instance,
    private readonly subjects = SubjectRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async fetchAll(
    context: RequestContext,
    query: FetchStaffQuery,
  ): Promise<Paginated<StaffMemberDTO>> {
    return this.staff.fetchPaginated(context.schoolId, query);
  }

  async fetchOne(context: RequestContext, id: string): Promise<StaffMemberDTO> {
    const member = await this.staff.findOneDTO(context.schoolId, id);
    // Scoped by school before it is looked up, so an id from another tenant is
    // a plain not-found rather than a hint that the record exists elsewhere.
    if (!member) throw AppError.notFound('Staff member');
    return member;
  }

  async createStaff(
    context: RequestContext,
    input: CreateStaffInput,
  ): Promise<CreateStaffResult> {
    const staffNoClash = await this.staff.findByStaffNo(context.schoolId, input.staffNo);
    if (staffNoClash) throw AppError.conflict('That staff number is already in use.');

    const emailClash = await this.users.findByEmail(input.email);
    if (emailClash) {
      throw AppError.conflict('An account with that email address already exists.');
    }

    const roleRows = await Promise.all(
      input.roleNames.map(async (name) => {
        const role = await this.roles.findByKey(context.schoolId, name);
        if (!role) throw AppError.internal(`Role "${name}" is not set up for this school.`);
        return role;
      }),
    );

    await this.assertClassesAndSubjectsExist(context.schoolId, input.classIds, input.subjectIds);

    const displayName = `${input.firstName} ${input.lastName}`;
    const temporaryPassword = generateTemporaryPassword();
    const identity = getIdentityProvider();

    // The credential is created first, exactly as school registration does it:
    // it is the one step that can fail for reasons nothing here controls, and
    // everything after it is ours and runs in one transaction.
    const { uid } = await identity.createUser({
      email: input.email,
      password: temporaryPassword,
      displayName,
    });

    let created: Staff;
    try {
      created = await AppDataSource.transaction(async (manager) => {
        const user = await manager.save(
          manager.create(User, {
            firebaseUid: uid,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            displayName,
            // The administrator has already been asked for these, so the
            // account starts with them rather than showing the new employee
            // an empty profile and asking for them a second time.
            phone: input.phone,
            photoUrl: input.photoUrl ?? null,
            // Unlike self-registration, nobody typed this address into a form
            // of their own — an administrator who already holds `staff.manage`
            // entered it, so there is no stranger's inbox to prove control of
            // before the account is trusted (same reasoning as an invited
            // guardian's Firebase-confirmed address in `SessionService`).
            emailVerified: true,
            isPlatformAdmin: false,
          }),
        );

        const staffMember = await manager.save(
          manager.create(Staff, {
            schoolId: context.schoolId,
            userId: user.id,
            staffNo: input.staffNo,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            gender: input.gender,
            photoUrl: input.photoUrl ?? null,
            designation: input.designation,
            department: nullIfBlank(input.department),
            employmentType: input.employmentType,
            employmentDate: input.employmentDate,
            status: input.status,
          }),
        );

        const membership = await manager.save(
          manager.create(SchoolMembership, {
            userId: user.id,
            schoolId: context.schoolId,
            status: 'ACTIVE',
            staffId: staffMember.id,
            invitedAt: new Date(),
            acceptedAt: new Date(),
          }),
        );

        await manager.save(
          roleRows.map((role) =>
            manager.create(MembershipRole, { membershipId: membership.id, roleId: role.id }),
          ),
        );

        await this.writeTeachingAssignments(
          manager,
          context.schoolId,
          staffMember.id,
          input.classIds,
          input.subjectIds,
        );

        if (input.isFormTeacher && input.classIds.length > 0) {
          await manager.save(
            input.classIds.map((classId) =>
              manager.create(ClassFormTeacher, {
                schoolId: context.schoolId,
                classId,
                staffId: staffMember.id,
              }),
            ),
          );
        }

        return staffMember;
      });
    } catch (error) {
      // The credential now points at nothing on our side. Leaving it behind
      // would block this email address from ever being used again.
      await identity.deleteUser(uid).catch((cleanupError) => {
        console.error('[staff] Orphaned identity could not be removed:', cleanupError);
      });
      throw error;
    }

    // Keeps Firebase's own record in step with the DB row above, which is
    // what a session actually checks — belt and braces against anything else
    // that ever reads the identity provider's flag directly.
    await identity.markEmailVerified(uid).catch((error) => {
      console.error('[staff] Could not mark the new identity verified:', error);
    });

    await this.audit.record(context, {
      action: 'staff.created',
      entityType: 'Staff',
      entityId: created.id,
      entityLabel: displayName,
      after: { staffNo: created.staffNo, roleNames: input.roleNames },
      severity: 'CRITICAL',
    });

    // Fire-and-forget, like every other transactional email here: a bounced
    // address must not undo a successful hire. The admin's copy in the create
    // dialog is the fallback if this never arrives.
    void sendStaffAccountEmail({
      to: input.email,
      firstName: input.firstName,
      schoolName: context.membership.schoolName,
      designation: input.designation,
      temporaryPassword,
    }).catch(console.error);

    const dto = await this.staff.findOneDTO(context.schoolId, created.id);
    if (!dto) throw AppError.internal();
    return { member: dto, temporaryPassword };
  }

  async updateStaff(
    context: RequestContext,
    id: string,
    patch: UpdateStaffInput,
    expectedVersion: number | undefined,
  ): Promise<StaffMemberDTO> {
    const existing = await this.staff.findByIdScoped(context.schoolId, id);
    if (!existing) throw AppError.notFound('Staff member');

    if (patch.staffNo && patch.staffNo !== existing.staffNo) {
      const clash = await this.staff.findByStaffNo(context.schoolId, patch.staffNo);
      if (clash) throw AppError.conflict('That staff number is already in use.');
    }
    if (patch.email && patch.email !== existing.email) {
      const clash = await this.staff.findByEmail(context.schoolId, patch.email);
      if (clash) throw AppError.conflict('A staff member with that email address already exists.');
    }

    let roleRows: { id: string }[] | undefined;
    if (patch.roleNames) {
      roleRows = await Promise.all(
        patch.roleNames.map(async (name) => {
          const role = await this.roles.findByKey(context.schoolId, name);
          if (!role) throw AppError.internal(`Role "${name}" is not set up for this school.`);
          return role;
        }),
      );
    }

    if (patch.classIds || patch.subjectIds) {
      await this.assertClassesAndSubjectsExist(
        context.schoolId,
        patch.classIds ?? [],
        patch.subjectIds ?? [],
      );
    }

    /*
      Everything named here is kept out of the column set on purpose. The
      first four are relationships written further down; photoStoragePath is
      not a column on this table at all. The upload hands the path to the
      form and the form sends it back with everything else, but only the
      student record has somewhere to keep it, so letting it through turned
      every staff edit into a failure on a column that does not exist.
    */
    const {
      roleNames,
      subjectIds,
      classIds,
      isFormTeacher,
      photoStoragePath: _photoStoragePath,
      ...rest
    } = patch;
    const columns: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined) continue;
      columns[key] = typeof value === 'string' ? nullIfBlank(value) || value : value;
    }
    // Names, staff number and the enums are required fields — blank is never
    // the intent, so they are written as given rather than nulled.
    for (const key of ['staffNo', 'firstName', 'lastName', 'email', 'phone', 'designation'] as const) {
      if (patch[key] !== undefined) columns[key] = patch[key];
    }

    if (expectedVersion !== undefined) {
      const applied = await this.staff.updateIfVersionMatches(id, expectedVersion, columns);
      if (!applied) throw AppError.versionConflict();
    } else {
      await this.staff.update(id, columns);
    }

    await AppDataSource.transaction(async (manager) => {
      if (roleRows && existing.userId) {
        const membership = await manager.findOne(SchoolMembership, {
          where: { userId: existing.userId, schoolId: context.schoolId },
        });
        if (membership) {
          await manager.delete(MembershipRole, { membershipId: membership.id });
          await manager.save(
            roleRows.map((role) =>
              manager.create(MembershipRole, { membershipId: membership.id, roleId: role.id }),
            ),
          );
        }
      }

      // Whichever side of the pairing was left out of a partial patch keeps
      // its current value rather than being emptied out from under it.
      let effectiveClassIds = classIds;
      if (subjectIds || classIds) {
        const [resolvedClassIds, resolvedSubjectIds] = await Promise.all([
          classIds ?? this.currentClassIds(manager, context.schoolId, id),
          subjectIds ?? this.currentSubjectIds(manager, context.schoolId, id),
        ]);
        effectiveClassIds = resolvedClassIds;
        await manager.delete(TeachingAssignment, { schoolId: context.schoolId, staffId: id });
        await this.writeTeachingAssignments(
          manager,
          context.schoolId,
          id,
          resolvedClassIds,
          resolvedSubjectIds,
        );
      }

      if (isFormTeacher !== undefined || effectiveClassIds) {
        const nextIsFormTeacher = isFormTeacher ?? (await this.currentlyFormTeacher(manager, id));
        const nextClassIds =
          effectiveClassIds ?? (await this.currentClassIds(manager, context.schoolId, id));
        await manager.delete(ClassFormTeacher, { staffId: id });
        if (nextIsFormTeacher && nextClassIds.length > 0) {
          await manager.save(
            nextClassIds.map((classId) =>
              manager.create(ClassFormTeacher, { schoolId: context.schoolId, classId, staffId: id }),
            ),
          );
        }
      }
    });

    /*
      The same person, the other way round. An administrator correcting a
      misspelt surname here must reach the account too, or the staff list and
      the name that person signs in under disagree from then on. Only the
      fields that describe the person travel: the staff number, designation
      and employment terms are the school's record of the job, not of them.
    */
    if (existing.userId) {
      const identity: DeepPartial<User> = {};
      if (patch.firstName !== undefined) identity.firstName = patch.firstName;
      if (patch.lastName !== undefined) identity.lastName = patch.lastName;
      if (patch.phone !== undefined) identity.phone = patch.phone;
      if (patch.photoUrl !== undefined) identity.photoUrl = patch.photoUrl;
      if (patch.firstName !== undefined || patch.lastName !== undefined) {
        identity.displayName = [
          patch.firstName ?? existing.firstName,
          patch.lastName ?? existing.lastName,
        ]
          .filter(Boolean)
          .join(' ');
      }
      if (Object.keys(identity).length > 0) {
        await this.users.update(existing.userId, identity);
      }
    }

    await this.audit.record(context, {
      action: 'staff.updated',
      entityType: 'Staff',
      entityId: id,
      entityLabel: `${existing.firstName} ${existing.lastName}`,
      before: { status: existing.status, designation: existing.designation },
      after: { status: patch.status ?? existing.status, designation: patch.designation ?? existing.designation },
      severity: patch.status && patch.status !== existing.status ? 'CRITICAL' : 'INFO',
    });

    const dto = await this.staff.findOneDTO(context.schoolId, id);
    if (!dto) throw AppError.notFound('Staff member');
    return dto;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private async assertClassesAndSubjectsExist(
    schoolId: string,
    classIds: string[],
    subjectIds: string[],
  ): Promise<void> {
    for (const classId of classIds) {
      const found = await this.classes.findByIdScoped(schoolId, classId);
      if (!found) throw AppError.validation('One of the selected classes could not be found.');
    }
    for (const subjectId of subjectIds) {
      const found = await this.subjects.findByIdScoped(schoolId, subjectId);
      if (!found) throw AppError.validation('One of the selected subjects could not be found.');
    }
  }

  /**
   * Every subject × class pair selected, recorded as if this teacher takes
   * each subject in each class. The two multi-selects the form offers cannot
   * express anything narrower — a teacher whose Biology is only in JSS 1 while
   * their Mathematics is only in SSS 1 needs a pairing picker the UI does not
   * yet have, so today's write is the closest an admin can already ask for.
   */
  private async writeTeachingAssignments(
    manager: EntityManager,
    schoolId: string,
    staffId: string,
    classIds: string[],
    subjectIds: string[],
  ): Promise<void> {
    if (classIds.length === 0 || subjectIds.length === 0) return;
    const rows = classIds.flatMap((classId) =>
      subjectIds.map((subjectId) =>
        manager.create(TeachingAssignment, { schoolId, staffId, classId, subjectId }),
      ),
    );
    await manager.save(rows);
  }

  private async currentlyFormTeacher(
    manager: EntityManager,
    staffId: string,
  ): Promise<boolean> {
    const count = await manager.count(ClassFormTeacher, { where: { staffId } });
    return count > 0;
  }

  private async currentClassIds(
    manager: EntityManager,
    schoolId: string,
    staffId: string,
  ): Promise<string[]> {
    const rows: { classId: string }[] = await manager.query(
      `SELECT DISTINCT class_id AS "classId" FROM teaching_assignments
        WHERE school_id = $1 AND staff_id = $2`,
      [schoolId, staffId],
    );
    return rows.map((row) => row.classId);
  }

  private async currentSubjectIds(
    manager: EntityManager,
    schoolId: string,
    staffId: string,
  ): Promise<string[]> {
    const rows: { subjectId: string }[] = await manager.query(
      `SELECT DISTINCT subject_id AS "subjectId" FROM teaching_assignments
        WHERE school_id = $1 AND staff_id = $2`,
      [schoolId, staffId],
    );
    return rows.map((row) => row.subjectId);
  }
}
