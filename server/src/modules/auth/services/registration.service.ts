import type { EntityManager } from 'typeorm';
import { AppError } from '../../../shared/errors/AppError';
import { env } from '../../../config/env';
import {
  DEFAULT_ROLE_PERMISSIONS,
  ROLES,
  ROLE_LABEL,
} from '../../../config/constants';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import {
  getIdentityProvider,
  type IdentityProvider,
} from '../../../shared/services/identity.service';
import {
  sendPasswordResetEmail,
  sendSchoolReadyEmail,
  sendVerificationEmail,
} from '../../../shared/utils/mailer';
import { School } from '../../school/entities/school.entity';
import { Role } from '../../rbac/entities/role.entity';
import { MembershipRole } from '../../rbac/entities/membershipRole.entity';
import { User } from '../entities/user.entity';
import { SchoolMembership } from '../entities/schoolMembership.entity';
import { UserRepository } from '../repositories/user.repository';
import {
  EmailVerificationRepository,
  MAX_VERIFICATION_ATTEMPTS,
  hashCode,
} from '../repositories/emailVerification.repository';
import type {
  ForgotPasswordInput,
  RegisterSchoolInput,
  ResendVerificationInput,
  VerifyEmailInput,
} from '../validators/registration.schema';

export interface RegistrationResultDTO {
  email: string;
  schoolName: string;
  /** Minutes the emailed code stays valid, so the UI can say so. */
  expiresInMinutes: number;
  emailVerified: boolean;
}

/**
 * Deliberately carries no school details.
 *
 * The already-verified branch below answers without checking a code, so
 * returning the school here would let anyone turn an email address into the
 * name of the school it belongs to. The client does not need it: the next step
 * is signing in, which returns the full session.
 */
export interface VerificationResultDTO {
  email: string;
  emailVerified: boolean;
}

/**
 * School self-registration (spec section 6).
 *
 * One unauthenticated call creates an administrator and the school they run.
 * The account exists immediately but cannot be used: a session is refused until
 * the emailed code is entered, so an address nobody controls never reaches a
 * school's data. The school starts on TRIAL and stays there until a
 * subscription completes the picture.
 */
/**
 * How long a reset link stays usable.
 *
 * Firebase fixes this at one hour and the Admin SDK offers no way to change it,
 * so the number is stated here only so the email and the screen can say the
 * same thing the link actually does.
 */
const PASSWORD_RESET_TTL_HOURS = 1;

