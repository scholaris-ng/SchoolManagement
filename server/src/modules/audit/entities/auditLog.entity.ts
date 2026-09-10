import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Append-only record of who changed what (spec section 33).
 *
 * Deliberately not a `BaseEntity`: there is no `updatedAt` because a row is
 * never updated, and no `deletedAt` because it is never deleted. An audit trail
 * that can be edited is not an audit trail.
 */
@Entity('audit_logs')
@Index(['schoolId', 'occurredAt'])
@Index(['schoolId', 'action'])
@Index(['schoolId', 'severity'])
@Index(['schoolId', 'entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  @Index()
  actorUserId: string | null;

  /**
   * The actor's name and role as they were at the time. Denormalised on
   * purpose: a log entry must still read correctly after the person is renamed,
   * changes role, or leaves the school entirely.
   */
  @Column({ type: 'varchar', name: 'actor_name', length: 160 })
  actorName: string;

  @Column({ type: 'varchar', name: 'actor_role', length: 80 })
  actorRole: string;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ type: 'varchar', name: 'entity_type', length: 80 })
  entityType: string;

  @Column({ type: 'varchar', name: 'entity_id', length: 80 })
  entityId: string;

  @Column({ type: 'varchar', name: 'entity_label', length: 240, nullable: true })
  entityLabel: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, unknown> | null;

  @Column({ type: 'varchar', name: 'ip_address', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', name: 'user_agent', length: 400, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', name: 'request_id', length: 128, nullable: true })
  requestId: string | null;

  @Column({ type: 'varchar', length: 16, default: 'INFO' })
  severity: 'INFO' | 'WARNING' | 'CRITICAL';

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;
}
