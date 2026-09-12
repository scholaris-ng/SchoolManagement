import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import { AuditService } from '../../audit/services/audit.service';
import { SchoolRepository } from '../repositories/school.repository';
import { WebsiteRepository } from '../repositories/website.repository';
import type { SchoolBranding } from '../entities/school.entity';
import type { WebsiteContent } from '../entities/websiteContent.entity';
import type { UpdateWebsiteInput } from '../validators/school.schema';

/**
 * The public prospectus payload, matching the client's `PublicSchoolPage` in
 * `client/src/features/public/public.endpoints.ts`.
 */
export interface PublicSchoolPageDTO {
  school: {
    name: string;
    shortName: string;
    branding: SchoolBranding;
    city: string;
    state: string;
  };
  website: WebsiteContent;
  news: unknown[];
  events: unknown[];
}

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

    if (patch.slug && patch.slug !== current.slug) {
      const clash = await this.website.findBySlugExcludingSchool(patch.slug, context.schoolId);
      if (clash) throw AppError.conflict('That address is already in use. Choose another.');
    }

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

  /**
   * Unauthenticated. Returns only what a published page is meant to show.
   *
   * The shape is the client's `PublicSchoolPage`, not a bare website record:
   * the marketing page renders the school's identity, its copy, recent public
   * news and upcoming public events together, and one request is what a cold
   * visitor on a slow connection should pay for.
   *
   * `news` and `events` are empty until those modules land in phase 5. They are
   * present rather than omitted so the client's parser never sees a missing
   * field, and so filling them in later is not a breaking change.
   *
   * Note what is absent: no student names, no photographs, no counts that
   * could identify a child (spec section 41). A published page is the one
   * surface with no session behind it.
   */
  async getPublicBySlug(slug: string): Promise<PublicSchoolPageDTO> {
    const website = await this.website.findPublishedBySlug(slug);
    if (!website) throw AppError.notFound('School');

    const school = await this.schools.findById(website.schoolId);
    // A published page whose school has been soft-deleted is not found rather
    // than half-rendered.
    if (!school) throw AppError.notFound('School');

    return {
      school: {
        name: school.name,
        shortName: school.shortName,
        branding: school.branding,
        city: school.city,
        state: school.state,
      },
      website,
      news: [],
      events: [],
    };
  }
}
