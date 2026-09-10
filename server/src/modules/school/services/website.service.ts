import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { SchoolRepository } from '../repositories/school.repository';
import { WebsiteRepository } from '../repositories/website.repository';
import type { WebsiteContent } from '../entities/websiteContent.entity';
import type { UpdateWebsiteInput } from '../validators/school.schema';

export class WebsiteService {
  static Instance = new WebsiteService();

  private constructor(
    private readonly website = WebsiteRepository.Instance,
    private readonly schools = SchoolRepository.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /**
   * The school's page, created empty on first read.
   *
   * Lazily rather than at school creation so an existing school that predates
   * the feature still gets one, and nobody has to remember a backfill.
   */
  async getForSchool(schoolId: string): Promise<WebsiteContent> {
    const existing = await this.website.findBySchool(schoolId);
    if (existing) return existing;

    const school = await this.schools.findById(schoolId);
    if (!school) throw AppError.notFound('School');

    return this.website.create({
      schoolId,
      enabled: false,
      slug: school.slug,
      tagline: school.branding.motto ?? '',
      about: '',
      contactEmail: school.email,
      contactPhone: school.phone,
      address: [school.addressLine1, school.city, school.state].filter(Boolean).join(', '),
      socialLinks: [],
      testimonials: [],
      gallery: [],
    });
  }

  async update(context: RequestContext, patch: UpdateWebsiteInput): Promise<WebsiteContent> {
    const current = await this.getForSchool(context.schoolId);

    const updated = await this.website.update(context.schoolId, patch);
    if (!updated) throw AppError.notFound('Website content');

    await this.audit.record(context, {
      action: 'website.updated',
      entityType: 'WebsiteContent',
      entityId: updated.id,
      entityLabel: updated.slug,
      before: { enabled: current.enabled, admissionsOpen: current.admissionsOpen },
      after: { enabled: updated.enabled, admissionsOpen: updated.admissionsOpen },
    });

    return updated;
  }

  /** Unauthenticated. Returns only what a published page is meant to show. */
  async getPublicBySlug(slug: string): Promise<WebsiteContent> {
    const content = await this.website.findPublishedBySlug(slug);
    if (!content) throw AppError.notFound('School');
    return content;
  }
}
