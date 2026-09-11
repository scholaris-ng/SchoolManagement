import type { RequestContext } from '../../../shared/types/context';
import { AppError } from '../../../shared/errors/AppError';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { AuditRepository } from '../../audit/repositories/audit.repository';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import type { AdminDashboardDTO, StatDeltaDTO, TeacherDashboardDTO } from '../dto/dashboard.dto';

/** How far back the student figure is compared against. */
const DELTA_WINDOW_DAYS = 30;

/** "Attendance over the last fortnight", as the dashboard card calls it. */
const ATTENDANCE_TREND_DAYS = 14;

/** The client slices the activity feed to six; sending more would be wasted rows. */
const ACTIVITY_LIMIT = 6;

/**
 * The administrator's landing screen.
 *
 * Read-only aggregation across modules, computed in SQL rather than by loading
 * rows and counting them in Node — totals for three thousand students must
 * never mean three thousand rows crossing the wire (spec section 43).
 *
 * Parts of this payload are still zero. Finance, admissions and the calendar
 * have no tables yet, and inventing plausible numbers for them would make an
 * unbuilt module look like a working one. Each is marked below with what will
 * fill it. Attendance is no longer among them: it reads the register the
 * attendance module keeps.
 */
export class DashboardService {
  static Instance = new DashboardService();

  private constructor(
    private readonly students = StudentRepository.Instance,
    private readonly staff = StaffRepository.Instance,
    private readonly classes = ClassRepository.Instance,
    private readonly audit = AuditRepository.Instance,
    private readonly schools = SchoolRepository.Instance,
    private readonly attendance = AttendanceRepository.Instance,
    private readonly terms = TermRepository.Instance,
  ) {}

  async fetchAdmin(context: RequestContext): Promise<AdminDashboardDTO> {
    const { schoolId } = context;

    const [
      school,
      studentCount,
      studentsBefore,
      staffCount,
      totalClasses,
      enrolmentByLevel,
      activity,
      today,
      attendanceTrend,
    ] = await Promise.all([
      this.schools.findById(schoolId),
      this.students.countActive(schoolId),
      this.students.countActiveAdmittedBefore(schoolId, DELTA_WINDOW_DAYS),
      this.staff.countActive(schoolId),
      this.classes.countActive(schoolId),
      this.students.countActiveByLevel(schoolId),
      this.audit.recentForSchool(schoolId, ACTIVITY_LIMIT),
      this.attendance.fetchDailyRate(schoolId, todayIso()),
      this.attendance.fetchTrend(schoolId, {
        days: ATTENDANCE_TREND_DAYS,
        allowedIds: null,
      }),
    ]);

    if (!school) throw AppError.notFound('School');

    return {
      currency: school.settings?.currency ?? 'NGN',

      studentCount,
      studentDelta: buildDelta(studentCount - studentsBefore),
      staffCount,

      // Today's register, across the school. Zero here means nothing has been
      // marked yet this morning, which `attendanceMarkedClasses` against
      // `totalClasses` is what tells the reader.
      attendanceRateToday: today.attendanceRate,
      attendanceMarkedClasses: today.markedClasses,
      totalClasses,

      // Finance module: no fee, invoice or payment tables exist.
      feesBilled: 0,
      feesCollected: 0,
      feesOutstanding: 0,
      collectionRate: 0,

      // Admissions module: applicants are not modelled yet.
      admissionsInProgress: 0,
      admissionsAccepted: 0,

      // The same marks over the fortnight. Days with no register are left out
      // rather than plotted as zero, so a holiday is a gap in the line and not
      // a day the school was empty.
      attendanceTrend: attendanceTrend.map((point) => ({
        label: point.label,
        rate: point.rate,
      })),
      enrolmentByLevel,
      recentActivity: activity.map((row) => ({
        id: row.id,
        actorName: row.actorName,
        action: row.action,
        // The feed reads as a sentence, so an unlabelled entry says so rather
        // than rendering an empty gap.
        entityLabel: row.entityLabel ?? '—',
        occurredAt: row.occurredAt,
      })),
      // Calendar module: no events table.
      upcomingEvents: [],

      // Retention risk is derived from fee arrears and attendance, neither of
      // which exists yet.
      atRiskCount: 0,
    };
  }

  /**
   * A teacher's personal to-do list.
   *
   * The registers they owe today are real. Everything else is sourced from a
   * module with no table yet: timetable entries (so no lesson has a slot),
   * score sheets, lesson notes, assessments, and messaging. Each of those is
   * answered empty or zero — the same honest-absence choice `fetchAdmin` makes
   * above — rather than fabricating a lesson or a class this teacher's own
   * assignment cannot back.
   */
  async fetchTeacher(context: RequestContext): Promise<TeacherDashboardDTO> {
    return {
      // Timetable module: no entry table, so nothing has a slot today.
      todayClasses: [],
      pendingAttendance: await this.pendingRegisters(context),
      // Assessment module: no score sheet table.
      pendingScoreEntry: [],
      // Curriculum module: no lesson note table.
      lessonNotesDue: [],
      // Assessment module again: no assessment table.
      upcomingAssessments: [],
      // Engagement module: no message table.
      unreadMessages: 0,
      // Curriculum module again: no coverage data to report.
      curriculumCoverage: [],
    };
  }

  /**
   * The registers this teacher still owes today.
   *
   * Nothing is owed by somebody with no staff record — a parent looking at this
   * screen is not late with a register — and nothing is owed on a day outside
   * the current term, because the school is not sitting.
   */
  private async pendingRegisters(context: RequestContext) {
    const { staffId } = context.membership;
    if (!staffId) return [];

    const today = todayIso();
    const terms = await this.terms.fetchForSchool(context.schoolId);
    const current = terms.find((term) => term.isCurrent);
    if (!current || today < current.startDate || today > current.endDate) return [];

    return this.attendance.pendingRegistersFor(context.schoolId, staffId, today);
  }
}

/** Matching how the rest of the server reads "today" (`studentRelations.service`). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildDelta(value: number): StatDeltaDTO {
  return {
    value,
    direction: value > 0 ? 'up' : value < 0 ? 'down' : 'flat',
    periodLabel: `vs last ${DELTA_WINDOW_DAYS} days`,
  };
}
