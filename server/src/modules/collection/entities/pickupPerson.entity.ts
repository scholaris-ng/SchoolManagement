import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';

/** Mirrors `PickupPerson['authorizationStatus']` in `client/src/types/people.ts`. */
export const AUTHORIZATION_STATUSES = ['PENDING', 'AUTHORIZED', 'REVOKED'] as const;

export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number];

/**
 * Somebody a child may be handed to at the gate (spec section 12) — a
 * grandparent, a driver, a neighbour. Distinct from a guardian: a guardian is
 * responsible for the child, a pickup person is merely allowed to collect them,
 * and the school decides who is on the list.
 */
@Entity('pickup_persons')
@Index('IDX_pickup_persons_student', ['studentId'])
export class PickupPerson extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_pickup_persons_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_pickup_persons_school' })
  school?: School;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_pickup_persons_student' })
  student?: Student;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 60 })
  relationship: string;

  @Column({ type: 'varchar', length: 40 })
  phone: string;

  @Column({ name: 'photo_url', type: 'varchar', length: 500, nullable: true })
  photoUrl: string | null;

  @Column({ name: 'authorization_status', type: 'varchar', length: 16, default: 'PENDING' })
  authorizationStatus: AuthorizationStatus;

  @Column({ name: 'authorized_by_name', type: 'varchar', length: 160, nullable: true })
  authorizedByName: string | null;

  @Column({ name: 'authorized_at', type: 'timestamptz', nullable: true })
  authorizedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
