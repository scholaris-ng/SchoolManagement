import { Not, type DeepPartial } from 'typeorm';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { WebsiteContent } from '../entities/websiteContent.entity';

export class WebsiteRepository {
  static Instance = new WebsiteRepository();

  private readonly repo = AppDataSource.getRepository(WebsiteContent);

  private constructor() {}

  async findBySchool(schoolId: string): Promise<WebsiteContent | null> {
    return this.repo.findOne({ where: { schoolId } });
  }

  /** Every school's address is its own — this checks across all the others. */
  async findBySlugExcludingSchool(slug: string, schoolId: string): Promise<WebsiteContent | null> {
    return this.repo.findOne({ where: { slug, schoolId: Not(schoolId) } });
  }

  /** Only ever serves the public page, so a disabled site is simply absent. */
  async findPublishedBySlug(slug: string): Promise<WebsiteContent | null> {
    return this.repo.findOne({ where: { slug: slug.toLowerCase(), enabled: true } });
  }

  async create(data: DeepPartial<WebsiteContent>): Promise<WebsiteContent> {
    return this.repo.save(this.repo.create(data));
  }

  async update(
    schoolId: string,
    patch: DeepPartial<WebsiteContent>,
  ): Promise<WebsiteContent | null> {
    await this.repo.update({ schoolId }, patch as never);
    return this.findBySchool(schoolId);
  }
}
