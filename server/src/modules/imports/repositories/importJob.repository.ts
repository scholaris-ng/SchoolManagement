import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { ImportJob } from '../entities/importJob.entity';
import type { ImportJobDTO } from '../dto/imports.dto';

export class ImportJobRepository extends TenantRepository<ImportJob> {
  static Instance = new ImportJobRepository();

  private constructor() {
    super(ImportJob, 'importJob');
  }

  async create(data: DeepPartial<ImportJob>): Promise<ImportJob> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<ImportJob>): Promise<void> {
    await this.repo.update(id, patch as never);
  }

  /**
   * Claims a job for committing, in one statement.
   *
   * Read-then-write would let two clicks a moment apart both see `VALIDATED`
   * and both start importing. A conditional update lets exactly one win.
   * A previously failed job wrote nothing, so it may be retried once whatever
   * was wrong — a missing class, say — has been put right.
   */
  async claimForImport(schoolId: string, id: string): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update(ImportJob)
      .set({ status: 'IMPORTING' })
      .where('id = :id AND school_id = :schoolId AND status IN (:...statuses)', {
        id,
        schoolId,
        statuses: ['VALIDATED', 'FAILED'],
      })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async fetchPaginated(
    schoolId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<ImportJobDTO>> {
    const [rows, total] = await this.repo.findAndCount({
      where: { schoolId },
      order: { createdAt: 'DESC' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });

    const items = rows.map<ImportJobDTO>((row) => ({
      id: row.id,
      schoolId: row.schoolId,
      entity: row.entity,
      fileName: row.fileName,
      status: row.status,
      totalRows: row.totalRows,
      created: row.created,
      failed: row.failed,
      startedByName: row.startedByName,
      startedAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString(),
    }));

    return paginatedResult(items, page, pageSize, total);
  }
}
