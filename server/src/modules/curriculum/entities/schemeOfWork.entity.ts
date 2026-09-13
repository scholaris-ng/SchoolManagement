import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { Subject } from '../../academics/entities/subject.entity';
import { Term } from '../../academics/entities/term.entity';
import { User } from '../../auth/entities/user.entity';
import { Curriculum } from './curriculum.entity';

/** Mirrors `SchemeStatus` in `client/src/types/curriculum.ts`. */
export const SCHEME_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED'] as const;

export type SchemeStatus = (typeof SCHEME_STATUSES)[number];

/**
 * A curriculum laid across one term's weeks (spec section 14). Generated as
 * a draft from the plan and the term's real dates, then reordered and edited
 * by the teacher before it is submitted; approval freezes it.
 *
 * One per curriculum per term — the plan is the same, only the term differs.
 * `version` is the optimistic lock the client echoes back as `If-Match`.
 */
@Entity('schemes_of_work')
@Index('IDX_schemes_of_work_curriculum_term', ['curriculumId', 'termId'], { unique: true })
@Index('IDX_schemes_of_work_school_status', ['schoolId', 'status'])
export class SchemeOfWork extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_schemes_of_work_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_schemes_of_work_school' })
  school?: School;

  @Column({ name: 'curriculum_id', type: 'uuid' })
  curriculumId: string;

  @ManyToOne(() => Curriculum, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'curriculum_id', foreignKeyConstraintName: 'FK_schemes_of_work_curriculum' })
  curriculum?: Curriculum;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id', foreignKeyConstraintName: 'FK_schemes_of_work_subject' })
  subject?: Subject;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => SchoolClass, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id', foreignKeyConstraintName: 'FK_schemes_of_work_class' })
  schoolClass?: SchoolClass;

  @Column({ name: 'term_id', type: 'uuid' })
  termId: string;

  @ManyToOne(() => Term, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'term_id', foreignKeyConstraintName: 'FK_schemes_of_work_term' })
  term?: Term;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status: SchemeStatus;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id', foreignKeyConstraintName: 'FK_schemes_of_work_created_by' })
  createdBy?: User | null;

  @Column({ name: 'created_by_name', type: 'varchar', length: 160 })
  createdByName: string;

  @Column({ name: 'approved_by_name', type: 'varchar', length: 160, nullable: true })
  approvedByName: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @VersionColumn()
  version: number;
}
