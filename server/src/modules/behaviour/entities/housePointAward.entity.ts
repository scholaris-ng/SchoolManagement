import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Student } from '../../students/entities/student.entity';
import { House } from '../../academics/entities/house.entity';
import { Term } from '../../academics/entities/term.entity';
import { User } from '../../auth/entities/user.entity';

/** Mirrors `HousePointReason` in `client/src/types/behaviour.ts`. */
export const HOUSE_POINT_REASONS = [
  'ACADEMIC',
  'BEHAVIOUR',
  'READING',
  'SPORTS',
  'PUNCTUALITY',
  'SERVICE',
  'PENALTY',
  'OTHER',
] as const;

export type HousePointReason = (typeof HOUSE_POINT_REASONS)[number];

/**
 * Points given to a pupil, and through them to their house (spec section 24).
 * Negative for a penalty. The house's running total on `houses.points` is
 * kept in step inside the same transaction, so the standings never disagree
 * with the ledger of awards behind them.
 */
@Entity('house_point_awards')
@Index('IDX_house_point_awards_student_term', ['studentId', 'termId'])
@Index('IDX_house_point_awards_house_term', ['houseId', 'termId'])
@Index('IDX_house_point_awards_school_awarded', ['schoolId', 'awardedAt'])
export class HousePointAward extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_house_point_awards_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_house_point_awards_school' })
  school?: School;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_house_point_awards_student' })
  student?: Student;

  @Column({ name: 'house_id', type: 'uuid' })
  houseId: string;

  @ManyToOne(() => House, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'house_id', foreignKeyConstraintName: 'FK_house_point_awards_house' })
  house?: House;

  @Column({ name: 'term_id', type: 'uuid' })
  termId: string;

  @ManyToOne(() => Term, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'term_id', foreignKeyConstraintName: 'FK_house_point_awards_term' })
  term?: Term;

  @Column({ type: 'int' })
  points: number;

  @Column({ type: 'varchar', length: 20 })
  reason: HousePointReason;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'awarded_by_user_id', type: 'uuid', nullable: true })
  awardedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'awarded_by_user_id', foreignKeyConstraintName: 'FK_house_point_awards_awarded_by' })
  awardedBy?: User | null;

  @Column({ name: 'awarded_by_name', type: 'varchar', length: 160 })
  awardedByName: string;

  @Column({ name: 'awarded_at', type: 'timestamptz' })
  awardedAt: Date;
}
