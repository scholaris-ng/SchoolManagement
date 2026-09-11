import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { UserRepository } from '../repositories/user.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { AuditService } from '../../audit/services/audit.service';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import { toUserDTO } from './session.service';
import type { AuthenticatedUserDTO, UpdateProfileDTO } from '../dto/auth.dto';

export class ProfileService {
  static Instance = new ProfileService();

  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly memberships = MembershipRepository.Instance,
    private readonly staff = StaffRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async updateProfile(
    context: RequestContext,
    patch: UpdateProfileDTO,
  ): Promise<AuthenticatedUserDTO> {
    const user = await this.users.findById(context.user.id);
    if (!user) throw AppError.notFound('User');

    const before = {
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      phone: user.phone,
      photoUrl: user.photoUrl,
    };

    /*
      The joined name is stored rather than derived on read, so it has to be
      rebuilt here or it would still show the old name everywhere while the
      two parts underneath it said something else. A patch may carry one
      part without the other, so the missing half comes from the row.
    */
    const firstName = patch.firstName ?? user.firstName;
    const lastName = patch.lastName ?? user.lastName;
    const renamed = patch.firstName !== undefined || patch.lastName !== undefined;

    const updated = await this.users.update(user.id, {
      ...(renamed
        ? { firstName, lastName, displayName: [firstName, lastName].filter(Boolean).join(' ') }
        : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.photoUrl !== undefined ? { photoUrl: patch.photoUrl } : {}),
    });
    if (!updated) throw AppError.notFound('User');

    /*
      The staff directory keeps its own copy of the person, because an
      employee need not have an account at all and the list sorts and
      searches on those columns. So a change here has to be carried across,
      or the administrator goes on seeing whatever was typed on the day the
      record was created.

      This fills the directory in, it never empties it. A cleared phone or
      photograph is left where it is: the phone column is required on an
      employee, where it is the school's contact number for them, and a
      photograph an administrator put on the record should not disappear
      because the person happens to keep no picture on their own account.
      Removing either from the directory is the administrator's to do, on
      the staff form, which carries the removal back the other way.
    */
    await this.staff.updateForUser(user.id, {
      ...(renamed ? { firstName, lastName } : {}),
      ...(patch.phone ? { phone: patch.phone } : {}),
      ...(patch.photoUrl ? { photoUrl: patch.photoUrl } : {}),
    });

    await this.audit.record(context, {
      action: 'user.profile_updated',
      entityType: 'User',
      entityId: user.id,
      entityLabel: updated.displayName,
      before,
      after: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        displayName: updated.displayName,
        phone: updated.phone,
        photoUrl: updated.photoUrl,
      },
    });

    // Returned whole, memberships included, because the client replaces its
    // cached session with this response.
    const rows = await this.memberships.findForUser(user.id);
    return toUserDTO(updated, rows);
  }
}
