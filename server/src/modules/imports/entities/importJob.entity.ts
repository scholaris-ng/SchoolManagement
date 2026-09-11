import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { User } from '../../auth/entities/user.entity';

export type ImportEntityName = 'STUDENTS' | 'GUARDIANS' | 'STAFF' | 'SUBJECTS' | 'FEES';

/**
 * Server-side statuses. The client's type also carries `UPLOADED` and `MAPPED`,
 * which describe the wizard before it ever calls the server — a row here only
 * exists from the moment a file has been validated.
 */
export type ImportJobStatus =
  | 'VALIDATED'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED';

export interface ImportRowIssueRecord {
  rowNumber: number;
  field?: string;
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  value?: string;
}

/**
 * One run of the bulk-import wizard (spec section 9).
 *
 * It carries the uploaded rows because the two calls are deliberately split:
 * `validate` writes nothing and hands back an id, and `commit` sends only that
 * id back. The rows are stored raw, alongside the mapping, rather than already
 * mapped — commit re-derives the mapped view itself, so the stored copy and the
 * mapping can never drift apart.
 *
 * Not soft-deletable: an import is a record of something that happened.
 */
@Entity('import_jobs')
@Index(['schoolId', 'createdAt'])
@Index(['schoolId', 'status'])
export class ImportJob extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 16 })
  entity: ImportEntityName;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  /** Target field key -> the spreadsheet heading it was matched to. */
  @Column({ type: 'jsonb' })
  mapping: Record<string, string | null>;

  /** The uploaded rows exactly as the browser parsed them, before mapping. */
  @Column({ type: 'jsonb' })
  rows: Record<string, string>[];

  @Column({ type: 'varchar', length: 16, default: 'VALIDATED' })
  status: ImportJobStatus;

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows: number;

  /**
   * How far a running import has got. Written outside the import's own
   * transaction — from inside it nothing would be visible until the whole file
   * committed, which is exactly when progress stops being interesting.
   */
  @Column({ name: 'processed_rows', type: 'int', default: 0 })
  processedRows: number;

  @Column({ name: 'valid_rows', type: 'int', default: 0 })
  validRows: number;

  @Column({ name: 'error_rows', type: 'int', default: 0 })
  errorRows: number;

  @Column({ name: 'warning_rows', type: 'int', default: 0 })
  warningRows: number;

  @Column({ name: 'duplicate_rows', type: 'int', default: 0 })
  duplicateRows: number;

  @Column({ type: 'int', default: 0 })
  created: number;

  @Column({ type: 'int', default: 0 })
  updated: number;

  @Column({ type: 'int', default: 0 })
  skipped: number;

  @Column({ type: 'int', default: 0 })
  failed: number;

  @Column({ type: 'jsonb', default: [] })
  issues: ImportRowIssueRecord[];

  @Column({ name: 'started_by_user_id', type: 'uuid', nullable: true })
  startedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'started_by_user_id' })
  startedByUser?: User | null;

  /** Kept alongside the id so history still reads correctly after someone leaves. */
  @Column({ name: 'started_by_name', type: 'varchar', length: 160 })
  startedByName: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
