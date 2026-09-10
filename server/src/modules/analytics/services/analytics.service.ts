import type { RequestContext } from '../../../shared/types/context';
import { AppError } from '../../../shared/errors/AppError';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { SessionRepository } from '../../academics/repositories/session.repository';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { StaffRepository } from '../../staff/repositories/staff.repository';
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
 * Read-only aggregation, and for now mostly an honest nothing. Assessment,
 * attendance, finance and admissions have no tables — the same four gaps the
 * admin dashboard already reports as zero. Each panel is still served rather
 * than left to 404, because a screen that renders "no data yet" tells the truth
 * about an unbuilt module, while a wall of failed requests only looks broken.
 *
 * Every method below returns real rows for the dimensions that do exist
 * (classes, staff, terms, sessions) and zero for the measures that do not, so
 * when a module lands only the measure has to change, not the shape.
 */
export class AnalyticsService {
  static Instance = new AnalyticsService();

  private constructor(
    private readonly schools = SchoolRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly sessions = SessionRepository.Instance,
    private readonly classes = ClassRepository.Instance,
    private readonly staff = StaffRepository.Instance,
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
   * One row per class, so the table lists the school even before a register has
   * ever been taken. `classId` narrows it to a single class for the class-level
   * view; the date window is accepted and ignored until there are marks to
   * window over.
   */
  async fetchAttendanceSummary(
    context: RequestContext,
    filter: { classId?: string },
  ): Promise<ClassAttendanceSummaryDTO[]> {
    const classes = await this.classes.fetchForSchool(context.schoolId, {
      allowedIds: filter.classId ? [filter.classId] : null,
    });

    return classes.map((row) => ({
      classId: row.id,
      // `name` is the full label already ("JSS 1 Gold"); `arm` is the same tail
      // held separately for grouping, so appending it would stutter.
      className: row.name,

      // Attendance module: no register is taken anywhere yet, so no class has a
      // rate and no day has been marked.
      attendanceRate: 0,
      totalDays: 0,
    }));
  }

  /**
   * The same missing marks as the summary above, viewed over time instead of
   * across classes. Empty rather than a flat line at zero: a chart of zeroes
   * claims the school had nobody present, which is a different statement from
   * having taken no register.
   */
  async fetchAttendanceTrend(
    _context: RequestContext,
    _filter: { classId?: string; days: number },
  ): Promise<AttendanceTrendPointDTO[]> {
    return [];
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
   * The active roster with its real form-teacher load. Every compliance measure
   * is zero: each one counts something a teacher did or failed to do in a
   * module that does not exist yet.
   */
  async fetchStaffPerformance(context: RequestContext): Promise<StaffPerformanceDTO[]> {
    const roster = await this.staff.fetchRoster(context.schoolId);

    return roster.map((person) => {
      // Attendance module: registers are not taken, so there is nothing to
      // comply with. Curriculum module: no lesson notes or schemes of work.
      // Assessment module: no score sheets, so no deadline to be timely about.
      const attendanceCompliance = 0;
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

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
