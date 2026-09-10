import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { SchoolRepository } from '../repositories/school.repository';
import type { School } from '../entities/school.entity';
import type { UpdateSchoolInput } from '../validators/school.schema';

/**
 * What the client's `School` type expects — deliberately not the entity.
 *
 * `deletedAt` is a soft-delete marker that exists for the repository's benefit;
 * it is not part of the contract and has no meaning to a settings screen.
 * Returning the entity directly is how internal columns leak into an API.
 */
export type SchoolDTO = Omit<School, 'deletedAt'>;

function toSchoolDTO(school: School): SchoolDTO {
  const { deletedAt: _deletedAt, ...rest } = school;
  return rest;
}

export class SchoolService {
  static Instance = new SchoolService();

  private constructor(
    private readonly schools = SchoolRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  async getCurrent(context: RequestContext): Promise<SchoolDTO> {
    const school = await this.schools.findById(context.schoolId);
    if (!school) throw AppError.notFound('School');
    return toSchoolDTO(school);
  }

  /**
   * Applies a settings patch, refusing to overwrite a concurrent edit
   * (spec section 34).
   *
   * `branding` and `settings` are merged rather than replaced: the client sends
   * only the fields its form owns, and a partial object would otherwise wipe
   * every sibling key in the jsonb column.
   */
  async updateCurrent(
    context: RequestContext,
    patch: UpdateSchoolInput,
    expectedVersion: number | undefined,
  ): Promise<SchoolDTO> {
    const school = await this.schools.findById(context.schoolId);
    if (!school) throw AppError.notFound('School');

    if (expectedVersion !== undefined && expectedVersion !== school.version) {
      throw AppError.versionConflict();
    }

    const { branding, settings, ...rest } = patch;
    const merged = {
      ...rest,
      ...(branding ? { branding: { ...school.branding, ...branding } } : {}),
      ...(settings ? { settings: { ...school.settings, ...settings } } : {}),
    };

    const updated = await this.schools.updateIfVersionMatches(
      school.id,
      school.version,
      merged,
    );
    // Nothing matched, so the row moved between the read above and this write.
    if (!updated) throw AppError.versionConflict();

    await this.audit.record(context, {
      action: 'school.settings_updated',
      entityType: 'School',
      entityId: school.id,
      entityLabel: updated.name,
      before: { branding: school.branding, settings: school.settings, name: school.name },
      after: { branding: updated.branding, settings: updated.settings, name: updated.name },
      severity: 'WARNING',
    });

    return toSchoolDTO(updated);
  }
}
