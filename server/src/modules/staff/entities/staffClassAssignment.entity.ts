import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { Staff } from './staff.entity';

/**
 * "This teacher is attached to this class" — with no subject attached to it.
 *
 * `TeachingAssignment` is deliberately a verified (staff, class, subject)
 * triple, and stays that way: everything that reads it — result entry,
 * schemes of work, CBT question banks — depends on that triple meaning
 * exactly one subject. But recording who teaches where should not have to
 * wait on a school's subject list existing first, and a school onboarding
 * staff commonly does the two in either order, or never finishes the second.
 *
 * So a class an admin picks for a teacher lands here unconditionally, the
 * same day, whether or not any subject was picked alongside it. The staff
 * list's `classIds`/`classNames` are the union of this table and
 * `TeachingAssignment`'s; `teachingAssignments` — the exact subject/class
 * pairs — reads from `TeachingAssignment` alone, unchanged, because a row
 * here names no subject and has none to contribute to that list.
 */
@Entity('staff_class_assignments')
@Index(['classId', 'staffId'], { unique: true })
@Index(['schoolId', 'staffId'])
export class StaffClassAssignment extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ name: 'class_id', type: 'uuid' })
  @Index()
  classId: string;

  @ManyToOne(() => SchoolClass, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  schoolClass?: SchoolClass;

  @Column({ name: 'staff_id', type: 'uuid' })
  @Index()
  staffId: string;

  @ManyToOne(() => Staff, (staff) => staff.classAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staff_id' })
  staff?: Staff;
}
