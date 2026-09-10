import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { Staff } from '../../staff/entities/staff.entity';
import { SchoolClass } from './schoolClass.entity';

/**
 * Who is responsible for a class as a whole.
 *
 * A separate relationship from teaching it a subject: the daily register, the
 * report-card comment and the pastoral duties are the form teacher's, not every
 * teacher who passes through the room over the week. Some schools name two.
 */
@Entity('class_form_teachers')
@Index(['classId', 'staffId'], { unique: true })
@Index(['schoolId', 'staffId'])
export class ClassFormTeacher extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @Column({ name: 'class_id', type: 'uuid' })
  @Index()
  classId: string;

  @ManyToOne(() => SchoolClass, (schoolClass) => schoolClass.formTeacherLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'class_id' })
  schoolClass?: SchoolClass;

  @Column({ name: 'staff_id', type: 'uuid' })
  @Index()
  staffId: string;

  @ManyToOne(() => Staff, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staff_id' })
  staff?: Staff;
}
