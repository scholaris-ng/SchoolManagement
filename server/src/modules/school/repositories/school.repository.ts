import type { DeepPartial } from 'typeorm';
import { BaseRepository } from '../../../shared/repositories/baseRepository';
import { School } from '../entities/school.entity';

export class SchoolRepository extends BaseRepository<School> {
  static Instance = new SchoolRepository();

  private constructor() {
    super(School);
  }

  async findBySlug(slug: string): Promise<School | null> {
    return this.repo.findOne({ where: { slug: slug.toLowerCase() } });
  }

  async findByCode(code: string): Promise<School | null> {
    return this.repo.findOne({ where: { code: code.toUpperCase() } });
  }

  /**
   * Conditional update guarded by the version the caller loaded
   * (spec section 34).
   *
   * The version is in the WHERE clause rather than compared in application code:
   * two administrators saving at the same instant both pass a read-then-compare
   * check, but only one can match the row here. `affected === 0` means the other
   * one got there first.
   */
  async updateIfVersionMatches(
    id: string,
    expectedVersion: number,
    patch: DeepPartial<School>,
  ): Promise<School | null> {
    const result = await this.repo
      .createQueryBuilder()
      .update(School)
      .set({ ...patch, version: () => 'version + 1' } as never)
      .where('id = :id AND version = :expectedVersion', { id, expectedVersion })
      .execute();

    if ((result.affected ?? 0) === 0) return null;
    return this.findById(id);
  }

  async update(id: string, patch: DeepPartial<School>): Promise<School | null> {
    await this.repo.update(id, patch as never);
    return this.findById(id);
  }
}
