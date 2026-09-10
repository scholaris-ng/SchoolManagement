import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { SchoolLevel } from './schoolLevel.entity';
import { Subject } from './subject.entity';

/**
 * Which levels a subject is offered at.
 *
 * A relational table rather than an array column on the subject: "what is
 * taught at JSS 1" is asked by the class picker, the score sheet and the
 * curriculum on every page, and that query wants an index, not a scan with a
 * containment test.
 */
@Entity('subject_levels')
@Index(['subjectId', 'levelId'], { unique: true })
@Index(['schoolId', 'levelId'])
export class SubjectLevel extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  @Index()
  subjectId: string;

  @ManyToOne(() => Subject, (subject) => subject.levelLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject?: Subject;

  @Column({ name: 'level_id', type: 'uuid' })
  @Index()
  levelId: string;

  @ManyToOne(() => SchoolLevel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id' })
  level?: SchoolLevel;
}
