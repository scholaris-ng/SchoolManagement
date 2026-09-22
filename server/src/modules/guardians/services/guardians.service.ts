import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditService } from '../../audit/services/audit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { EmailVerificationRepository } from '../../auth/repositories/emailVerification.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { getIdentityProvider } from '../../../shared/services/identity.service';
import { generateTemporaryPassword } from '../../../shared/utils/password';
import { sendGuardianInviteEmail } from '../../../shared/utils/mailer';
import { env } from '../../../config/env';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { GuardianRepository } from '../repositories/guardian.repository';
import type { GuardianDTO, StudentGuardianLinkDTO } from '../dto/guardians.dto';
import type {
  CreateGuardianInput,
  FetchGuardiansQuery,
  LinkGuardianInput,
  UpdateGuardianInput,
  UpdateGuardianLinkInput,
} from '../validators/guardians.schema';

function nullIfBlank(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed ? trimmed : null;
}

export class GuardiansService {
  static Instance = new GuardiansService();

  private constructor(
    private readonly guardians = GuardianRepository.Instance,
    private readonly users = UserRepository.Instance,
    private readonly students = StudentRepository.Instance,
    private readonly access = StudentAccessService.Instance,
    private readonly audit = AuditService.Instance,
    private readonly verifications = EmailVerificationRepository.Instance,
    private readonly notifications = NotificationsService.Instance,
    private readonly schools = SchoolRepository.Instance,
  ) {}

  async fetchGuardians(
    context: RequestContext,
    query: FetchGuardiansQuery,
  ): Promise<Paginated<GuardianDTO>> {
    // A parent may see themselves and nobody else — not the other parents at
    // the school, and not the other guardian of their own child.
    const visibleIds = context.membership.guardianId ? [context.membership.guardianId] : null;
    return this.guardians.fetchPaginated(context.schoolId, {
      ...query,
      visibleIds,
      hasPortalAccess: query.hasPortalAccess === undefined ? undefined : query.hasPortalAccess === 'true',
    });
  }

  async fetchGuardian(context: RequestContext, id: string): Promise<GuardianDTO> {
    if (context.membership.guardianId && context.membership.guardianId !== id) {
      throw AppError.notFound('Guardian');
    }
    const guardian = await this.guardians.findOneDTO(context.schoolId, id);
    if (!guardian) throw AppError.notFound('Guardian');
    return guardian;
  }

  /** The basis of the parent portal: every child this guardian is linked to. */
  async fetchChildren(context: RequestContext, id: string): Promise<StudentGuardianLinkDTO[]> {
    if (context.membership.guardianId && context.membership.guardianId !== id) {
      throw AppError.notFound('Guardian');
    }
    return this.guardians.linksForGuardian(context.schoolId, id);
  }

