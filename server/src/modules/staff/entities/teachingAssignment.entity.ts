import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { Subject } from '../../academics/entities/subject.entity';
import { Staff } from './staff.entity';

/**
 * "This teacher teaches this subject to this class."
 *
 * Stored as a verified pair, which is the whole point of the table. A teacher
 * who takes Biology in JSS 1 and Mathematics in SSS 1 has two rows here — not a
 * list of two classes and a list of two subjects, whose cross-product would
 * wrongly imply they also take Mathematics in JSS 1. Every scoping decision
 * that names both a class and a subject is answered from these rows.
 */
@Entity('teaching_assignments')
@Index(['schoolId', 'staffId'])
@Index(['schoolId', 'classId', 'subjectId'])
@Index(['staffId', 'classId', 'subjectId'], { unique: true })
export class TeachingAssignment extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'staff_id', type: 'uuid' })
  @Index()
  staffId: string;

  @ManyToOne(() => Staff, (staff) => staff.teachingAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staff_id' })
  staff?: Staff;

  @Column({ name: 'class_id', type: 'uuid' })
  @Index()
  classId: string;

  @ManyToOne(() => SchoolClass, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  schoolClass?: SchoolClass;

  @Column({ name: 'subject_id', type: 'uuid' })
  @Index()
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject?: Subject;
}
