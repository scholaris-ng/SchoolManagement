import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { TimetableEntry, type Weekday } from '../entities/timetableEntry.entity';
import type { TimetableEntryDTO } from '../dto/timetable.dto';

/**
 * One lesson, with every name the grid prints beside it. The joins tolerate a
 * soft-deleted room or period: a lesson placed in a room that has since been
 * retired still shows its name rather than a blank.
 */
const PROJECTION = `
  e.id,
  e.school_id                                     AS "schoolId",
  e.term_id                                       AS "timetableId",
  e.class_id                                      AS "classId",
  c.name                                          AS "className",
  e.subject_id                                    AS "subjectId",
  sub.name                                        AS "subjectName",
  e.teacher_id                                    AS "teacherId",
  concat_ws(' ', st.first_name, st.last_name)     AS "teacherName",
  e.room_id                                       AS "roomId",
  r.name                                          AS "roomName",
  e.period_id                                     AS "periodId",
  p.name                                          AS "periodName",
  to_char(p.start_time, 'HH24:MI')                AS "startTime",
  to_char(p.end_time, 'HH24:MI')                  AS "endTime",
  e.day
`;

const FROM = `
  FROM timetable_entries e
  JOIN school_classes    c   ON c.id   = e.class_id
  JOIN subjects          sub ON sub.id = e.subject_id
  JOIN staff             st  ON st.id  = e.teacher_id
  JOIN timetable_periods p   ON p.id   = e.period_id
  LEFT JOIN rooms        r   ON r.id   = e.room_id
`;

/** Which lessons a caller may see — see `TimetableService.fetchCurrent`. */
export interface EntryVisibility {
  /** Only lessons of these classes; null means any class. */
  classIds: string[] | null;
  /** Additionally, any lesson this member of staff teaches themselves. */
  ownTeacherId: string | null;
}

export interface EntryFilter {
  classId?: string;
  teacherId?: string;
  subjectId?: string;
  visibility: EntryVisibility;
}

export interface SlotClashRow {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  roomId: string | null;
  roomName: string | null;
  subjectName: string;
}

export class TimetableEntryRepository extends TenantRepository<TimetableEntry> {
  static Instance = new TimetableEntryRepository();

  private constructor() {
    super(TimetableEntry, 'entry');
  }

  async fetchForTerm(
    schoolId: string,
    termId: string,
    filter: EntryFilter,
  ): Promise<TimetableEntryDTO[]> {
    const params: unknown[] = [schoolId, termId];
    const where = ['e.school_id = $1', 'e.term_id = $2'];

    if (filter.classId) {
      params.push(filter.classId);
      where.push(`e.class_id = $${params.length}`);
    }
    if (filter.teacherId) {
      params.push(filter.teacherId);
      where.push(`e.teacher_id = $${params.length}`);
    }
    if (filter.subjectId) {
      params.push(filter.subjectId);
      where.push(`e.subject_id = $${params.length}`);
    }

    const { classIds, ownTeacherId } = filter.visibility;
    if (classIds !== null) {
      const clauses: string[] = [];
      params.push(classIds);
      clauses.push(`e.class_id = ANY($${params.length}::uuid[])`);
      if (ownTeacherId) {
        params.push(ownTeacherId);
        clauses.push(`e.teacher_id = $${params.length}`);
      }
      where.push(`(${clauses.join(' OR ')})`);
    }

    return this.repo.query(
      `SELECT ${PROJECTION} ${FROM}
        WHERE ${where.join(' AND ')}
        ORDER BY p.sequence ASC, e.day ASC, c.name ASC`,
      params,
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<TimetableEntryDTO | null> {
    const rows: TimetableEntryDTO[] = await this.repo.query(
      `SELECT ${PROJECTION} ${FROM} WHERE e.school_id = $1 AND e.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  /**
   * Every lesson already sitting in one slot. The service reads this to name
   * the clash; the unique indexes are what actually prevent it.
   */
  async lessonsInSlot(
    schoolId: string,
    slot: { termId: string; day: Weekday; periodId: string },
  ): Promise<SlotClashRow[]> {
    return this.repo.query(
      `SELECT e.id,
              e.class_id                                  AS "classId",
              c.name                                      AS "className",
              e.teacher_id                                AS "teacherId",
              concat_ws(' ', st.first_name, st.last_name) AS "teacherName",
              e.room_id                                   AS "roomId",
              r.name                                      AS "roomName",
              sub.name                                    AS "subjectName"
         FROM timetable_entries e
         JOIN school_classes c   ON c.id   = e.class_id
         JOIN staff          st  ON st.id  = e.teacher_id
         JOIN subjects       sub ON sub.id = e.subject_id
         LEFT JOIN rooms     r   ON r.id   = e.room_id
        WHERE e.school_id = $1 AND e.term_id = $2 AND e.day = $3 AND e.period_id = $4`,
      [schoolId, slot.termId, slot.day, slot.periodId],
    );
  }

  async place(entry: {
    schoolId: string;
    termId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    roomId: string | null;
    periodId: string;
    day: Weekday;
  }): Promise<TimetableEntry> {
    return this.repo.save(this.repo.create(entry));
  }

  async move(
    schoolId: string,
    id: string,
    patch: {
      classId: string;
      subjectId: string;
      teacherId: string;
      roomId: string | null;
      periodId: string;
      day: Weekday;
    },
  ): Promise<boolean> {
    const result = await this.repo.update({ id, schoolId }, patch);
    return (result.affected ?? 0) > 0;
  }

  async remove(schoolId: string, id: string): Promise<boolean> {
    const result = await this.repo.delete({ id, schoolId });
    return (result.affected ?? 0) > 0;
  }

  async clearTerm(schoolId: string, termId: string): Promise<number> {
    const result = await this.repo.delete({ schoolId, termId });
    return result.affected ?? 0;
  }
}
