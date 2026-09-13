import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { Term } from '../../academics/entities/term.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { Subject } from '../../academics/entities/subject.entity';
import { Room } from '../../academics/entities/room.entity';
import { TimetablePeriod } from '../../academics/entities/timetablePeriod.entity';
import { Staff } from '../../staff/entities/staff.entity';

/** Mirrors `Weekday` in `client/src/types/curriculum.ts`. */
export const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/**
 * One lesson on the grid (spec section 16): this class, this subject, this
 * teacher, in this room, in this period on this day of the week.
 *
 * There is no separate "timetable" row. A term's timetable is the set of its
 * entries, and the term's id is the timetable's id — a grid exists for every
 * term the moment the school has bell times, empty or not, so a row to say so
 * would only ever restate the term.
 *
 * The three unique indexes are the clash rules, enforced by the database so
 * two people placing lessons at once cannot both win: a class, a teacher and
 * a room can each be in only one place per period. `TimetableService` checks
 * the same three before inserting, purely so the refusal can name what it
 * clashed with.
 */
@Entity('timetable_entries')
@Index('IDX_timetable_entries_class_slot', ['termId', 'classId', 'day', 'periodId'], {
  unique: true,
})
@Index('IDX_timetable_entries_teacher_slot', ['termId', 'teacherId', 'day', 'periodId'], {
  unique: true,
})
@Index('IDX_timetable_entries_room_slot', ['termId', 'roomId', 'day', 'periodId'], {
  unique: true,
  where: '"room_id" IS NOT NULL',
})
export class TimetableEntry extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index('IDX_timetable_entries_school')
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id', foreignKeyConstraintName: 'FK_timetable_entries_school' })
  school?: School;

  @Column({ name: 'term_id', type: 'uuid' })
  @Index('IDX_timetable_entries_term')
  termId: string;

  @ManyToOne(() => Term, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'term_id', foreignKeyConstraintName: 'FK_timetable_entries_term' })
  term?: Term;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => SchoolClass, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id', foreignKeyConstraintName: 'FK_timetable_entries_class' })
  schoolClass?: SchoolClass;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id', foreignKeyConstraintName: 'FK_timetable_entries_subject' })
  subject?: Subject;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => Staff, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id', foreignKeyConstraintName: 'FK_timetable_entries_teacher' })
  teacher?: Staff;

  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId: string | null;

  @ManyToOne(() => Room, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'room_id', foreignKeyConstraintName: 'FK_timetable_entries_room' })
  room?: Room | null;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => TimetablePeriod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'period_id', foreignKeyConstraintName: 'FK_timetable_entries_period' })
  period?: TimetablePeriod;

  @Column({ type: 'varchar', length: 10 })
  day: Weekday;
}