  async createGuardian(
    context: RequestContext,
    input: CreateGuardianInput,
  ): Promise<GuardianDTO> {
    const email = nullIfBlank(input.email);

    if (email) {
      const clash = await this.guardians.findByEmail(context.schoolId, email);
      if (clash) {
        throw AppError.conflict(
          'A guardian with that email address already exists. Link the existing record instead of creating a second one.',
        );
      }
    }

    const guardian = await this.guardians.create({
      schoolId: context.schoolId,
      title: nullIfBlank(input.title),
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      phone: input.phone,
      altPhone: nullIfBlank(input.altPhone),
      occupation: nullIfBlank(input.occupation),
      address: nullIfBlank(input.address),
      hasPortalAccess: input.grantPortalAccess,
    });

    await this.audit.record(context, {
      action: 'guardian.created',
      entityType: 'Guardian',
      entityId: guardian.id,
      entityLabel: `${guardian.firstName} ${guardian.lastName}`,
      after: { email: guardian.email, portalAccess: guardian.hasPortalAccess },
    });

    const dto = await this.guardians.findOneDTO(context.schoolId, guardian.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateGuardian(
    context: RequestContext,
    id: string,
    patch: UpdateGuardianInput,
    expectedVersion: number | undefined,
  ): Promise<GuardianDTO> {
    const existing = await this.guardians.findByIdScoped(context.schoolId, id);
    if (!existing) throw AppError.notFound('Guardian');

    if (patch.email && patch.email !== existing.email) {
      const clash = await this.guardians.findByEmail(context.schoolId, patch.email);
      if (clash) throw AppError.conflict('A guardian with that email address already exists.');
    }

    const { grantPortalAccess, ...rest } = patch;
    const columns: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined) continue;
      columns[key] =
        key === 'firstName' || key === 'lastName' || key === 'phone'
          ? value
          : nullIfBlank(value as string);
    }
    if (grantPortalAccess !== undefined) columns.hasPortalAccess = grantPortalAccess;

    // Whichever of this call's own patch or the existing record has the last
    // word on each: a request granting access without ever mentioning email
    // still needs one on file, and a request clearing the email of a guardian
    // already granted access can't leave them with none.
    const effectiveEmail = 'email' in columns ? (columns.email as string | null) : existing.email;
    const effectiveHasPortalAccess = grantPortalAccess ?? existing.hasPortalAccess;
    if (effectiveHasPortalAccess && !effectiveEmail) {
      throw AppError.validation('Add an email address before granting this guardian portal access.', [
        { field: 'email', message: 'Add an email address before granting portal access.' },
      ]);
    }

    if (expectedVersion !== undefined) {
      const applied = await this.guardians.updateIfVersionMatches(id, expectedVersion, columns);
      if (!applied) throw AppError.versionConflict();
    } else {
      await this.guardians.update(id, columns);
    }

    await this.audit.record(context, {
      action: 'guardian.updated',
      entityType: 'Guardian',
      entityId: id,
      entityLabel: `${existing.firstName} ${existing.lastName}`,
      before: { email: existing.email, portalAccess: existing.hasPortalAccess },
      after: { email: patch.email ?? existing.email, portalAccess: grantPortalAccess },
    });

    const dto = await this.guardians.findOneDTO(context.schoolId, id);
    if (!dto) throw AppError.notFound('Guardian');
    return dto;
  }

  // ─── The join ──────────────────────────────────────────────────────────────

  async fetchStudentGuardians(
    context: RequestContext,
    studentId: string,
  ): Promise<StudentGuardianLinkDTO[]> {
    if (!(await this.access.canSeeStudent(context, studentId))) {
      throw AppError.notFound('Student');
    }
    return this.guardians.linksForStudent(context.schoolId, studentId);
  }

