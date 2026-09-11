import type { RequestContext } from '../../../shared/types/context';
import { AppError } from '../../../shared/errors/AppError';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { SessionRepository } from '../../academics/repositories/session.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import type {
  AdmissionFunnelDTO,
  AttendanceTrendPointDTO,
  ClassAttendanceSummaryDTO,
  FinanceOverviewDTO,
  ResultAnalyticsDTO,
  RetentionRiskDTO,
  StaffPerformanceDTO,
} from '../dto/analytics.dto';

/**
 * The management analytics screen.
 *
 * Read-only aggregation. Attendance is real, and reads the register the
 * attendance module now keeps; assessment, finance and admissions still have no
 * tables and are an honest nothing — the same three gaps the admin dashboard
 * reports as zero. Each panel is still served rather than left to 404, because
 * a screen that renders "no data yet" tells the truth about an unbuilt module,
 * while a wall of failed requests only looks broken.
 *
 * The methods still waiting on a module return real rows for the dimensions
 * that do exist (classes, staff, terms, sessions) and zero for the measures
 * that do not, so when a module lands only the measure has to change, not the
 * shape.
 */
export class AnalyticsService {
  static Instance = new AnalyticsService();

  private constructor(
    private readonly schools = SchoolRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly sessions = SessionRepository.Instance,
    private readonly staff = StaffRepository.Instance,
    private readonly attendance = AttendanceRepository.Instance,
    private readonly scope = AcademicScopeService.Instance,
  ) {}

  /* -- Academic ----------------------------------------------------------- */

  async fetchResultAnalytics(
    context: RequestContext,
    termId?: string,
  ): Promise<ResultAnalyticsDTO> {
    const term = await this.resolveTerm(context.schoolId, termId);

    return {
      termName: term ? `${term.name}, ${term.sessionName}` : 'Current term',

      // Assessment module: no assessment, score or grading-scheme tables exist,
      // so nothing has been marked and there is no average to report. The
      // subject, grade and class breakdowns are all projections of the same
      // missing scores.
      overallAverage: 0,
      passRate: 0,
      subjects: [],
      gradeDistribution: [],
      classComparison: [],
    };
  }

  /* -- Attendance --------------------------------------------------------- */

  /**
   * The rate per class over a window, lowest first — the order the attendance
   * screen's table promises, and the one that puts the classes worth a
   * conversation at the top.
   *
   * Only classes with marks in the window appear. A class whose register has
   * never been taken has no rate, and reporting it at 0% would say every child
   * was absent; the screen draws its own "no attendance recorded yet" instead.
   *
   * Narrowed to the caller's own classes, because `attendance.read` reaches
   * further than the staffroom: a parent holds it for their own child, and a
   * subject teacher for the classes they teach.
   */
  async fetchAttendanceSummary(
    context: RequestContext,
    filter: { classId?: string; from?: string; to?: string },
  ): Promise<ClassAttendanceSummaryDTO[]> {
    const [scope, window] = await Promise.all([
      this.scope.forContext(context),
      this.attendanceWindow(context.schoolId, filter),
    ]);

    return this.attendance.rateByClass(context.schoolId, {
      classId: filter.classId,
      from: window.from,
      to: window.to,
      allowedIds: scope.classIds,
    });
  }

  /**
   * The same marks as a day-by-day line. A day with no register is left out of
   * the series rather than plotted as zero: a chart of zeroes claims the school
   * had nobody present, which is a different statement from having taken no
   * register.
   */
  async fetchAttendanceTrend(
    context: RequestContext,
    filter: { classId?: string; days: number },
  ): Promise<AttendanceTrendPointDTO[]> {
    const scope = await this.scope.forContext(context);

    return this.attendance.fetchTrend(context.schoolId, {
      classId: filter.classId,
      days: filter.days,
      allowedIds: scope.classIds,
    });
  }

  /* -- Finance ------------------------------------------------------------ */

  async fetchFinanceOverview(context: RequestContext): Promise<FinanceOverviewDTO> {
    const school = await this.schools.findById(context.schoolId);
    if (!school) throw AppError.notFound('School');

    return {
      // The currency is real: it is a school setting, not a ledger figure, and
      // the client formats every zero below with it.
      currency: school.settings?.currency ?? 'NGN',

      // Finance module: no fee, invoice or payment tables exist. Billed and
      // collected are both nothing, which makes outstanding nothing too.
      totalBilled: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      totalDiscount: 0,
      collectionRate: 0,
      debtorCount: 0,
      unreconciledCount: 0,
      unreconciledAmount: 0,
      collectionTrend: [],
      byCategory: [],
    };
  }

  /* -- Admissions --------------------------------------------------------- */

