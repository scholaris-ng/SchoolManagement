import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { AcademicSession } from '../../academics/entities/academicSession.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { SchoolLevel } from '../../academics/entities/schoolLevel.entity';
import { Subject } from '../../academics/entities/subject.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * What one class is meant to be taught in one subject this session (spec
 * section 13) — the shell that topics and their objectives are written inside.
 *
 * A curriculum belongs to a class, not a level: JSS 1 Gold and JSS 1 Silver
 * move at different speeds, and coverage only means anything once the plan is
 * one class's own. The level is stored alongside so lists can group by it
 * without a join through the class.
 *
 * One per class, subject and session — a second plan for the same trio would
 * make "how much of the syllabus is covered" answerable two ways. Hard-deleted,
 * and its topics and objectives go with it: a curriculum is a plan, not a
 * record of anything that happened.
 */
@Entity('curricula')
@Index('IDX_curricula_session_class_subject', ['sessionId', 'classId', 'subjectId'], {
  unique: true,
})
export class Curriculum extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_curricula_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_curricula_school' })
  school?: School;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => AcademicSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id', foreignKeyConstraintName: 'FK_curricula_session' })
  session?: AcademicSession;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => SchoolClass, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id', foreignKeyConstraintName: 'FK_curricula_class' })
  schoolClass?: SchoolClass;

  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => SchoolLevel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id', foreignKeyConstraintName: 'FK_curricula_level' })
  level?: SchoolLevel;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id', foreignKeyConstraintName: 'FK_curricula_subject' })
  subject?: Subject;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id', foreignKeyConstraintName: 'FK_curricula_created_by' })
  createdBy?: User | null;

  /**
   * Captured as they were, the way an audit entry captures an actor: the plan
   * must still say who wrote it after that teacher has left.
   */
  @Column({ name: 'created_by_name', type: 'varchar', length: 160 })
  createdByName: string;

  @Column({ name: 'created_by_role', type: 'varchar', length: 40 })
  createdByRole: string;
}