  async linkGuardian(
    context: RequestContext,
    studentId: string,
    input: LinkGuardianInput,
  ): Promise<StudentGuardianLinkDTO> {
    const student = await this.students.findByIdScoped(context.schoolId, studentId);
    if (!student) throw AppError.notFound('Student');

    const guardian = await this.guardians.findByIdScoped(context.schoolId, input.guardianId);
    if (!guardian) throw AppError.notFound('Guardian');

    const existing = await this.guardians.findLinkByPair(
      context.schoolId,
      studentId,
      input.guardianId,
    );
    if (existing) {
      throw AppError.conflict('That guardian is already linked to this student.');
    }

    const link = await this.guardians.createLink({
      schoolId: context.schoolId,
      studentId,
      guardianId: input.guardianId,
      relationship: input.relationship,
      isPrimaryContact: input.isPrimaryContact,
      isEmergencyContact: input.isEmergencyContact,
      isFinanciallyResponsible: input.isFinanciallyResponsible,
      canPickUp: input.canPickUp,
    });

    if (input.isPrimaryContact) {
      await this.guardians.clearOtherPrimaries(context.schoolId, studentId, link.id);
    }

    await this.audit.record(context, {
      action: 'guardian.linked',
      entityType: 'Student',
      entityId: studentId,
      entityLabel: `${student.firstName} ${student.lastName}`,
      after: {
        guardianId: guardian.id,
        relationship: input.relationship,
        canPickUp: input.canPickUp,
      },
      // Who may collect a child is a safeguarding decision.
      severity: 'WARNING',
    });

    const dto = await this.guardians.findLinkDTO(context.schoolId, link.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateGuardianLink(
    context: RequestContext,
    studentId: string,
    linkId: string,
    patch: UpdateGuardianLinkInput,
  ): Promise<StudentGuardianLinkDTO> {
    const link = await this.guardians.findLink(context.schoolId, linkId);
    if (!link || link.studentId !== studentId) throw AppError.notFound('Guardian link');

    await this.guardians.updateLink(linkId, {
      relationship: patch.relationship,
      isPrimaryContact: patch.isPrimaryContact,
      isEmergencyContact: patch.isEmergencyContact,
      isFinanciallyResponsible: patch.isFinanciallyResponsible,
      canPickUp: patch.canPickUp,
    });

    if (patch.isPrimaryContact) {
      await this.guardians.clearOtherPrimaries(context.schoolId, studentId, linkId);
    }

    await this.audit.record(context, {
      action: 'guardian.link.updated',
      entityType: 'Student',
      entityId: studentId,
      before: { relationship: link.relationship, canPickUp: link.canPickUp },
      after: { guardianId: link.guardianId, relationship: patch.relationship, canPickUp: patch.canPickUp },
      // Who may collect a child, and who the school calls first, are safeguarding decisions.
      severity: 'WARNING',
    });

    const dto = await this.guardians.findLinkDTO(context.schoolId, linkId);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async unlinkGuardian(
    context: RequestContext,
    studentId: string,
    linkId: string,
  ): Promise<void> {
    const link = await this.guardians.findLink(context.schoolId, linkId);
    if (!link || link.studentId !== studentId) throw AppError.notFound('Guardian link');

    // A child with no guardian at all has nobody the school may call, so the
    // last link is refused rather than silently allowed.
    const remaining = await this.guardians.linksForStudent(context.schoolId, studentId);
    if (remaining.length <= 1) {
      throw AppError.conflict(
        'A student must keep at least one guardian. Link another before removing this one.',
      );
    }

    await this.guardians.deleteLink(context.schoolId, linkId);

    await this.audit.record(context, {
      action: 'guardian.unlinked',
      entityType: 'Student',
      entityId: studentId,
      before: { guardianId: link.guardianId, canPickUp: link.canPickUp },
      severity: 'WARNING',
    });
  }

  /**
   * Opens the parent portal for a guardian.
   *
   * Creates the application user and the school membership that carries their
   * PARENT role and points at this guardian record — that pointer is what
   * `StudentAccessService` reads to decide they may see their own children and
   * nobody else's.
   *
   * Does not set a password the guardian will ever type: a school choosing
   * one would be a school that could read their child's portal as them. A
   * real Firebase credential is provisioned regardless, behind a password
   * nobody is told, purely so the address-confirmation code below and the
   * "set your password" link that follows it (`RegistrationService`,
   * `sendPasswordResetEmail`) have a credential to act on — the guardian
   * still proves the address is theirs and chooses their own password before
   * either does anything. An address that already holds a credential, from a
   * child at another school on the platform, is adopted rather than
   * recreated, and signs in with the account they already have.
   */
  async invite(
    context: RequestContext,
    guardianId: string,
  ): Promise<{ invited: boolean; email: string }> {
    const guardian = await this.guardians.findByIdScoped(context.schoolId, guardianId);
    if (!guardian) throw AppError.notFound('Guardian');

    if (!guardian.email) {
      throw AppError.conflict(
        'Add an email address for this guardian before inviting them to the parent portal.',
      );
    }

    // An `invite:` prefixed uid is this method's own former placeholder, from
    // before a real credential was provisioned here — never a real Firebase
    // uid, which is never colon-separated. Treated as no credential at all,
    // so a guardian invited under the old behaviour is repaired the next time
    // anyone invites (or resends to) them, rather than staying stuck forever.
    const existingUser = await this.users.findByEmail(guardian.email);
    const hasRealCredential = Boolean(
      existingUser?.firebaseUid && !existingUser.firebaseUid.startsWith('invite:'),
    );
    let firebaseUid = hasRealCredential ? existingUser!.firebaseUid : null;
    let createdIdentity = false;

    if (!firebaseUid) {
      const identity = getIdentityProvider();
      const created = await identity.createUser({
        email: guardian.email,
        password: generateTemporaryPassword(),
        displayName: `${guardian.firstName} ${guardian.lastName}`,
      });
      firebaseUid = created.uid;
      createdIdentity = true;
    }

    let invitedUserId: string | null = null;

    try {
      await AppDataSource.transaction(async (manager) => {
        await manager.query(
          `UPDATE guardians SET has_portal_access = TRUE, invited_at = now(), updated_at = now()
            WHERE id = $1`,
          [guardianId],
        );

        // Adopt an existing user with this address rather than creating a
        // second one — a parent who already has a child at another school on
        // the platform signs in with the account they already have. On that
        // path `firebaseUid` is theirs already, so the conflict update below
        // leaves it untouched; it only overwrites `firebase_uid` when this
        // call is the one that just minted it, which also repairs a row still
        // carrying the old `invite:` placeholder.
        const [user] = await manager.query(
          `INSERT INTO users (firebase_uid, email, first_name, last_name, display_name, email_verified)
           VALUES ($1, $2, $3, $4, $5, FALSE)
           ON CONFLICT (email) DO UPDATE SET
             ${createdIdentity ? 'firebase_uid = EXCLUDED.firebase_uid, ' : ''}updated_at = now()
           RETURNING id`,
          [
            firebaseUid,
            guardian.email,
            guardian.firstName,
            guardian.lastName,
            `${guardian.firstName} ${guardian.lastName}`,
          ],
        );

        const [membership] = await manager.query(
          `INSERT INTO school_memberships (user_id, school_id, guardian_id, status, invited_at)
           VALUES ($1, $2, $3, 'ACTIVE', now())
           ON CONFLICT (user_id, school_id)
           DO UPDATE SET guardian_id = EXCLUDED.guardian_id, status = 'ACTIVE', updated_at = now()
           RETURNING id`,
          [user.id, context.schoolId, guardianId],
        );

        await manager.query(
          `INSERT INTO membership_roles (membership_id, role_id)
           SELECT $1, r.id FROM roles r
           WHERE r.school_id = $2 AND r.key = 'PARENT' AND r.deleted_at IS NULL
           ON CONFLICT (membership_id, role_id) DO NOTHING`,
          [membership.id, context.schoolId],
        );

        await manager.query(`UPDATE guardians SET user_id = $1 WHERE id = $2`, [
          user.id,
          guardianId,
        ]);

        invitedUserId = user.id;
      });
    } catch (error) {
      // The credential now points at nothing on our side. Leaving it behind
      // would block this email address from ever being invited again.
      if (createdIdentity) {
        await getIdentityProvider()
          .deleteUser(firebaseUid)
          .catch((cleanupError) => {
            console.error('[guardian] Orphaned identity could not be removed:', cleanupError);
          });
      }
      throw error;
    }

    // Outside the transaction: the invitation has already been granted, and a
    // mail failure must not roll that back. A resend fixes a lost email.
    if (invitedUserId) {
      const children = await this.guardians.linksForGuardian(context.schoolId, guardianId);
      const code = await this.verifications.issue(
        invitedUserId,
        env.verificationCodeTtlMinutes,
      );

      if (!env.isProduction) {
        console.info(`[guardian-invite] Verification code for ${guardian.email}: ${code}`);
      }

      const school = await this.schools.findById(context.schoolId);
      void sendGuardianInviteEmail({
        to: guardian.email,
        firstName: guardian.firstName,
        schoolName: context.membership.schoolName,
        schoolEmail: school?.email ?? '',
        childNames: children.map((link) => link.studentName),
        code,
        expiresInMinutes: env.verificationCodeTtlMinutes,
      }).catch(console.error);

      // Waiting for them in the portal the first time they sign in. The email
      // above can be lost or filtered; this cannot.
      void this.notifications.notifyUser(context.schoolId, invitedUserId, {
        category: 'SYSTEM',
        title: `Welcome to ${context.membership.schoolName}`,
        body:
          children.length > 0
            ? `Your parent portal is open. You can follow ${children.map((link) => link.studentName).join(', ')} from here.`
            : 'Your parent portal is open.',
        actionUrl: '/family',
        severity: 'SUCCESS',
        entityType: 'Guardian',
        entityId: guardianId,
      });
    }

    await this.audit.record(context, {
      action: 'guardian.invited',
      entityType: 'Guardian',
      entityId: guardianId,
      entityLabel: `${guardian.firstName} ${guardian.lastName}`,
      after: { email: guardian.email, portalAccess: true },
      // Granting someone access to a child's records.
      severity: 'WARNING',
    });

    return { invited: true, email: guardian.email };
  }
}