  async fetchAdmissionFunnel(
    context: RequestContext,
    sessionId?: string,
  ): Promise<AdmissionFunnelDTO> {
    const session = await this.resolveSession(context.schoolId, sessionId);

    return {
      sessionName: session?.name ?? 'Current session',

      // Admissions module: applicants are not modelled yet, so every stage of
      // the funnel is empty and the conversion between them is undefined —
      // reported as zero rather than as a division by nothing.
      received: 0,
      screened: 0,
      shortlisted: 0,
      offered: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
      conversionRate: 0,
      trend: [],
      byLevel: [],
    };
  }

  /* -- Staff -------------------------------------------------------------- */

  /**
   * The active roster with its real form-teacher load, and how reliably each of
   * them takes the register.
   *
   * Compliance is measured over the current term, against the days the school
   * demonstrably marked *something* — there is no calendar of term dates minus
   * holidays to compare against, so the days it was open are the fairest
   * denominator available. A teacher with no form class has nothing to comply
   * with and scores zero, which is also what the other four measures still
   * report while their modules are unbuilt.
   */
  async fetchStaffPerformance(context: RequestContext): Promise<StaffPerformanceDTO[]> {
    const window = await this.attendanceWindow(context.schoolId, {});
    const [roster, compliance] = await Promise.all([
      this.staff.fetchRoster(context.schoolId),
      this.attendance.complianceByStaff(context.schoolId, window),
    ]);

    const complianceOf = new Map(compliance.map((row) => [row.staffId, row.compliance]));

    return roster.map((person) => {
      // Curriculum module: no lesson notes or schemes of work. Assessment
      // module: no score sheets, so no deadline to be timely about.
      const attendanceCompliance = complianceOf.get(person.staffId) ?? 0;
      const lessonNoteCompliance = 0;
      const scoreEntryTimeliness = 0;
      const curriculumCoverage = 0;
      const averageStudentScore = 0;

      return {
        staffId: person.staffId,
        staffName: person.staffName,
        designation: person.designation,
        classCount: person.classCount,
        attendanceCompliance,
        lessonNoteCompliance,
        scoreEntryTimeliness,
        curriculumCoverage,
        averageStudentScore,

        // The mean of the five measures above, computed rather than hard-coded
        // so it starts reporting the moment any one of them has a source.
        compositeScore: mean([
          attendanceCompliance,
          lessonNoteCompliance,
          scoreEntryTimeliness,
          curriculumCoverage,
          averageStudentScore,
        ]),
      };
    });
  }

  /* -- Retention ---------------------------------------------------------- */

  /**
   * Withdrawal risk is scored from fee arrears, attendance decline and guardian
   * engagement. None of the three has a table, and a model fed by nothing would
   * rank every family identically — which reads as a working model that found
   * no risk. An empty page tells the truth instead.
   */
  async fetchRetentionRisk(
    _context: RequestContext,
    query: { page: number; pageSize: number },
  ): Promise<Paginated<RetentionRiskDTO>> {
    return paginatedResult<RetentionRiskDTO>([], query.page, query.pageSize, 0);
  }

  /* -- Shared lookups ----------------------------------------------------- */

  /**
   * The window an attendance figure covers: what the caller asked for, else the
   * current term up to today.
   *
   * A school with no current term marked falls back to the last thirty days —
   * the alternative is every mark ever taken, which would average this term's
   * attendance with a session that ended two years ago.
   */
  private async attendanceWindow(
    schoolId: string,
    filter: { from?: string; to?: string },
  ): Promise<{ from: string; to: string }> {
    const today = new Date().toISOString().slice(0, 10);
    if (filter.from && filter.to) return { from: filter.from, to: filter.to };

    const terms = await this.terms.fetchForSchool(schoolId);
    const current = terms.find((term) => term.isCurrent);

    return {
      from: filter.from ?? current?.startDate ?? daysBefore(today, 30),
      to: filter.to ?? today,
    };
  }

  /** The term asked for, or the one the school has marked current. */
  private async resolveTerm(schoolId: string, termId?: string) {
    if (termId) {
      const term = await this.terms.findOneDTO(schoolId, termId);
      if (!term) throw AppError.notFound('Term');
      return term;
    }
    const terms = await this.terms.fetchForSchool(schoolId);
    return terms.find((term) => term.isCurrent) ?? null;
  }

  /** The session asked for, or the one the school has marked current. */
  private async resolveSession(schoolId: string, sessionId?: string) {
    if (sessionId) {
      const session = await this.sessions.findOneDTO(schoolId, sessionId);
      if (!session) throw AppError.notFound('Academic session');
      return session;
    }
    const sessions = await this.sessions.fetchForSchool(schoolId);
    return sessions.find((session) => session.isCurrent) ?? null;
  }
}

function daysBefore(date: string, days: number): string {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - days);
  return cursor.toISOString().slice(0, 10);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
