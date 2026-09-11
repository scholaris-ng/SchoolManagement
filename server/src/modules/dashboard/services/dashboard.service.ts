import type { RequestContext } from '../../../shared/types/context';
import { AppError } from '../../../shared/errors/AppError';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { AuditRepository } from '../../audit/repositories/audit.repository';
import { SchoolRepository } from '../../school/repositories/school.repository';
import type { AdminDashboardDTO, StatDeltaDTO, TeacherDashboardDTO } from '../dto/dashboard.dto';

/** How far back the student figure is compared against. */
const DELTA_WINDOW_DAYS = 30;

/** The client slices the activity feed to six; sending more would be wasted rows. */
const ACTIVITY_LIMIT = 6;

/**
 * The administrator's landing screen.
 *
 * Read-only aggregation across modules, computed in SQL rather than by loading
 * rows and counting them in Node — totals for three thousand students must
 * never mean three thousand rows crossing the wire (spec section 43).
 *
 * Half of this payload is currently zero. Attendance, finance, admissions and
 * the calendar have no tables yet, and inventing plausible numbers for them
 * would make an unbuilt module look like a working one. Each is marked below
 * with what will fill it.
 */
export class DashboardService {
  static Instance = new DashboardService();

  private constructor(
    private readonly students = StudentRepository.Instance,
    private readonly staff = StaffRepository.Instance,
    private readonly classes = ClassRepository.Instance,
    private readonly audit = AuditRepository.Instance,
    private readonly schools = SchoolRepository.Instance,
  ) {}

  async fetchAdmin(context: RequestContext): Promise<AdminDashboardDTO> {
    const { schoolId } = context;

    const [school, studentCount, studentsBefore, staffCount, totalClasses, enrolmentByLevel, activity] =
      await Promise.all([
        this.schools.findById(schoolId),
        this.students.countActive(schoolId),
        this.students.countActiveAdmittedBefore(schoolId, DELTA_WINDOW_DAYS),
        this.staff.countActive(schoolId),
        this.classes.countActive(schoolId),
        this.students.countActiveByLevel(schoolId),
        this.audit.recentForSchool(schoolId, ACTIVITY_LIMIT),
      ]);

    if (!school) throw AppError.notFound('School');

    return {
      currency: school.settings?.currency ?? 'NGN',

      studentCount,
      studentDelta: buildDelta(studentCount - studentsBefore),
      staffCount,

      // Attendance module: no register is taken anywhere yet, so nothing has
      // been marked and there is no rate to report.
      attendanceRateToday: 0,
      attendanceMarkedClasses: 0,
      totalClasses,

      // Finance module: no fee, invoice or payment tables exist.
      feesBilled: 0,
      feesCollected: 0,
      feesOutstanding: 0,
      collectionRate: 0,

      // Admissions module: applicants are not modelled yet.
      admissionsInProgress: 0,
      admissionsAccepted: 0,

      // Attendance module again — the trend is the same data over time.
      attendanceTrend: [],
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
   * Every field is sourced from a module with no table yet: timetable entries
   * (so no lesson has a slot), attendance registers, score sheets, lesson
   * notes, assessments, and messaging. Each is answered empty or zero — the
   * same honest-absence choice `fetchAdmin` makes above — rather than
   * fabricating a lesson, a register, or a class this teacher's own
   * assignment cannot back.
   */
  async fetchTeacher(_context: RequestContext): Promise<TeacherDashboardDTO> {
    return {
      // Timetable module: no entry table, so nothing has a slot today.
      todayClasses: [],
      // Attendance module: no register table, so nothing is pending.
      pendingAttendance: [],
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
}

export function buildDelta(value: number): StatDeltaDTO {
  return {
    value,
    direction: value > 0 ? 'up' : value < 0 ? 'down' : 'flat',
    periodLabel: `vs last ${DELTA_WINDOW_DAYS} days`,
  };
}
