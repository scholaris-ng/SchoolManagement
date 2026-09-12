import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { User } from '../../auth/entities/user.entity';
import { AdmissionApplication, type ApplicationStatus } from './admissionApplication.entity';

/**
 * One step in an application's life — appended, never edited.
 *
 * A family that is refused a place will ask why, and sometimes ask a year
 * later. The answer has to be a record of who decided what and when, so the
 * status on the application is only ever the latest of these rows rather than
 * the whole truth.
 *
 * `actor_name` is denormalised beside the user id for the same reason it is on
 * the audit log: the registrar who screened this child may have left the school
 * by the time anyone reads it back.
 */
@Entity('admission_stage_events')
@Index(['schoolId', 'applicationId'])
@Index(['applicationId', 'occurredAt'])
export class AdmissionStageEvent extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @ManyToOne(() => AdmissionApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: AdmissionApplication;

  @Column({ type: 'varchar', length: 16 })
  status: ApplicationStatus;

  /** Null when the family submitted it themselves from the public website. */
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_user_id' })
  actor?: User | null;

  @Column({ type: 'varchar', name: 'actor_name', length: 160 })
  actorName: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;
}
