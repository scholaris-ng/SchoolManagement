import type { EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { AttendanceRecord } from '../entities/attendanceRecord.entity';
import type {
  AttendanceRecordDTO,
  AttendanceTrendRow,
  ClassAttendanceRateRow,
  DailyAttendanceRow,
  PendingRegisterRow,
  StaffAttendanceComplianceRow,
} from '../dto/attendance.dto';

/**
 * What counts as having turned up. A child who arrived late was still taught,
 * so every rate in the app treats `LATE` as present — the same arithmetic the
 * register screen does client-side while a teacher is marking.
 */
const PRESENT_STATUSES = `('PRESENT', 'LATE')`;

/** One mark for each pupil the register is about, marked or not. */
const REGISTER_PROJECTION = `
  -- Empty rather than invented: an unmarked pupil has no row to have an id.
  COALESCE(a.id::text, '')                                            AS "id",
  s.school_id                                                         AS "schoolId",
  s.id                                                                AS "studentId",
  concat_ws(' ', s.first_name, NULLIF(s.middle_name, ''), s.last_name) AS "studentName",
  s.admission_no                                                      AS "admissionNo",
  -- The register type carries no consent flag for the screen to respect, so a
  -- photograph nobody consented to is not sent at all (spec section 41).
  CASE WHEN s.photo_consent THEN s.photo_url END                      AS "photoUrl",
  -- Everyone starts present and the teacher marks the exceptions. The marked-at
  -- column stays null, which is how the screen tells a default from a decision.
  COALESCE(a.status, 'PRESENT')                                       AS "status",
  a.reason,
  a.note,
  a.marked_by_name                                                    AS "markedByName",
  a.marked_at                                                         AS "markedAt",
  a.guardian_notified_at                                              AS "guardianNotifiedAt"
`;

export interface RegisterMeta {
  takenByName: string | null;
  takenAt: string | null;
}

export interface MarkInput {
  studentId: string;
  status: string;
  reason: string | null;
  note: string | null;
}

export interface SavedMarkRow {
  id: string;
  studentId: string;
  status: string;
  guardianNotifiedAt: Date | null;
}

export interface GuardianRecipientRow {
  studentId: string;
  studentName: string;
  userId: string;
}

export class AttendanceRepository extends TenantRepository<AttendanceRecord> {
  static Instance = new AttendanceRepository();

  private constructor() {
    super(AttendanceRecord, 'attendance');
  }

  /* -- The register ---------------------------------------------------------- */

  /**
   * The class as it stands, with whatever has been marked for the day.
   *
   * A pupil who has since moved class still appears on a register they were
   * marked on — `OR a.id IS NOT NULL` — because a past register is a record of
   * who was in the room that day, and dropping them would quietly rewrite it.
   *
   * One query for the whole class, roster and marks together: forty pupils must
   * not mean forty-one round trips (spec section 43).
   */
  async fetchRegister(
    schoolId: string,
    classId: string,
    date: string,
  ): Promise<AttendanceRecordDTO[]> {
    const rows: Omit<AttendanceRecordDTO, 'classId' | 'date'>[] = await this.repo.query(
      `SELECT ${REGISTER_PROJECTION}
         FROM students s
         LEFT JOIN attendance_records a
                ON a.student_id = s.id
               AND a.school_id  = s.school_id
               AND a.class_id   = $2
               AND a.date       = $3::date
        WHERE s.school_id = $1
          AND s.deleted_at IS NULL
          AND ((s.current_class_id = $2 AND s.status = 'ACTIVE') OR a.id IS NOT NULL)
        ORDER BY s.last_name ASC, s.first_name ASC`,
      [schoolId, classId, date],
    );

    // The class and day are the register's, not each row's: every mark joined
    // above was taken for this class on this date, and an unmarked pupil is
    // being offered for marking on it.
    return rows.map((row) => ({ ...row, classId, date }));
  }

  /** Who last touched this register, and when. Null when nobody has. */
  async fetchRegisterMeta(
    schoolId: string,
    classId: string,
    date: string,
  ): Promise<RegisterMeta | null> {
    const rows: RegisterMeta[] = await this.repo.query(
      `SELECT a.marked_by_name AS "takenByName", a.marked_at AS "takenAt"
         FROM attendance_records a
        WHERE a.school_id = $1 AND a.class_id = $2 AND a.date = $3::date
        ORDER BY a.marked_at DESC
        LIMIT 1`,
      [schoolId, classId, date],
    );
    return rows[0] ?? null;
  }

  /** Student ids actually on the class list, so a mark cannot name an outsider. */
  async rosterStudentIds(schoolId: string, classId: string, date: string): Promise<string[]> {
    const rows: { id: string }[] = await this.repo.query(
      `SELECT s.id
         FROM students s
         LEFT JOIN attendance_records a
                ON a.student_id = s.id
               AND a.school_id  = s.school_id
               AND a.class_id   = $2
               AND a.date       = $3::date
        WHERE s.school_id = $1
          AND s.deleted_at IS NULL
          AND ((s.current_class_id = $2 AND s.status = 'ACTIVE') OR a.id IS NOT NULL)`,
      [schoolId, classId, date],
    );
    return rows.map((row) => row.id);
  }

  /**
   * Writes the whole register in one statement.
   *
   * `ON CONFLICT` makes re-marking a correction rather than a duplicate, and
   * `guardian_notified_at` is pointedly absent from the update list: a
   * correction at four o'clock must not message a parent who was already told
   * at nine.
   *
   * The marks travel as one jsonb parameter so a class of any size is a single
   * round trip, and the rows come back so the caller knows which absences are
   * newly recorded without reading them again.
   */
  async saveMarks(
    schoolId: string,
    input: {
      classId: string;
      termId: string;
      date: string;
      marks: MarkInput[];
      markedByUserId: string;
      markedByName: string;
    },
    manager?: EntityManager,
  ): Promise<SavedMarkRow[]> {
    if (input.marks.length === 0) return [];

    return (manager ?? this.repo.manager).query(
      `INSERT INTO attendance_records (
         school_id, student_id, class_id, term_id, date,
         status, reason, note, marked_by_user_id, marked_by_name, marked_at
       )
       SELECT $1, m.student_id::uuid, $2::uuid, $3::uuid, $4::date,
              m.status, m.reason, NULLIF(m.note, ''), $5::uuid, $6, now()
         FROM jsonb_to_recordset($7::jsonb)
           AS m(student_id text, status text, reason text, note text)
       ON CONFLICT ("student_id", "date") DO UPDATE
          SET class_id          = EXCLUDED.class_id,
              term_id           = EXCLUDED.term_id,
              status            = EXCLUDED.status,
              reason            = EXCLUDED.reason,
              note              = EXCLUDED.note,
              marked_by_user_id = EXCLUDED.marked_by_user_id,
              marked_by_name    = EXCLUDED.marked_by_name,
              marked_at         = EXCLUDED.marked_at,
              updated_at        = now()
       RETURNING id,
                 student_id           AS "studentId",
                 status,
                 guardian_notified_at AS "guardianNotifiedAt"`,
      [
        schoolId,
        input.classId,
        input.termId,
        input.date,
        input.markedByUserId,
        input.markedByName,
        JSON.stringify(
          input.marks.map((mark) => ({
            student_id: mark.studentId,
            status: mark.status,
            reason: mark.reason,
            note: mark.note,
          })),
        ),
      ],
    );
  }

  /* -- The absence alert ----------------------------------------------------- */

  /**
   * Guardians who can actually be reached in the app, for the children named.
   *
   * A guardian with no account, or whose portal access has been withdrawn, has
   * no inbox to write to and is left out rather than counted as notified.
   */
  async guardianRecipientsFor(
    schoolId: string,
    studentIds: string[],
  ): Promise<GuardianRecipientRow[]> {
    if (studentIds.length === 0) return [];

    return this.repo.query(
      `SELECT sg.student_id AS "studentId",
              concat_ws(' ', s.first_name, s.last_name) AS "studentName",
              g.user_id AS "userId"
         FROM student_guardians sg
         JOIN guardians g ON g.id = sg.guardian_id AND g.deleted_at IS NULL
         JOIN students  s ON s.id = sg.student_id  AND s.deleted_at IS NULL
        WHERE sg.school_id = $1
          AND sg.student_id = ANY($2::uuid[])
          AND g.user_id IS NOT NULL
          AND g.has_portal_access = TRUE
        ORDER BY sg.is_primary_contact DESC`,
      [schoolId, studentIds],
    );
  }

  /** Stamps the marks whose guardians have now been told. */
  async markGuardiansNotified(schoolId: string, recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) return;

    await this.repo.query(
      `UPDATE attendance_records
          SET guardian_notified_at = now(), updated_at = now()
        WHERE school_id = $1
          AND id = ANY($2::uuid[])
          AND guardian_notified_at IS NULL`,
      [schoolId, recordIds],
    );
  }

  /* -- Aggregates ------------------------------------------------------------ */

  /**
   * The rate per class over a window, lowest first — the order the attendance
   * screen's table claims and the one that puts the classes worth a
   * conversation at the top.
   *
   * Only classes with marks in the window are returned. A class whose register
   * has never been taken has no rate, and reporting it as 0% would say every
   * child was absent (the same reason `fetchTrend` returns nothing rather than a
   * flat line at zero).
   */
  async rateByClass(
    schoolId: string,
    filter: { classId?: string; from: string; to: string; allowedIds: string[] | null },
  ): Promise<ClassAttendanceRateRow[]> {
    if (filter.allowedIds && filter.allowedIds.length === 0) return [];

    const params: unknown[] = [schoolId, filter.from, filter.to];
    const clauses: string[] = [];

    if (filter.classId) {
      params.push(filter.classId);
      clauses.push(`a.class_id = $${params.length}`);
    }
    if (filter.allowedIds) {
      params.push(filter.allowedIds);
      clauses.push(`a.class_id = ANY($${params.length}::uuid[])`);
    }

    const where = clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : '';

    return this.repo.query(
      `SELECT c.id   AS "classId",
              c.name AS "className",
              ROUND(
                100.0 * COUNT(*) FILTER (WHERE a.status IN ${PRESENT_STATUSES}) / COUNT(*)
              )::int AS "attendanceRate",
              COUNT(DISTINCT a.date)::int AS "totalDays"
         FROM attendance_records a
         JOIN school_classes c ON c.id = a.class_id AND c.deleted_at IS NULL
        WHERE a.school_id = $1
          AND a.date BETWEEN $2::date AND $3::date
          ${where}
        GROUP BY c.id, c.name
        ORDER BY "attendanceRate" ASC, c.name ASC`,
      params,
    );
  }

  /**
   * The same marks as a day-by-day line. Days with no register are simply
   * absent from the series rather than plotted as zero.
   */
  async fetchTrend(
    schoolId: string,
    filter: { classId?: string; days: number; allowedIds: string[] | null },
  ): Promise<AttendanceTrendRow[]> {
    if (filter.allowedIds && filter.allowedIds.length === 0) return [];

    const params: unknown[] = [schoolId, filter.days];
    const clauses: string[] = [];

    if (filter.classId) {
      params.push(filter.classId);
      clauses.push(`a.class_id = $${params.length}`);
    }
    if (filter.allowedIds) {
      params.push(filter.allowedIds);
      clauses.push(`a.class_id = ANY($${params.length}::uuid[])`);
    }

    const where = clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : '';

    return this.repo.query(
      `SELECT to_char(a.date, 'YYYY-MM-DD') AS "date",
              to_char(a.date, 'DD Mon')     AS "label",
              ROUND(
                100.0 * COUNT(*) FILTER (WHERE a.status IN ${PRESENT_STATUSES}) / COUNT(*)
              )::int AS "rate",
              (COUNT(*) FILTER (WHERE a.status IN ${PRESENT_STATUSES}))::int     AS "present",
              (COUNT(*) FILTER (WHERE a.status NOT IN ${PRESENT_STATUSES}))::int AS "absent"
         FROM attendance_records a
        WHERE a.school_id = $1
          AND a.date > CURRENT_DATE - ($2::int * INTERVAL '1 day')
          ${where}
        GROUP BY a.date
        ORDER BY a.date ASC`,
      params,
    );
  }

  /** Today, across the school: the admin dashboard's headline pair. */
  async fetchDailyRate(schoolId: string, date: string): Promise<DailyAttendanceRow> {
    const [row] = await this.repo.query(
      `SELECT COALESCE(
                ROUND(
                  100.0 * COUNT(*) FILTER (WHERE status IN ${PRESENT_STATUSES})
                  / NULLIF(COUNT(*), 0)
                ),
                0
              )::int AS "attendanceRate",
              COUNT(DISTINCT class_id)::int AS "markedClasses"
         FROM attendance_records
        WHERE school_id = $1 AND date = $2::date`,
      [schoolId, date],
    );
    return {
      attendanceRate: Number(row?.attendanceRate ?? 0),
      markedClasses: Number(row?.markedClasses ?? 0),
    };
  }

  /**
   * The registers this teacher owes for the day.
   *
   * Form classes only — taking the register is the form teacher's job — and
   * only classes with somebody in them, because an empty class has no register
   * to take.
   */
  async pendingRegistersFor(
    schoolId: string,
    staffId: string,
    date: string,
  ): Promise<PendingRegisterRow[]> {
    return this.repo.query(
      `SELECT c.id                          AS "classId",
              c.name                        AS "className",
              to_char($3::date, 'YYYY-MM-DD') AS "date"
         FROM class_form_teachers cft
         JOIN school_classes c
           ON c.id = cft.class_id AND c.deleted_at IS NULL AND c.is_active = TRUE
        WHERE cft.school_id = $1
          AND cft.staff_id = $2
          AND NOT EXISTS (
            SELECT 1 FROM attendance_records a
             WHERE a.class_id = c.id AND a.date = $3::date
          )
          AND EXISTS (
            SELECT 1 FROM students s
             WHERE s.current_class_id = c.id
               AND s.status = 'ACTIVE'
               AND s.deleted_at IS NULL
          )
        ORDER BY c.name ASC`,
      [schoolId, staffId, date],
    );
  }

  /**
   * How reliably each form teacher takes their registers.
   *
   * A school day is one the school marked *somewhere* — there is no calendar of
   * term dates minus holidays to compare against, so the days the school was
   * demonstrably open are the fairest denominator available. A teacher's score
   * is the share of those days their form classes were marked on.
   */
  async complianceByStaff(
    schoolId: string,
    window: { from: string; to: string },
  ): Promise<StaffAttendanceComplianceRow[]> {
    return this.repo.query(
      `WITH marked AS (
         SELECT DISTINCT class_id, date
           FROM attendance_records
          WHERE school_id = $1 AND date BETWEEN $2::date AND $3::date
       ),
       school_days AS (SELECT DISTINCT date FROM marked),
       expected AS (
         SELECT cft.staff_id, COUNT(*)::int AS total
           FROM class_form_teachers cft
           JOIN school_classes c ON c.id = cft.class_id AND c.deleted_at IS NULL
          CROSS JOIN school_days
          WHERE cft.school_id = $1
          GROUP BY cft.staff_id
       ),
       taken AS (
         SELECT cft.staff_id, COUNT(*)::int AS total
           FROM class_form_teachers cft
           JOIN marked m ON m.class_id = cft.class_id
          WHERE cft.school_id = $1
          GROUP BY cft.staff_id
       )
       SELECT e.staff_id AS "staffId",
              ROUND(100.0 * COALESCE(t.total, 0) / NULLIF(e.total, 0))::int AS compliance
         FROM expected e
         LEFT JOIN taken t ON t.staff_id = e.staff_id`,
      [schoolId, window.from, window.to],
    );
  }
}
