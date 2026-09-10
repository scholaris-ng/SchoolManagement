import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Columns every table carries. Pure structure — no methods, no rules
 * (`server_arch.md` section 9.2).
 *
 * IMPORTANT for every entity in this codebase: give each `@Column` an explicit
 * `type`. The runtime is `tsx`, which compiles through esbuild, and esbuild does
 * not implement `emitDecoratorMetadata` — so TypeORM cannot infer a column's
 * type from its TypeScript type the way the decorator documentation assumes.
 * Leaving `type` off compiles and lints cleanly, then throws
 * `ColumnTypeUndefinedError` the moment the entity is loaded.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * Adds soft delete. Applied only where the business genuinely needs the row to
 * survive — a deleted student must still appear on last year's report cards —
 * rather than everywhere by default (spec section 42).
 */
export abstract class SoftDeletableEntity extends BaseEntity {
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
