import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { User } from '../../auth/entities/user.entity';
import { PickupPerson } from './pickupPerson.entity';

/** Mirrors `CollectionEvent['method']` in `client/src/types/people.ts`. */
export const COLLECTION_METHODS = ['GATE', 'BUS', 'SELF', 'OTHER'] as const;

export type CollectionMethod = (typeof COLLECTION_METHODS)[number];

/**
 * A child actually leaving the premises (spec section 12): who took them,
 * which member of staff let them go, and when. Append-only by design — this
 * history is the point of the feature, so nothing edits or deletes a row, and
 * the collector's name is stored even when they were on the pickup list, so
 * the record survives that list being changed.
 */
@Entity('collection_events')
@Index('IDX_collection_events_student_released', ['studentId', 'releasedAt'])
@Index('IDX_collection_events_school_released', ['schoolId', 'releasedAt'])
export class CollectionEvent extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_collection_events_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_collection_events_school' })
  school?: School;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_collection_events_student' })
  student?: Student;

  @Column({ name: 'pickup_person_id', type: 'uuid', nullable: true })
  pickupPersonId: string | null;

  @ManyToOne(() => PickupPerson, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pickup_person_id', foreignKeyConstraintName: 'FK_collection_events_pickup_person' })
  pickupPerson?: PickupPerson | null;

  @Column({ name: 'pickup_person_name', type: 'varchar', length: 160 })
  pickupPersonName: string;

  @Column({ type: 'varchar', length: 60 })
  relationship: string;

  @Column({ name: 'released_by_user_id', type: 'uuid', nullable: true })
  releasedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'released_by_user_id', foreignKeyConstraintName: 'FK_collection_events_released_by' })
  releasedBy?: User | null;

  @Column({ name: 'released_by_name', type: 'varchar', length: 160 })
  releasedByName: string;

  @Column({ name: 'released_at', type: 'timestamptz' })
  releasedAt: Date;

  @Column({ type: 'varchar', length: 10 })
  method: CollectionMethod;

  @Column({ name: 'parent_notified', type: 'boolean', default: false })
  parentNotified: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
