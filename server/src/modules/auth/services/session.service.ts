import { AppError } from '../../../shared/errors/AppError';
import { ROLES, type Permission, type RoleName } from '../../../config/constants';
import type { AuthIdentity, MembershipContext, UserContext } from '../../../shared/types/context';
import type { SchoolBranding } from '../../school/entities/school.entity';
import { UserRepository } from '../repositories/user.repository';
import { MembershipRepository, type MembershipRow } from '../repositories/membership.repository';
import type { AuthenticatedUserDTO, SchoolMembershipDTO, SessionDTO } from '../dto/auth.dto';
import type { User } from '../entities/user.entity';

const ROLE_NAME_SET = new Set<string>(ROLES);

/**
 * Turns a verified Firebase identity into "who this is, and what they may do
 * here" (spec section 5).
 *
 * Firebase answers only the first half. Everything about access — which schools,
 * which roles, which permissions — is read from PostgreSQL on every request. No
 * authorisation decision is ever taken from a token claim, which is what keeps
 * a stale or tampered token from outliving a revoked membership.
 */
export class SessionService {
  static Instance = new SessionService();

  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly memberships = MembershipRepository.Instance,
  ) {}

  /**
   * The application's own record of a Firebase user, created on first sight.
   *
   * A brand-new identity gets a row with no memberships, which is exactly the
   * state an invited parent is in between clicking the invite and an
   * administrator linking them to a school.
   */
  async ensureUser(identity: AuthIdentity): Promise<User> {
    const existing = await this.users.findByFirebaseUid(identity.firebaseUid);
    if (existing) return existing;

    // The same person may have been pre-registered by email — a staff record
    // created before they ever signed in — so adopt that row rather than
    // creating a second one for the same address.
    const byEmail = await this.users.findByEmail(identity.email);
    if (byEmail) {
      return (
        (await this.users.update(byEmail.id, { firebaseUid: identity.firebaseUid })) ?? byEmail
      );
    }

    return this.users.create({
      firebaseUid: identity.firebaseUid,
      email: identity.email,
      displayName: identity.displayName?.trim() || identity.email.split('@')[0],
      photoUrl: identity.photoUrl ?? null,
      isPlatformAdmin: false,
    });
  }

  async loadMemberships(userId: string): Promise<MembershipRow[]> {
    return this.memberships.findForUser(userId);
  }

  /**
   * Why a staff membership may not be used right now, or null if it is fine.
   *
   * The roster is the single source of truth, so marking someone on leave takes
   * effect on their next request rather than at their next sign-in — a session
   * already open must not stay usable.
   */
  staffBlockReason(row: MembershipRow): string | null {
    if (!row.staffId) return null;
    if (row.staffStatus === 'ON_LEAVE') {
      return 'This staff account is on leave and cannot sign in. Contact your school administrator.';
    }
    if (row.staffStatus === 'EXITED') {
      return 'This staff account has exited the school and can no longer sign in. Contact your school administrator.';
    }
    return null;
  }

  /**
   * Which membership a request acts under.
   *
   * `X-School-Id` is a hint about which of the user's own memberships they mean,
   * never a grant. A school the user has no row for is not an error the caller
   * can distinguish from having no memberships at all — it simply is not theirs
   * (spec section 4).
   */
  selectMembership(rows: MembershipRow[], requestedSchoolId: string | null): MembershipRow | null {
    const usable = rows.filter((row) => row.status === 'ACTIVE');
    if (usable.length === 0) return null;
    if (requestedSchoolId) {
      return usable.find((row) => row.schoolId === requestedSchoolId) ?? null;
    }
    return usable[0];
  }

  async buildSession(identity: AuthIdentity, requestedSchoolId: string | null): Promise<SessionDTO> {
    const user = await this.ensureUser(identity);
    const rows = await this.loadMemberships(user.id);

    // A blocked staff account is a distinct, explainable refusal — not the same
    // generic "you are not signed in" a missing token gets.
    const named = requestedSchoolId
      ? rows.find((row) => row.schoolId === requestedSchoolId)
      : rows[0];
    if (named) {
      const reason = this.staffBlockReason(named);
      if (reason) throw AppError.forbidden(reason);
    }

    const active = this.selectMembership(rows, requestedSchoolId);
    await this.users.touchLastLogin(user.id);

    return {
      user: toUserDTO(user, rows),
      activeSchoolId: active?.schoolId ?? null,
    };
  }

  toUserContext(user: User): UserContext {
    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      phone: user.phone,
      photoUrl: user.photoUrl,
      isPlatformAdmin: user.isPlatformAdmin,
    };
  }

  toMembershipContext(row: MembershipRow, isPlatformAdmin: boolean): MembershipContext {
    const permissions = [...new Set(row.permissions.filter(Boolean))] as Permission[];
    // The platform-operator flag lives on the user, not on any school's role
    // list, so it is folded in here rather than granted by a membership.
    if (isPlatformAdmin && !permissions.includes('platform.manage')) {
      permissions.push('platform.manage');
    }
    return {
      id: row.id,
      schoolId: row.schoolId,
      schoolName: row.schoolName,
      schoolShortName: row.schoolShortName,
      schoolSlug: row.schoolSlug,
      branchId: row.branchId,
      branchName: row.branchName,
      roles: splitRoles(row.roleKeys).builtIn,
      customRoleNames: splitRoles(row.roleKeys, row.roleNames).custom,
      permissions,
      status: row.status,
      guardianId: row.guardianId,
      studentId: row.studentId,
      staffId: row.staffId,
    };
  }
}

/**
 * A school may invent roles of its own, so the key list is split: the ones that
 * match a built-in name drive persona selection, and the rest are shown by name.
 */
function splitRoles(
  keys: string[],
  names: string[] = [],
): { builtIn: RoleName[]; custom: string[] } {
  const builtIn: RoleName[] = [];
  const custom: string[] = [];
  keys.forEach((key, index) => {
    if (!key) return;
    if (ROLE_NAME_SET.has(key)) builtIn.push(key as RoleName);
    else custom.push(names[index] ?? key);
  });
  return { builtIn, custom };
}

export function toMembershipDTO(row: MembershipRow): SchoolMembershipDTO {
  const split = splitRoles(row.roleKeys, row.roleNames);
  return {
    id: row.id,
    schoolId: row.schoolId,
    schoolName: row.schoolName,
    schoolShortName: row.schoolShortName,
    schoolSlug: row.schoolSlug,
    branchId: row.branchId,
    branchName: row.branchName,
    roles: split.builtIn,
    customRoleNames: split.custom,
    permissions: [...new Set(row.permissions.filter(Boolean))] as Permission[],
    branding: row.schoolBranding as unknown as SchoolBranding,
    status: row.status,
    guardianId: row.guardianId,
    studentId: row.studentId,
    staffId: row.staffId,
  };
}

export function toUserDTO(user: User, rows: MembershipRow[]): AuthenticatedUserDTO {
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    phone: user.phone,
    photoUrl: user.photoUrl,
    isPlatformAdmin: user.isPlatformAdmin,
    memberships: rows.map(toMembershipDTO),
    createdAt: user.createdAt.toISOString(),
  };
}
