import type { RequestContext } from '../../../shared/types/context';
import { AppError } from '../../../shared/errors/AppError';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { AuditRepository } from '../../audit/repositories/audit.repository';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { SessionRepository } from '../../academics/repositories/session.repository';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import { AdmissionRepository } from '../../admissions/repositories/admission.repository';
import { PaymentRepository } from '../../finance/repositories/payment.repository';
import { LedgerRepository } from '../../finance/repositories/ledger.repository';
import { NotificationRepository } from '../../notifications/repositories/notification.repository';
import type {
  AdminDashboardDTO,
  BursarDashboardDTO,
  ParentChildSummaryDTO,
  ParentDashboardDTO,
  StatDeltaDTO,
  TeacherDashboardDTO,
} from '../dto/dashboard.dto';

/** How far back the student figure is compared against. */
const DELTA_WINDOW_DAYS = 30;

/** "Attendance over the last fortnight", as the dashboard card calls it. */
const ATTENDANCE_TREND_DAYS = 14;

/** The client slices the activity feed to six; sending more would be wasted rows. */
const ACTIVITY_LIMIT = 6;

/** What the bursar's two lists show without scrolling. */
const RECENT_PAYMENTS_LIMIT = 8;
const TOP_DEBTORS_LIMIT = 8;

