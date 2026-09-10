import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { UserRepository } from '../repositories/user.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { AuditService } from '../../audit/services/audit.service';
import { toUserDTO } from './session.service';
import type { AuthenticatedUserDTO, UpdateProfileDTO } from '../dto/auth.dto';

export class ProfileService {
  static Instance = new ProfileService();

  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly memberships = MembershipRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async updateProfile(
    context: RequestContext,
    patch: UpdateProfileDTO,
  ): Promise<AuthenticatedUserDTO> {
    const user = await this.users.findById(context.user.id);
    if (!user) throw AppError.notFound('User');

    const before = {
      displayName: user.displayName,
      phone: user.phone,
      photoUrl: user.photoUrl,
    };

    const updated = await this.users.update(user.id, {
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.photoUrl !== undefined ? { photoUrl: patch.photoUrl } : {}),
    });
    if (!updated) throw AppError.notFound('User');

    await this.audit.record(context, {
      action: 'user.profile_updated',
      entityType: 'User',
      entityId: user.id,
      entityLabel: updated.displayName,
      before,
      after: {
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