export class RegistrationService {
  static Instance = new RegistrationService();

  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly verifications = EmailVerificationRepository.Instance,
  ) {}

  async register(input: RegisterSchoolInput): Promise<RegistrationResultDTO> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict('An account with that email address already exists.');
    }

    const displayName = `${input.firstName} ${input.lastName}`;
    const identity: IdentityProvider = getIdentityProvider();

    // The credential is created first, because it is the only step that can
    // fail for reasons we cannot see coming — a duplicate Firebase account, a
    // rejected password. Everything after it is ours and runs in one
    // transaction.
    const { uid } = await identity.createUser({
      email: input.email,
      password: input.password,
      displayName,
    });

    let user: User;
    let school: School;

    try {
      const result = await AppDataSource.transaction(async (manager) => {
        const createdSchool = await this.createSchool(manager, input.schoolName, input.email);
        const roles = await this.seedRoles(manager, createdSchool.id);

        const createdUser = await manager.save(
          manager.create(User, {
            firebaseUid: uid,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            displayName,
            emailVerified: false,
            isPlatformAdmin: false,
          }),
        );

        const membership = await manager.save(
          manager.create(SchoolMembership, {
            userId: createdUser.id,
            schoolId: createdSchool.id,
            status: 'ACTIVE',
            acceptedAt: new Date(),
          }),
        );

        const adminRole = roles.get('SCHOOL_ADMIN');
        if (!adminRole) throw AppError.internal('Could not assign the administrator role.');
        await manager.save(
          manager.create(MembershipRole, {
            membershipId: membership.id,
            roleId: adminRole.id,
          }),
        );

        return { createdUser, createdSchool };
      });

      user = result.createdUser;
      school = result.createdSchool;
    } catch (error) {
      // The credential now points at nothing. Leaving it behind would block the
      // person from ever retrying with their own email address.
      await identity.deleteUser(uid).catch((cleanupError) => {
        console.error('[registration] Orphaned identity could not be removed:', cleanupError);
      });
      throw error;
    }

    const code = await this.verifications.issue(user.id, env.verificationCodeTtlMinutes);

    if (!env.isProduction) {
      console.info(`[registration] Verification code for ${user.email}: ${code}`);
    }

    // Fire and forget: a bounced email must not undo a successful registration.
    void sendVerificationEmail({
      to: user.email,
      firstName: user.firstName,
      schoolName: school.name,
      code,
      expiresInMinutes: env.verificationCodeTtlMinutes,
    }).catch(console.error);

    return {
      email: user.email,
      schoolName: school.name,
      expiresInMinutes: env.verificationCodeTtlMinutes,
      emailVerified: false,
    };
  }

  async verifyEmail(input: VerifyEmailInput): Promise<VerificationResultDTO> {
    const user = await this.users.findByEmail(input.email);
    // Deliberately the same failure as a wrong code: whether an address is
    // registered is not something an unauthenticated caller gets to enumerate.
    if (!user) throw AppError.validation('That code is not valid. Request a new one.');

    // Idempotent: someone double-submitting the form gets the same answer
    // rather than an error about a code that has already been spent.
    if (user.emailVerified) {
      return { email: user.email, emailVerified: true };
    }

    const membership = await this.firstMembership(user.id);

    const record = await this.verifications.findActive(user.id);
    if (!record) throw AppError.validation('That code is not valid. Request a new one.');

    if (record.expiresAt.getTime() < Date.now()) {
      throw AppError.validation('That code has expired. Request a new one.');
    }
    if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      throw AppError.validation('Too many incorrect attempts. Request a new code.');
    }

    if (record.codeHash !== hashCode(input.code)) {
      const attempts = await this.verifications.recordFailedAttempt(record.id);
      const left = Math.max(0, MAX_VERIFICATION_ATTEMPTS - attempts);
      throw AppError.validation(
        left > 0
          ? `That code is not correct. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'Too many incorrect attempts. Request a new code.',
      );
    }

    await this.verifications.consume(record.id);
    await this.users.update(user.id, { emailVerified: true });
    await getIdentityProvider()
      .markEmailVerified(user.firebaseUid)
      .catch((error) => console.error('[registration] Could not mark identity verified:', error));

    void sendSchoolReadyEmail({
      to: user.email,
      firstName: user.firstName,
      schoolName: membership.schoolName,
      schoolCode: membership.schoolCode,
    }).catch(console.error);

    return { email: user.email, emailVerified: true };
  }

  async resendVerification(input: ResendVerificationInput): Promise<{ expiresInMinutes: number }> {
    const user = await this.users.findByEmail(input.email);

    // Always the same answer, whether or not the address exists and whether or
    // not it is already verified — otherwise this endpoint becomes a way to
    // test which email addresses have accounts.
    if (user && !user.emailVerified) {
      const membership = await this.firstMembership(user.id).catch(() => null);
      const code = await this.verifications.issue(user.id, env.verificationCodeTtlMinutes);

      if (!env.isProduction) {
        console.info(`[registration] Verification code for ${user.email}: ${code}`);
      }

      void sendVerificationEmail({
        to: user.email,
        firstName: user.firstName,
        schoolName: membership?.schoolName ?? 'your school',
        code,
        expiresInMinutes: env.verificationCodeTtlMinutes,
      }).catch(console.error);
    }

    return { expiresInMinutes: env.verificationCodeTtlMinutes };
  }

  /**
   * Emails a link for setting a new password.
   *
   * The identity provider owns the credential and generates the link; this
   * sends it in our own template, so a reset arrives looking like every other
   * message from the school rather than unbranded from a service the recipient
   * has never heard of.
   *
   * Answers identically whether or not the address has an account, for the
   * same reason resending a verification code does: a different answer turns
   * this into a way to discover which of a school's parents and staff are
   * registered.
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<{ expiresInHours: number }> {
    const user = await this.users.findByEmail(input.email);

    if (user) {
      const link = await getIdentityProvider()
        .generatePasswordResetLink(user.email)
        .catch((error) => {
          console.error('[registration] Could not prepare a password reset:', error);
          return null;
        });

      if (link) {
        void sendPasswordResetEmail({
          to: user.email,
          firstName: user.firstName,
          resetUrl: link,
          expiresInHours: PASSWORD_RESET_TTL_HOURS,
        }).catch(console.error);
      }
    }

    return { expiresInHours: PASSWORD_RESET_TTL_HOURS };
  }

  // ─── Provisioning helpers ──────────────────────────────────────────────────

  private async createSchool(
    manager: EntityManager,
    schoolName: string,
    contactEmail: string,
  ): Promise<School> {
    const slug = await this.uniqueValue(manager, 'slug', toSlug(schoolName));
    const code = await this.uniqueValue(manager, 'code', toCode(schoolName));

    return manager.save(
      manager.create(School, {
        name: schoolName,
        shortName: schoolName.slice(0, 60),
        code,
        slug,
        email: contactEmail,
        // Empty rather than null: the client's `School` type has these as
        // required strings, and the settings screen makes the school supply
        // them before its first save.
        phone: '',
        addressLine1: '',
        city: '',
        state: '',
        status: 'TRIAL',
        branding: {
          primaryColor: '#1d4ed8',
          accentColor: '#f59e0b',
          logoUrl: null,
          faviconUrl: null,
          motto: null,
        },
        settings: {
          timezone: 'Africa/Lagos',
          currency: 'NGN',
          currencySymbol: '₦',
          country: 'NG',
          locale: 'en-NG',
          requirePhotoConsent: true,
          absenceAlertEnabled: true,
          absenceAlertCutoff: '09:30',
          resultPublishNotification: true,
          allowParentTeacherMessaging: true,
          publicWebsiteEnabled: false,
        },
      }),
    );
  }

  /** Every school gets its own copy of the built-in roles, so editing one is local. */
  private async seedRoles(
    manager: EntityManager,
    schoolId: string,
  ): Promise<Map<string, Role>> {
    const created = new Map<string, Role>();
    for (const key of ROLES) {
      const role = await manager.save(
        manager.create(Role, {
          schoolId,
          name: ROLE_LABEL[key],
          key,
          description: null,
          isSystem: true,
          permissions: DEFAULT_ROLE_PERMISSIONS[key],
        }),
      );
      created.set(key, role);
    }
    return created;
  }

  /** Appends `-2`, `-3` … until the column is free. */
  private async uniqueValue(
    manager: EntityManager,
    column: 'slug' | 'code',
    base: string,
  ): Promise<string> {
    for (let suffix = 0; suffix < 100; suffix += 1) {
      const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
      const clash = await manager.findOne(School, {
        where: { [column]: candidate },
        withDeleted: true,
      });
      if (!clash) return candidate;
    }
    throw AppError.conflict('Could not derive a unique identifier for that school name.');
  }

  private async firstMembership(userId: string): Promise<{
    schoolId: string;
    schoolName: string;
    schoolCode: string;
  }> {
    const [row] = await AppDataSource.query(
      `SELECT m.school_id AS "schoolId", s.name AS "schoolName", s.code AS "schoolCode"
       FROM school_memberships m
       JOIN schools s ON s.id = m.school_id
       WHERE m.user_id = $1 AND m.deleted_at IS NULL
       ORDER BY m.created_at ASC
       LIMIT 1`,
      [userId],
    );
    if (!row) throw AppError.notFound('School');
    return row;
  }
}

/** "St. Mary's College" becomes "st-marys-college". */
function toSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110);
  return slug || 'school';
}

/** "Brightfield Academy" becomes "BFA"; a single word becomes its first letters. */
function toCode(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const initials =
    words.length > 1
      ? words.map((word) => word[0]).join('')
      : (words[0] ?? 'SCH').slice(0, 3);

  return (initials || 'SCH').toUpperCase().slice(0, 12);
}
