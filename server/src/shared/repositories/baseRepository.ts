import type {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { AppDataSource } from '../../infrastructure/database/dataSource';

/**
 * Shared data-access behaviour.
 *
 * `TenantRepository` below is the one that matters: every read and write it
 * offers takes `schoolId` as its first argument, so writing a query that spans
 * tenants takes deliberate effort rather than a moment's inattention
 * (spec section 4).
 */
export abstract class BaseRepository<T extends ObjectLiteral & { id: string }> {
  protected readonly repo: Repository<T>;

  protected constructor(
    entity: EntityTarget<T>,
    dataSource: DataSource = AppDataSource,
  ) {
    this.repo = dataSource.getRepository(entity);
  }

  get manager() {
    return this.repo.manager;
  }

  /**
   * The repository bound to a caller's open transaction, or the default one.
   *
   * Bulk import applies a whole file inside a single transaction, so the methods
   * it calls must write through *that* manager. Reaching for `this.repo` there
   * would quietly open a second, independently-committing transaction and a
   * failure half way through would leave the earlier rows behind.
   */
  protected repoFor(manager?: EntityManager): Repository<T> {
    return manager ? manager.getRepository(this.repo.target) : this.repo;
  }

  async findById(id: string): Promise<T | null> {
    return this.repo.findOne({ where: { id } as FindOptionsWhere<T> });
  }

  async save(entity: DeepPartial<T>): Promise<T> {
    return this.repo.save(this.repo.create(entity));
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}

export abstract class TenantRepository<
  T extends ObjectLiteral & { id: string; schoolId: string },
> extends BaseRepository<T> {
  protected constructor(
    entity: EntityTarget<T>,
    protected readonly alias: string,
    dataSource: DataSource = AppDataSource,
  ) {
    super(entity, dataSource);
  }

  /**
   * The starting point for every query in a tenant repository. Nothing here
   * builds a query builder without going through this, so the tenant predicate
   * cannot be left off by accident.
   */
  protected scopedQuery(schoolId: string): SelectQueryBuilder<T> {
    return this.repo
      .createQueryBuilder(this.alias)
      .where(`${this.alias}.schoolId = :schoolId`, { schoolId });
  }

  /** Null when the row belongs to another school, which reads as "not found". */
  async findByIdScoped(schoolId: string, id: string): Promise<T | null> {
    return this.repo.findOne({
      where: { id, schoolId } as FindOptionsWhere<T>,
    });
  }

  async existsScoped(schoolId: string, id: string): Promise<boolean> {
    const count = await this.repo.count({
      where: { id, schoolId } as FindOptionsWhere<T>,
    });
    return count > 0;
  }

  async countScoped(schoolId: string, where?: FindOptionsWhere<T>): Promise<number> {
    return this.repo.count({ where: { ...where, schoolId } as FindOptionsWhere<T> });
  }

  async softDeleteScoped(schoolId: string, id: string): Promise<boolean> {
    const result = await this.repo.softDelete({ id, schoolId } as FindOptionsWhere<T>);
    return (result.affected ?? 0) > 0;
  }
}