/**
 * The administrator's landing screen.
 *
 * Read-only aggregation across modules, computed in SQL rather than by loading
 * rows and counting them in Node — totals for three thousand students must
 * never mean three thousand rows crossing the wire (spec section 43).
 *
 * Parts of this payload are still zero. Finance and the calendar have no
 * tables yet, and inventing plausible numbers for them would make an unbuilt
 * module look like a working one. Each is marked below with what will fill
 * it. Attendance and admissions are no longer among them: they read the
 * register the attendance module keeps, and the applications the admissions
 * module tracks, respectively.
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
    private readonly sessions = SessionRepository.Instance,
    private readonly admissions = AdmissionRepository.Instance,
    private readonly payments = PaymentRepository.Instance,
    private readonly ledger = LedgerRepository.Instance,
    private readonly notifications = NotificationRepository.Instance,
    private readonly studentAccess = StudentAccessService.Instance,
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
      sessions,
      feesCollected,
      feeTotals,
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
      this.sessions.fetchForSchool(schoolId),
      this.payments.sumCollected(schoolId),
      this.ledger.overviewTotals(schoolId),
    ]);

    if (!school) throw AppError.notFound('School');

    // Net of discounts on both sides — see `AnalyticsService.fetchFinanceOverview`.
    const netBilled = feeTotals.totalBilled - feeTotals.totalDiscount;

    // Scoped to the current session — last year's decided applications should
    // not keep counting toward "open" once this year's admissions cycle has
    // moved on. A school with no session marked current yet (a fresh setup)
    // falls back to every application it has.
    const currentSessionId = sessions.find((session) => session.isCurrent)?.id ?? null;
    const admissionCounts = await this.admissions.countsByStatus(schoolId, currentSessionId);
    const admissionsInProgress =
      admissionCounts.SUBMITTED +
      admissionCounts.SCREENING +
      admissionCounts.SHORTLISTED +
      admissionCounts.OFFERED;

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

      feesBilled: feeTotals.totalBilled,
      feesCollected,
      feesOutstanding: round2(netBilled - feesCollected),
      collectionRate: netBilled > 0 ? Math.round((feesCollected / netBilled) * 1000) / 10 : 0,

      admissionsInProgress,
      admissionsAccepted: admissionCounts.ACCEPTED,

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

      // Retention risk weighs arrears against attendance decline and guardian
      // engagement. Arrears are real now; the other two signals are not, and a
      // risk score built on one of three inputs would rank families by who
      // owes money and call it a model.
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

  /**
   * The bursar's landing screen: what has been billed, what has come in, and
   * who still owes.
   *
   * Whole-ledger rather than current-term. A bursar's first question in the
   * morning is what is outstanding altogether, and a term-scoped total would
   * quietly forgive last term's arrears every time the school turned the page.
   */
  async fetchBursar(context: RequestContext): Promise<BursarDashboardDTO> {
    const { schoolId } = context;

    const [school, totals, collected, recentPayments, unreconciled, topDebtors, collectionTrend] =
      await Promise.all([
        this.schools.findById(schoolId),
        this.ledger.overviewTotals(schoolId),
        this.payments.sumCollected(schoolId),
        this.payments.recentForDashboard(schoolId, RECENT_PAYMENTS_LIMIT),
        this.payments.unreconciledSummary(schoolId),
        this.ledger.topDebtors(schoolId, TOP_DEBTORS_LIMIT),
        this.ledger.monthlyTrend(schoolId),
      ]);

    if (!school) throw AppError.notFound('School');

    const netBilled = totals.totalBilled - totals.totalDiscount;

    return {
      currency: school.settings?.currency ?? 'NGN',
      billed: totals.totalBilled,
      collected,
      outstanding: round2(netBilled - collected),
      collectionRate: netBilled > 0 ? Math.round((collected / netBilled) * 1000) / 10 : 0,
      recentPayments,
      unreconciled,
      topDebtors,
      collectionTrend,
    };
  }

  /**
   * A guardian's landing screen: their children, one row each.
   *
   * Identity, attendance and outstanding balance are real, read the same way
   * `fetchAdmin` and `fetchBursar` do. Results, messaging and the calendar
   * have no table yet and are answered null, zero or empty rather than
   * fabricated — see `ParentDashboardDTO`.
   */
  async fetchParent(context: RequestContext): Promise<ParentDashboardDTO> {
    const { schoolId } = context;

    const [school, visibleIds] = await Promise.all([
      this.schools.findById(schoolId),
      this.studentAccess.visibleStudentIds(context),
    ]);
    if (!school) throw AppError.notFound('School');

    const currency = school.settings?.currency ?? 'NGN';
    const childIds = visibleIds ?? [];

    if (childIds.length === 0) {
      return {
        currency,
        children: [],
        recentPayments: [],
        // Calendar module: no events table.
        upcomingEvents: [],
        unreadNotifications: await this.notifications.countUnread(schoolId, context.user.id),
      };
    }

    // "This term" needs a current term to bound it. A school with none set
    // yet (a fresh setup) has nothing to measure a rate against, not a rate
    // of zero — zero would read as a child who has missed every day.
    const terms = await this.terms.fetchForSchool(schoolId);
    const currentTerm = terms.find((term) => term.isCurrent);

    const [summaries, attendanceRates, ledgerSummaries, recentPayments, unreadNotifications] =
      await Promise.all([
        this.students.parentSummariesFor(schoolId, childIds),
        currentTerm
          ? Promise.all(
              childIds.map((id) =>
                this.attendance.rateForStudent(schoolId, id, {
                  from: currentTerm.startDate,
                  to: currentTerm.endDate,
                }),
              ),
            )
          : Promise.resolve(childIds.map(() => 0)),
        Promise.all(childIds.map((id) => this.ledger.summaryFor(schoolId, id))),
        this.payments.recentForStudents(schoolId, childIds, RECENT_PAYMENTS_LIMIT),
        this.notifications.countUnread(schoolId, context.user.id),
      ]);

    const attendanceByStudent = new Map(childIds.map((id, index) => [id, attendanceRates[index]]));
    const balanceByStudent = new Map(
      childIds.map((id, index) => [id, ledgerSummaries[index]?.balance ?? 0]),
    );

    const children: ParentChildSummaryDTO[] = summaries.map((summary) => ({
      studentId: summary.studentId,
      fullName: summary.fullName,
      admissionNo: summary.admissionNo,
      photoUrl: summary.photoUrl,
      className: summary.className,
      attendanceRate: attendanceByStudent.get(summary.studentId) ?? 0,
      // Assessment module: no score sheet or result table.
      lastTermAverage: null,
      currentTermAverage: null,
      position: null,
      classSize: null,
      outstandingBalance: balanceByStudent.get(summary.studentId) ?? 0,
      // Engagement module: no message table.
      unreadMessages: 0,
      housePoints: summary.housePoints,
      // Assessment module again: nothing has been published to be flagged here.
      resultPublished: false,
    }));

    return {
      currency,
      children,
      recentPayments,
      // Calendar module: no events table.
      upcomingEvents: [],
      unreadNotifications,
    };
  }
}

/** Money that has been through subtraction, back to two places. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
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
