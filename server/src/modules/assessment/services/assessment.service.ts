import { randomBytes } from 'node:crypto';
import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { paginatedResult } from '../../../shared/pagination/paginate';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { env } from '../../../config/env';
import { AuditService } from '../../audit/services/audit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AcademicScopeService, scopeAllows } from '../../academics/services/academicScope.service';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { BehaviourService } from '../../behaviour/services/behaviour.service';
import { AssessmentRepository, type EntryRow, type RosterRow, type SheetRow } from '../repositories/assessment.repository';
import { average, rank, summarise } from './grading';
import type { ResultStatus } from '../entities/scoreSheet.entity';
import type {
  BroadsheetDTO,
  CommentTemplateDTO,
  GradingSchemeDTO,
  ReportCardDTO,
  ScoreSheetDTO,
  ScoreSheetSummaryDTO,
  StudentSubjectScoreDTO,
  SubjectResultLineDTO,
  TranscriptDTO,
  VerificationResultDTO,
} from '../dto/assessment.dto';
import type {
  CreateCommentTemplateInput,
  CreateGradingSchemeInput,
  FetchScoreSheetsQuery,
  SaveReportCardCommentsInput,
  SaveScoresInput,
  TransitionScoreSheetInput,
  UpdateGradingSchemeInput,
} from '../validators/assessment.schema';
import type { TermDTO } from '../../academics/dto/academics.dto';

/** Sheets whose marks count as a result: approved for staff, published for everyone. */
const STAFF_VISIBLE: ResultStatus[] = ['APPROVED', 'PUBLISHED'];
const PUBLIC_VISIBLE: ResultStatus[] = ['PUBLISHED'];

/** The scheme a school starts with. Everything about it is editable. */
const DEFAULT_SCHEME = {
  name: 'Standard scheme',
  description: 'Continuous assessment 40, examination 60.',
  passMark: 40,
  components: [
    { name: 'First CA', code: 'CA1', maxScore: 20, sequence: 1, type: 'CONTINUOUS_ASSESSMENT' as const },
    { name: 'Second CA', code: 'CA2', maxScore: 20, sequence: 2, type: 'CONTINUOUS_ASSESSMENT' as const },
    { name: 'Examination', code: 'EXAM', maxScore: 60, sequence: 3, type: 'EXAM' as const },
  ],
  bands: [
    { label: 'A', minScore: 70, maxScore: 100, remark: 'Excellent', gradePoint: '5.00', isPass: true, color: '#16a34a' },
    { label: 'B', minScore: 60, maxScore: 69, remark: 'Very good', gradePoint: '4.00', isPass: true, color: '#22c55e' },
    { label: 'C', minScore: 50, maxScore: 59, remark: 'Good', gradePoint: '3.00', isPass: true, color: '#84cc16' },
    { label: 'D', minScore: 45, maxScore: 49, remark: 'Pass', gradePoint: '2.00', isPass: true, color: '#eab308' },
    { label: 'E', minScore: 40, maxScore: 44, remark: 'Fair', gradePoint: '1.00', isPass: true, color: '#f97316' },
    { label: 'F', minScore: 0, maxScore: 39, remark: 'Fail', gradePoint: '0.00', isPass: false, color: '#dc2626' },
  ],
};

/** The step each transition takes, and the permission that takes it. */
const TRANSITIONS: Record<ResultStatus, { from: ResultStatus; permission: string } | null> = {
  DRAFT: null,
  SUBMITTED: { from: 'DRAFT', permission: 'result.enter' },
  APPROVED: { from: 'SUBMITTED', permission: 'result.approve' },
  PUBLISHED: { from: 'APPROVED', permission: 'result.publish' },
};

/**
 * Results (spec sections 19–22): the score sheets teachers fill in, and
 * everything assembled from them — report cards, broadsheets, transcripts.
 *
 * Nothing about a result is stored twice. A sheet holds marks; a report card
 * holds only its comments and verification code; totals, grades, positions
 * and averages are computed from the marks every time they are read, by the
 * one set of functions in `grading.ts`. A published mark can therefore never
 * disagree with the card, sheet, broadsheet or transcript it appears on.
 *
 * Visibility follows teaching for staff and the family for parents: a teacher
 * sees the sheets for pairs they are assigned, and a parent sees a card only
 * once every sheet behind it is published.
 */
export class AssessmentService {
  static Instance = new AssessmentService();

  private constructor(
    private readonly assessment = AssessmentRepository.Instance,
    private readonly students = StudentRepository.Instance,
    private readonly schools = SchoolRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly attendance = AttendanceRepository.Instance,
    private readonly access = StudentAccessService.Instance,
    private readonly scope = AcademicScopeService.Instance,
    private readonly behaviour = BehaviourService.Instance,
    private readonly notifications = NotificationsService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /* -- Grading schemes ------------------------------------------------------- */

  async fetchGradingSchemes(context: RequestContext): Promise<GradingSchemeDTO[]> {
    const existing = await this.assessment.schemesForSchool(context.schoolId);
    if (existing.length > 0) return existing;

    await AppDataSource.transaction((manager) =>
      this.assessment.createScheme(
        {
          schoolId: context.schoolId,
          name: DEFAULT_SCHEME.name,
          description: DEFAULT_SCHEME.description,
          isDefault: true,
          passMark: DEFAULT_SCHEME.passMark,
          levelIds: [],
          showPosition: true,
        },
        DEFAULT_SCHEME.components,
        DEFAULT_SCHEME.bands,
        manager,
      ),
    );
    return this.assessment.schemesForSchool(context.schoolId);
  }

  async createGradingScheme(context: RequestContext, input: CreateGradingSchemeInput): Promise<GradingSchemeDTO> {
    const { schoolId } = context;
    const saved = await AppDataSource.transaction(async (manager) => {
      const scheme = await this.assessment.createScheme(
        {
          schoolId,
          name: input.name,
          description: input.description ?? null,
          isDefault: input.isDefault ?? false,
          passMark: input.passMark ?? 40,
          levelIds: input.levelIds ?? [],
          showPosition: input.showPosition ?? true,
        },
        input.components.map((component) => pickComponent(component)),
        input.bands.map((band) => pickBand(band)),
        manager,
      );
      if (input.isDefault) await this.assessment.clearDefault(schoolId, scheme.id, manager);
      return scheme;
    });

    const dto = await this.assessment.findSchemeDTO(schoolId, saved.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  /**
   * Components are matched by id so marks already entered survive a rename;
   * a component with marks against it cannot be removed. Bands carry no marks
   * and are simply replaced.
   */
  async updateGradingScheme(context: RequestContext, id: string, input: UpdateGradingSchemeInput): Promise<GradingSchemeDTO> {
    const { schoolId } = context;
    const existing = await this.assessment.findSchemeDTO(schoolId, id);
    if (!existing) throw AppError.notFound('Grading scheme');

    await AppDataSource.transaction(async (manager) => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;
      if (input.isDefault !== undefined) patch.isDefault = input.isDefault;
      if (input.passMark !== undefined) patch.passMark = input.passMark;
      if (input.levelIds !== undefined) patch.levelIds = input.levelIds;
      if (input.showPosition !== undefined) patch.showPosition = input.showPosition;
      if (Object.keys(patch).length > 0) await this.assessment.updateScheme(schoolId, id, patch, manager);
      if (input.isDefault) await this.assessment.clearDefault(schoolId, id, manager);

      if (input.components) {
        const keeping = new Set(input.components.map((component) => component.id).filter(Boolean));
        const marked = await this.assessment.componentsWithMarks(id, manager);
        const removed = marked.filter((componentId) => !keeping.has(componentId));
        if (removed.length > 0) {
          const names = existing.components.filter((c) => removed.includes(c.id)).map((c) => c.name);
          throw AppError.conflict(`${names.join(', ')} already has marks entered against it and cannot be removed.`);
        }
        await this.assessment.replaceComponents(
          schoolId,
          id,
          input.components.map((component) => ({ ...pickComponent(component), id: component.id })),
          manager,
        );
      }
      if (input.bands) {
        await this.assessment.replaceBands(schoolId, id, input.bands.map((band) => pickBand(band)), manager);
      }
    });

    const dto = await this.assessment.findSchemeDTO(schoolId, id);
    if (!dto) throw AppError.notFound('Grading scheme');
    return dto;
  }

  /* -- Score sheets ---------------------------------------------------------- */

  /**
   * The term's sheets, made on first sight from the teaching assignments and
   * narrowed to the pairs the caller teaches. A sheet is never typed into
   * being; it exists because somebody is assigned to teach that subject to
   * that class this term.
   */
  async fetchScoreSheets(context: RequestContext, query: FetchScoreSheetsQuery): Promise<Paginated<ScoreSheetSummaryDTO>> {
    const { schoolId } = context;
    const term = await this.resolveTerm(schoolId, query.termId);
    if (!term) return paginatedResult<ScoreSheetSummaryDTO>([], query.page, query.pageSize, 0);

    const [scope, schemes, pairs] = await Promise.all([
      this.scope.forContext(context),
      this.fetchGradingSchemes(context),
      this.assessment.teachingPairs(schoolId),
    ]);
    const wanted = scope.pairs
      ? pairs.filter((pair) => scopeAllows(scope, { classId: pair.classId, subjectId: pair.subjectId }))
      : pairs;
    await this.assessment.ensureSheets(
      schoolId,
      term.id,
      wanted.map((pair) => ({ ...pair, gradingSchemeId: schemeFor(schemes, pair.levelId).id })),
    );

    const page = await this.assessment.fetchSheets(schoolId, {
      ...query,
      termId: term.id,
      pairs: scope.pairs,
    });
    const schemeById = new Map(schemes.map((scheme) => [scheme.id, scheme]));

    return {
      ...page,
      items: page.items.map((row) => ({
        ...toSheetHeader(row),
        components: schemeById.get(row.gradingSchemeId)?.components ?? [],
        rows: [],
        classAverage: null,
        highest: null,
        lowest: null,
        enteredCount: row.enteredCount,
        totalCount: row.totalCount,
      })),
    };
  }

  async fetchScoreSheet(context: RequestContext, id: string): Promise<ScoreSheetDTO> {
    const sheet = await this.resolveSheet(context, id);
    return this.buildSheet(context.schoolId, sheet);
  }

  /**
   * Marks are entered against a draft, or corrected on a later sheet by
   * whoever holds `result.amend`. Every mark must sit on one of the scheme's
   * components, within that component's maximum, for a pupil on the sheet.
   */
  async saveScores(context: RequestContext, id: string, input: SaveScoresInput, expectedVersion: number | undefined): Promise<ScoreSheetDTO> {
    const { schoolId } = context;
    const sheet = await this.resolveSheet(context, id);
    if (sheet.status !== 'DRAFT' && !context.can('result.amend')) {
      throw AppError.conflict(`This sheet has been ${sheet.status.toLowerCase()}; amending it takes the result.amend permission.`);
    }

    const [scheme, roster] = await Promise.all([
      this.assessment.findSchemeDTO(schoolId, sheet.gradingSchemeId),
      this.assessment.rosterForSheet(schoolId, sheet.id, sheet.classId),
    ]);
    if (!scheme) throw AppError.internal();
    const componentById = new Map(scheme.components.map((component) => [component.id, component]));
    const onSheet = new Set(roster.map((row) => row.studentId));

    for (const entry of input.entries) {
      const component = componentById.get(entry.componentId);
      if (!component) throw AppError.validation('One of those marks is for a component this sheet does not have.');
      if (!onSheet.has(entry.studentId)) throw AppError.validation('One of those marks is for a pupil who is not on this sheet.');
      if (entry.score !== null && entry.score > component.maxScore) {
        throw AppError.validation(`${component.name} is marked out of ${component.maxScore}.`);
      }
    }

    const applied = await AppDataSource.transaction((manager) =>
      this.assessment.saveScoresIfVersionMatches(schoolId, id, expectedVersion ?? sheet.version, input.entries, manager),
    );
    if (!applied) throw AppError.versionConflict();

    const fresh = await this.assessment.findSheet(schoolId, id);
    if (!fresh) throw AppError.notFound('Score sheet');
    return this.buildSheet(schoolId, fresh);
  }

  /**
   * DRAFT → SUBMITTED → APPROVED → PUBLISHED, one step at a time, each gated
   * by its own permission. Publishing is the moment a family can see the
   * marks, so it tells every guardian in the class.
   */
  async transitionScoreSheet(context: RequestContext, id: string, input: TransitionScoreSheetInput): Promise<ScoreSheetDTO> {
    const { schoolId } = context;
    const sheet = await this.resolveSheet(context, id);
    const step = TRANSITIONS[input.to];
    if (!step) throw AppError.validation('A sheet cannot be moved back to draft.');
    if (!context.can(step.permission as never)) {
      throw AppError.forbidden(`Moving a sheet to ${input.to.toLowerCase()} takes the ${step.permission} permission.`);
    }
    if (sheet.status !== step.from) {
      throw AppError.conflict(`A sheet must be ${step.from.toLowerCase()} before it is ${input.to.toLowerCase()}.`);
    }

    const stamp = new Date();
    const patch: Record<string, unknown> = { status: input.to };
    if (input.to === 'SUBMITTED') Object.assign(patch, { submittedByName: context.user.displayName, submittedAt: stamp });
    if (input.to === 'APPROVED') Object.assign(patch, { approvedByName: context.user.displayName, approvedAt: stamp });
    if (input.to === 'PUBLISHED') patch.publishedAt = stamp;
    await this.assessment.transitionSheet(schoolId, id, patch);

    await this.audit.record(context, {
      action: `result.${input.to.toLowerCase()}`,
      entityType: 'ScoreSheet',
      entityId: id,
      entityLabel: `${sheet.subjectName} · ${sheet.className} · ${sheet.termName}`,
      before: { status: sheet.status },
      after: { status: input.to, note: input.note ?? null },
    });

    if (input.to === 'PUBLISHED') await this.announcePublished(context, sheet);

    const fresh = await this.assessment.findSheet(schoolId, id);
    if (!fresh) throw AppError.notFound('Score sheet');
    return this.buildSheet(schoolId, fresh);
  }

  /* -- Report cards ---------------------------------------------------------- */

  /**
   * Assembled on read from the pupil's marks that term. A family sees it
   * only once every subject is published; staff see whatever has been
   * approved so far, with the card's own status saying how far along it is.
   */
  async fetchReportCard(context: RequestContext, studentId: string, termId: string | undefined): Promise<ReportCardDTO> {
    const { schoolId } = context;
    if (!(await this.access.canSeeStudent(context, studentId))) throw AppError.notFound('Student');
    const term = await this.resolveTerm(schoolId, termId);
    if (!term) throw AppError.notFound('Term');
    const student = await this.students.findOneDTO(schoolId, studentId);
    if (!student) throw AppError.notFound('Student');

    const isFamily = Boolean(context.membership.guardianId || context.membership.studentId);
    const statuses = isFamily ? PUBLIC_VISIBLE : STAFF_VISIBLE;

    const sheets = await this.assessment.sheetsForStudent(schoolId, studentId, term.id, statuses);
    if (isFamily && sheets.length === 0) throw AppError.notFound('Published results for this term');

    // The class the marks were taken in, which is the class the card is for.
    const classId = sheets[0]?.classId ?? student.currentClassId;
    const [schemes, roster, entries, school, terms, record, behaviour] = await Promise.all([
      this.fetchGradingSchemes(context),
      classId ? this.assessment.rosterForClass(schoolId, classId) : Promise.resolve([] as RosterRow[]),
      this.assessment.entriesForSheets(schoolId, sheets.map((sheet) => sheet.id)),
      this.schools.findById(schoolId),
      this.terms.fetchForSchool(schoolId),
      this.assessment.findReportCard(schoolId, studentId, term.id),
      this.behaviour.fetchStudentTermRatings(context, studentId, term.id),
    ]);
    if (!school) throw AppError.notFound('School');
    const schemeById = new Map(schemes.map((scheme) => [scheme.id, scheme]));

    const lines: SubjectResultLineDTO[] = [];
    for (const sheet of sheets) {
      const scheme = schemeById.get(sheet.gradingSchemeId);
      if (!scheme) continue;
      const sheetEntries = entries.filter((entry) => entry.scoreSheetId === sheet.id);
      const classTotals = classSummaries(scheme, sheetEntries);
      const mine = classTotals.get(studentId) ?? summarise(scheme, []);
      const positions = rank([...classTotals.keys()], (id) => classTotals.get(id)?.total ?? null);
      const totals = [...classTotals.values()].map((s) => s.total).filter((t): t is number => t !== null);
      lines.push({
        subjectId: sheet.subjectId,
        subjectName: sheet.subjectName,
        components: scheme.components.map((component) => ({
          componentId: component.id,
          name: component.name,
          maxScore: component.maxScore,
          score: sheetEntries.find((e) => e.studentId === studentId && e.componentId === component.id)?.score ?? null,
        })),
        total: mine.total,
        grade: mine.grade,
        remark: mine.remark,
        position: scheme.showPosition ? (positions.get(studentId) ?? null) : null,
        classAverage: totals.length > 0 ? average(totals) : null,
        classHighest: totals.length > 0 ? Math.max(...totals) : null,
        teacherName: sheet.teacherName,
      });
    }

    const scored = lines.filter((line) => line.total !== null);
    const totalScore = scored.reduce((sum, line) => sum + (line.total ?? 0), 0);
    const totalObtainable = sheets.reduce((sum, sheet) => sum + (schemeById.get(sheet.gradingSchemeId)?.components.reduce((s, c) => s + c.maxScore, 0) ?? 0), 0);
    const overall = totalObtainable > 0 ? (totalScore / totalObtainable) * 100 : 0;
    const overallScheme = schemeById.get(sheets[0]?.gradingSchemeId ?? '') ?? schemes[0];
    const overallGrade = overallScheme ? (summarise({ components: [{ maxScore: 100 } as never], bands: overallScheme.bands }, [{ componentId: 'x', score: overall }]).grade ?? '—') : '—';

    // Position in class: every pupil's average across the same sheets.
    const averages = new Map<string, number | null>();
    for (const pupil of roster) {
      const totals = sheets.map((sheet) => {
        const scheme = schemeById.get(sheet.gradingSchemeId);
        if (!scheme) return null;
        return summarise(scheme, entries.filter((e) => e.scoreSheetId === sheet.id && e.studentId === pupil.studentId)).percentage;
      }).filter((p): p is number => p !== null);
      averages.set(pupil.studentId, totals.length > 0 ? average(totals) : null);
    }
    if (!averages.has(studentId)) averages.set(studentId, scored.length > 0 ? average(scored.map((l) => (l.total ?? 0))) : null);
    const classPositions = rank([...averages.keys()], (id) => averages.get(id) ?? null);

    const attendanceRecords = await this.attendance.historyForStudent(schoolId, studentId, { from: term.startDate, to: term.endDate });
    const present = attendanceRecords.filter((r) => r.status === 'PRESENT').length;
    const late = attendanceRecords.filter((r) => r.status === 'LATE').length;
    const absent = attendanceRecords.filter((r) => r.status === 'ABSENT' || r.status === 'EXCUSED').length;
    const attendanceTotal = attendanceRecords.length;

    const allPublished = sheets.length > 0 && sheets.every((sheet) => sheet.status === 'PUBLISHED');
    const status: ResultStatus = sheets.length === 0 ? 'DRAFT' : allPublished ? 'PUBLISHED' : 'APPROVED';
    let card = record;
    if (allPublished && !card?.verificationCode) {
      card = await this.assessment.upsertReportCard({
        schoolId,
        studentId,
        termId: term.id,
        formTeacherComment: card?.formTeacherComment ?? null,
        principalComment: card?.principalComment ?? null,
        verificationCode: verificationCode(),
        publishedAt: latestPublished(sheets),
      });
    }

    const nextTerm = terms
      .filter((t) => t.sessionId === term.sessionId && t.sequence > term.sequence)
      .sort((a, b) => a.sequence - b.sequence)[0];

    return {
      id: card?.id ?? `${studentId}:${term.id}`,
      schoolId,
      studentId,
      studentName: student.fullName,
      admissionNo: student.admissionNo,
      photoUrl: student.photoConsent ? student.photoUrl : null,
      photoConsent: student.photoConsent,
      className: sheets[0]?.className ?? student.currentClassName ?? '',
      levelName: sheets[0]?.levelName ?? '',
      termId: term.id,
      termName: term.name,
      sessionName: term.sessionName,
      status,
      subjects: lines,
      totalScore: Math.round(totalScore * 100) / 100,
      totalObtainable,
      average: Math.round(overall * 10) / 10,
      grade: overallGrade,
      position: classPositions.get(studentId) ?? null,
      classSize: roster.length,
      attendance: {
        present,
        absent,
        late,
        total: attendanceTotal,
        rate: attendanceTotal === 0 ? 0 : Math.round((100 * (present + late)) / attendanceTotal),
      },
      behaviour: behaviour.map((row) => ({
        traitId: row.traitId,
        traitName: row.traitName,
        category: row.category,
        rating: Math.round(row.averageRating),
        scaleMax: row.scaleMax,
        label: row.label,
      })),
      formTeacherComment: card?.formTeacherComment ?? null,
      principalComment: card?.principalComment ?? null,
      nextTermBegins: nextTerm?.startDate ?? null,
      publishedAt: card?.publishedAt ? card.publishedAt.toISOString() : allPublished ? latestPublished(sheets)?.toISOString() ?? null : null,
      verificationCode: card?.verificationCode ?? null,
      verifyUrl: card?.verificationCode ? verifyUrl(card.verificationCode) : null,
      school: {
        name: school.name,
        logoUrl: school.branding?.logoUrl ?? null,
        address: [school.addressLine1, school.addressLine2, school.city, school.state].filter(Boolean).join(', '),
        primaryColor: school.branding?.primaryColor ?? '#2563eb',
        motto: school.branding?.motto ?? null,
      },
    };
  }

  async saveReportCardComments(
    context: RequestContext,
    studentId: string,
    termId: string,
    input: SaveReportCardCommentsInput,
  ): Promise<ReportCardDTO> {
    const { schoolId } = context;
    if (!(await this.students.findOneDTO(schoolId, studentId))) throw AppError.notFound('Student');
    if (!(await this.terms.findOneDTO(schoolId, termId))) throw AppError.notFound('Term');

    const existing = await this.assessment.findReportCard(schoolId, studentId, termId);
    const patch: Record<string, unknown> = {};
    if (input.formTeacherComment !== undefined) patch.formTeacherComment = input.formTeacherComment;
    if (input.principalComment !== undefined) patch.principalComment = input.principalComment;
    await this.assessment.upsertReportCard({
      schoolId,
      studentId,
      termId,
      formTeacherComment: existing?.formTeacherComment ?? null,
      principalComment: existing?.principalComment ?? null,
      ...patch,
    });
    for (const text of [input.formTeacherComment, input.principalComment]) {
      if (text) await this.assessment.countTemplateUse(schoolId, text);
    }
    return this.fetchReportCard(context, studentId, termId);
  }

  /* -- Broadsheet ------------------------------------------------------------ */

  async fetchBroadsheet(context: RequestContext, classId: string, termId: string): Promise<BroadsheetDTO> {
    const { schoolId } = context;
    const scope = await this.scope.forContext(context);
    if (!scopeAllows(scope, { classId })) throw AppError.notFound('Class');
    const term = await this.terms.findOneDTO(schoolId, termId);
    if (!term) throw AppError.notFound('Term');

    const [sheets, roster, schemes] = await Promise.all([
      this.assessment.sheetsForClassTerm(schoolId, classId, termId, STAFF_VISIBLE),
      this.assessment.rosterForClass(schoolId, classId),
      this.fetchGradingSchemes(context),
    ]);
    const entries = await this.assessment.entriesForSheets(schoolId, sheets.map((sheet) => sheet.id));
    const schemeById = new Map(schemes.map((scheme) => [scheme.id, scheme]));
    const className = sheets[0]?.className ?? (await this.classNameOf(schoolId, classId));

    const rows = roster.map((pupil) => {
      const subjects: Record<string, number | null> = {};
      const percentages: number[] = [];
      let total = 0;
      for (const sheet of sheets) {
        const scheme = schemeById.get(sheet.gradingSchemeId);
        const mark = scheme
          ? summarise(scheme, entries.filter((e) => e.scoreSheetId === sheet.id && e.studentId === pupil.studentId))
          : null;
        subjects[sheet.subjectId] = mark?.total ?? null;
        if (mark?.total !== null && mark?.total !== undefined) {
          total += mark.total;
          if (mark.percentage !== null) percentages.push(mark.percentage);
        }
      }
      const avg = percentages.length > 0 ? average(percentages) : 0;
      const scheme = schemeById.get(sheets[0]?.gradingSchemeId ?? '') ?? schemes[0];
      const grade = scheme
        ? summarise({ components: [{ maxScore: 100 } as never], bands: scheme.bands }, [{ componentId: 'x', score: avg }]).grade ?? '—'
        : '—';
      return { studentId: pupil.studentId, studentName: pupil.studentName, admissionNo: pupil.admissionNo, subjects, total: Math.round(total * 100) / 100, average: avg, grade, hasMarks: percentages.length > 0 };
    });
    const positions = rank(rows, (row) => (row.hasMarks ? row.average : null));

    return {
      classId,
      className,
      termId,
      termName: term.name,
      sessionName: term.sessionName,
      subjects: sheets.map((sheet) => ({ subjectId: sheet.subjectId, subjectName: sheet.subjectName })),
      rows: rows
        .map(({ hasMarks: _hasMarks, ...row }) => ({ ...row, position: positions.get(rows.find((r) => r.studentId === row.studentId)!) ?? 0 }))
        .sort((a, b) => (a.position || 9999) - (b.position || 9999) || a.studentName.localeCompare(b.studentName)),
      classAverage: average(rows.filter((row) => row.hasMarks).map((row) => row.average)),
    };
  }

  /* -- Comment templates ----------------------------------------------------- */

  async fetchCommentTemplates(context: RequestContext): Promise<CommentTemplateDTO[]> {
    return this.assessment.templatesForSchool(context.schoolId);
  }

  async createCommentTemplate(context: RequestContext, input: CreateCommentTemplateInput): Promise<CommentTemplateDTO> {
    const created = await this.assessment.createTemplate({ schoolId: context.schoolId, ...input, usageCount: 0 });
    return { id: created.id, schoolId: created.schoolId, audience: created.audience, band: created.band, text: created.text, usageCount: 0 };
  }

  /* -- Transcripts ----------------------------------------------------------- */

  /** Every published term the pupil has, grouped by session — the whole record. */
  async fetchTranscript(context: RequestContext, studentId: string): Promise<TranscriptDTO> {
    const { schoolId } = context;
    if (!(await this.access.canSeeStudent(context, studentId))) throw AppError.notFound('Student');
    const student = await this.students.findOneDTO(schoolId, studentId);
    if (!student) throw AppError.notFound('Student');

    const [sheets, schemes, issue] = await Promise.all([
      this.assessment.sheetsForStudent(schoolId, studentId, null, PUBLIC_VISIBLE),
      this.fetchGradingSchemes(context),
      this.assessment.findTranscriptIssue(schoolId, studentId),
    ]);
    const entries = await this.assessment.entriesForSheets(schoolId, sheets.map((sheet) => sheet.id));
    const schemeById = new Map(schemes.map((scheme) => [scheme.id, scheme]));

    const bySession = new Map<string, SheetRow[]>();
    for (const sheet of sheets) {
      bySession.set(sheet.sessionId, [...(bySession.get(sheet.sessionId) ?? []), sheet]);
    }

    const years = [...bySession.values()].map((sessionSheets) => {
      const byTerm = new Map<string, SheetRow[]>();
      for (const sheet of sessionSheets) byTerm.set(sheet.termId, [...(byTerm.get(sheet.termId) ?? []), sheet]);
      const terms = [...byTerm.values()].map((termSheets) => {
        const subjects = termSheets.flatMap((sheet) => {
          const scheme = schemeById.get(sheet.gradingSchemeId);
          if (!scheme) return [];
          const mark = summarise(scheme, entries.filter((e) => e.scoreSheetId === sheet.id && e.studentId === studentId));
          return mark.total === null ? [] : [{ subjectName: sheet.subjectName, total: mark.total, grade: mark.grade ?? '—', percentage: mark.percentage ?? 0 }];
        });
        return {
          termName: termSheets[0].termName,
          subjects: subjects.map(({ percentage: _p, ...subject }) => subject),
          average: average(subjects.map((subject) => subject.percentage)),
          position: null,
        };
      });
      return {
        sessionName: sessionSheets[0].sessionName,
        levelName: sessionSheets[0].levelName,
        className: sessionSheets[0].className,
        terms,
        yearAverage: average(terms.map((term) => term.average)),
      };
    });

    return {
      id: issue?.id ?? `${studentId}:transcript`,
      schoolId,
      studentId,
      studentName: student.fullName,
      admissionNo: student.admissionNo,
      dateOfBirth: student.dateOfBirth,
      admissionDate: student.admissionDate,
      exitDate: null,
      status: student.status,
      years,
      cumulativeAverage: average(years.map((year) => year.yearAverage)),
      verificationCode: issue?.verificationCode ?? '',
      verifyUrl: issue ? verifyUrl(issue.verificationCode) : '',
      issuedByName: issue?.issuedByName ?? null,
      issuedAt: issue?.issuedAt ? issue.issuedAt.toISOString() : null,
    };
  }

  /** Issuing stamps a fresh code; a previously issued copy stops verifying. */
  async issueTranscript(context: RequestContext, studentId: string): Promise<TranscriptDTO> {
    const transcript = await this.fetchTranscript(context, studentId);
    if (transcript.years.length === 0) {
      throw AppError.validation('Nothing has been published for this pupil yet, so there is no transcript to issue.');
    }
    await this.assessment.upsertTranscriptIssue({
      schoolId: context.schoolId,
      studentId,
      verificationCode: verificationCode(),
      issuedByName: context.user.displayName,
      issuedAt: new Date(),
      cumulativeAverage: String(transcript.cumulativeAverage),
    });
    await this.audit.record(context, {
      action: 'transcript.issued',
      entityType: 'Student',
      entityId: studentId,
      entityLabel: transcript.studentName,
      after: { cumulativeAverage: transcript.cumulativeAverage },
    });
    return this.fetchTranscript(context, studentId);
  }

  /** Public: initials, not a name; a band, not a mark. */
  async verify(code: string): Promise<VerificationResultDTO> {
    const [card, issue] = await Promise.all([
      this.assessment.findReportCardByCode(code),
      this.assessment.findTranscriptIssueByCode(code),
    ]);
    const record = card ?? issue;
    if (!record) {
      return { valid: false, documentType: 'REPORT_CARD', schoolName: '', schoolLogoUrl: null, studentInitials: '', className: null, termName: null, sessionName: null, issuedAt: '', averageBand: null, revoked: false };
    }
    const [school, student] = await Promise.all([
      this.schools.findById(record.schoolId),
      this.students.findOneDTO(record.schoolId, record.studentId),
    ]);
    const initials = student ? student.fullName.split(/\s+/).map((part) => part[0]?.toUpperCase() ?? '').join('') : '';
    if (card) {
      const term = await this.terms.findOneDTO(card.schoolId, card.termId);
      return {
        valid: true,
        documentType: 'REPORT_CARD',
        schoolName: school?.name ?? '',
        schoolLogoUrl: school?.branding?.logoUrl ?? null,
        studentInitials: initials,
        className: student?.currentClassName ?? null,
        termName: term?.name ?? null,
        sessionName: term?.sessionName ?? null,
        issuedAt: (card.publishedAt ?? card.updatedAt).toISOString(),
        averageBand: null,
        revoked: false,
      };
    }
    return {
      valid: true,
      documentType: 'TRANSCRIPT',
      schoolName: school?.name ?? '',
      schoolLogoUrl: school?.branding?.logoUrl ?? null,
      studentInitials: initials,
      className: null,
      termName: null,
      sessionName: null,
      issuedAt: issue!.issuedAt.toISOString(),
      averageBand: bandLabel(Number(issue!.cumulativeAverage)),
      revoked: false,
    };
  }

  /* -- Analytics ------------------------------------------------------------- */

  /** The whole-school figures the analytics screen and admin dashboard read. */
  async resultAnalytics(schoolId: string, term: TermDTO) {
    const [sheets, schemes] = await Promise.all([
      this.assessment.sheetsForTerm(schoolId, term.id, STAFF_VISIBLE),
      this.assessment.schemesForSchool(schoolId),
    ]);
    const entries = await this.assessment.entriesForTerm(schoolId, term.id, STAFF_VISIBLE);
    const schemeById = new Map(schemes.map((scheme) => [scheme.id, scheme]));

    const bySubject = new Map<string, { subjectName: string; percentages: number[]; passes: number }>();
    const byClass = new Map<string, { className: string; percentages: number[]; passes: number }>();
    const byStudent = new Map<string, number[]>();
    const grades = new Map<string, { count: number; color: string | null }>();

    for (const sheet of sheets) {
      const scheme = schemeById.get(sheet.gradingSchemeId);
      if (!scheme) continue;
      for (const [studentId, mark] of classSummaries(scheme, entries.filter((e) => e.scoreSheetId === sheet.id))) {
        if (mark.percentage === null) continue;
        const subject = bySubject.get(sheet.subjectId) ?? { subjectName: sheet.subjectName, percentages: [], passes: 0 };
        subject.percentages.push(mark.percentage);
        if (mark.isPass) subject.passes += 1;
        bySubject.set(sheet.subjectId, subject);
        const cls = byClass.get(sheet.classId) ?? { className: sheet.className, percentages: [], passes: 0 };
        cls.percentages.push(mark.percentage);
        if (mark.isPass) cls.passes += 1;
        byClass.set(sheet.classId, cls);
        byStudent.set(studentId, [...(byStudent.get(studentId) ?? []), mark.percentage]);
        if (mark.grade) {
          const band = scheme.bands.find((b) => b.label === mark.grade);
          const entry = grades.get(mark.grade) ?? { count: 0, color: band?.color ?? null };
          entry.count += 1;
          grades.set(mark.grade, entry);
        }
      }
    }

    const studentAverages = [...byStudent.values()].map((percentages) => average(percentages));
    const passMark = schemes.find((scheme) => scheme.isDefault)?.passMark ?? schemes[0]?.passMark ?? 40;
    const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((1000 * part) / whole) / 10);

    return {
      termName: `${term.name}, ${term.sessionName}`,
      overallAverage: average(studentAverages),
      passRate: pct(studentAverages.filter((avg) => avg >= passMark).length, studentAverages.length),
      subjects: [...bySubject.entries()].map(([subjectId, row]) => ({
        subjectId,
        subjectName: row.subjectName,
        averageScore: average(row.percentages),
        passRate: pct(row.passes, row.percentages.length),
        studentsAssessed: row.percentages.length,
        highest: Math.max(...row.percentages),
        lowest: Math.min(...row.percentages),
      })),
      gradeDistribution: [...grades.entries()].map(([grade, row]) => ({ grade, count: row.count, color: row.color })),
      classComparison: [...byClass.values()].map((row) => ({
        className: row.className,
        average: average(row.percentages),
        passRate: pct(row.passes, row.percentages.length),
      })),
    };
  }

  /* -- Dashboard tiles ------------------------------------------------------- */

  /**
   * A child's standing for the parent dashboard: this term's average and
   * position once everything is published, and last term's for comparison.
   * Null where nothing is published — the honest answer, not zero.
   */
  async childResultSummary(
    schoolId: string,
    studentId: string,
    currentTerm: TermDTO | undefined,
    terms: TermDTO[],
  ): Promise<{ currentTermAverage: number | null; lastTermAverage: number | null; position: number | null; classSize: number | null; resultPublished: boolean }> {
    const schemes = await this.assessment.schemesForSchool(schoolId);
    const schemeById = new Map(schemes.map((scheme) => [scheme.id, scheme]));

    const termAverage = async (term: TermDTO | undefined) => {
      if (!term) return { average: null as number | null, sheets: [] as SheetRow[] };
      const sheets = await this.assessment.sheetsForStudent(schoolId, studentId, term.id, PUBLIC_VISIBLE);
      if (sheets.length === 0) return { average: null as number | null, sheets };
      const entries = await this.assessment.entriesForSheets(schoolId, sheets.map((sheet) => sheet.id));
      const percentages = sheets
        .map((sheet) => {
          const scheme = schemeById.get(sheet.gradingSchemeId);
          return scheme ? summarise(scheme, entries.filter((e) => e.scoreSheetId === sheet.id && e.studentId === studentId)).percentage : null;
        })
        .filter((p): p is number => p !== null);
      return { average: percentages.length > 0 ? average(percentages) : null, sheets, entries };
    };

    const lastTerm = currentTerm
      ? terms.filter((t) => t.sessionId === currentTerm.sessionId && t.sequence < currentTerm.sequence).sort((a, b) => b.sequence - a.sequence)[0]
      : undefined;
    const [current, last] = await Promise.all([termAverage(currentTerm), termAverage(lastTerm)]);

    let position: number | null = null;
    let classSize: number | null = null;
    if (current.sheets.length > 0 && current.entries) {
      const roster = await this.assessment.rosterForClass(schoolId, current.sheets[0].classId);
      const averages = new Map(
        roster.map((pupil) => {
          const percentages = current.sheets
            .map((sheet) => {
              const scheme = schemeById.get(sheet.gradingSchemeId);
              return scheme ? summarise(scheme, current.entries!.filter((e) => e.scoreSheetId === sheet.id && e.studentId === pupil.studentId)).percentage : null;
            })
            .filter((p): p is number => p !== null);
          return [pupil.studentId, percentages.length > 0 ? average(percentages) : null] as const;
        }),
      );
      position = rank([...averages.keys()], (id) => averages.get(id) ?? null).get(studentId) ?? null;
      classSize = roster.length;
    }

    return {
      currentTermAverage: current.average,
      lastTermAverage: last.average,
      position,
      classSize,
      resultPublished: current.sheets.length > 0,
    };
  }

  /** The sheets a teacher still has marks to enter on this term. */
  async pendingScoreEntry(context: RequestContext, currentTerm: TermDTO | undefined) {
    if (!currentTerm) return [];
    const page = await this.fetchScoreSheets(context, { page: 1, pageSize: 50, termId: currentTerm.id, status: 'DRAFT' });
    return page.items
      .filter((sheet) => sheet.enteredCount < sheet.totalCount)
      .map((sheet) => ({
        scoreSheetId: sheet.id,
        className: sheet.className,
        subjectName: sheet.subjectName,
        enteredCount: sheet.enteredCount,
        totalCount: sheet.totalCount,
        status: sheet.status,
      }));
  }

  /* -- Internals ------------------------------------------------------------- */

  private async resolveTerm(schoolId: string, termId: string | undefined): Promise<TermDTO | null> {
    if (termId) {
      const term = await this.terms.findOneDTO(schoolId, termId);
      if (!term) throw AppError.notFound('Term');
      return term;
    }
    return (await this.terms.fetchForSchool(schoolId)).find((term) => term.isCurrent) ?? null;
  }

  private async resolveSheet(context: RequestContext, id: string): Promise<SheetRow> {
    const sheet = await this.assessment.findSheet(context.schoolId, id);
    if (!sheet) throw AppError.notFound('Score sheet');
    const scope = await this.scope.forContext(context);
    if (!scopeAllows(scope, { classId: sheet.classId, subjectId: sheet.subjectId })) throw AppError.notFound('Score sheet');
    return sheet;
  }

  private async buildSheet(schoolId: string, sheet: SheetRow): Promise<ScoreSheetDTO> {
    const [scheme, roster, entries] = await Promise.all([
      this.assessment.findSchemeDTO(schoolId, sheet.gradingSchemeId),
      this.assessment.rosterForSheet(schoolId, sheet.id, sheet.classId),
      this.assessment.entriesForSheets(schoolId, [sheet.id]),
    ]);
    if (!scheme) throw AppError.internal();

    const marks = new Map(
      roster.map((pupil) => [
        pupil.studentId,
        summarise(scheme, entries.filter((entry) => entry.studentId === pupil.studentId)),
      ]),
    );
    const positions = rank(roster, (pupil) => marks.get(pupil.studentId)?.total ?? null);
    const rows: StudentSubjectScoreDTO[] = roster.map((pupil) => {
      const mark = marks.get(pupil.studentId)!;
      return {
        id: `${sheet.id}:${pupil.studentId}`,
        studentId: pupil.studentId,
        studentName: pupil.studentName,
        admissionNo: pupil.admissionNo,
        photoUrl: pupil.photoUrl,
        scores: scheme.components.map((component) => ({
          componentId: component.id,
          score: entries.find((e) => e.studentId === pupil.studentId && e.componentId === component.id)?.score ?? null,
        })),
        total: mark.total,
        grade: mark.grade,
        remark: mark.remark,
        position: scheme.showPosition ? (positions.get(pupil) ?? null) : null,
        isAbsent: mark.total === null,
        version: sheet.version,
      };
    });
    const totals = rows.map((row) => row.total).filter((total): total is number => total !== null);

    return {
      ...toSheetHeader(sheet),
      components: scheme.components,
      rows,
      classAverage: totals.length > 0 ? average(totals) : null,
      highest: totals.length > 0 ? Math.max(...totals) : null,
      lowest: totals.length > 0 ? Math.min(...totals) : null,
    };
  }

  private async announcePublished(context: RequestContext, sheet: SheetRow): Promise<void> {
    const roster = await this.assessment.rosterForClass(context.schoolId, sheet.classId);
    const recipients = await this.attendance.guardianRecipientsFor(context.schoolId, roster.map((pupil) => pupil.studentId));
    if (recipients.length === 0) return;
    await this.notifications.notifyUsers(
      context.schoolId,
      recipients.map((row) => row.userId),
      {
        category: 'RESULT',
        title: `${sheet.subjectName} results are out`,
        body: `${sheet.subjectName} results for ${sheet.className}, ${sheet.termName} have been published. Open your child's report card to see them.`,
        actionUrl: '/family',
        severity: 'SUCCESS',
        entityType: 'ScoreSheet',
        entityId: sheet.id,
      },
    );
  }

  private async classNameOf(schoolId: string, classId: string): Promise<string> {
    const [row] = await AppDataSource.query(`SELECT name FROM school_classes WHERE school_id = $1 AND id = $2`, [schoolId, classId]);
    return row?.name ?? '';
  }
}

/* -- Helpers ---------------------------------------------------------------- */

/** The client sends its whole draft back; only these columns are the scheme's. */
function pickComponent(component: CreateGradingSchemeInput['components'][number]) {
  return {
    name: component.name,
    code: component.code,
    maxScore: component.maxScore,
    sequence: component.sequence,
    type: component.type,
  };
}

function pickBand(band: CreateGradingSchemeInput['bands'][number]) {
  return {
    label: band.label,
    minScore: band.minScore,
    maxScore: band.maxScore,
    remark: band.remark,
    gradePoint: band.gradePoint === null || band.gradePoint === undefined ? null : String(band.gradePoint),
    isPass: band.isPass,
    color: band.color ?? null,
  };
}

function schemeFor(schemes: GradingSchemeDTO[], levelId: string): GradingSchemeDTO {
  return (
    schemes.find((scheme) => scheme.levelIds.includes(levelId)) ??
    schemes.find((scheme) => scheme.isDefault) ??
    schemes[0]
  );
}

function classSummaries(scheme: GradingSchemeDTO, entries: EntryRow[]) {
  const byStudent = new Map<string, EntryRow[]>();
  for (const entry of entries) byStudent.set(entry.studentId, [...(byStudent.get(entry.studentId) ?? []), entry]);
  return new Map([...byStudent.entries()].map(([studentId, rows]) => [studentId, summarise(scheme, rows)]));
}

function toSheetHeader(sheet: SheetRow): Omit<ScoreSheetDTO, 'components' | 'rows' | 'classAverage' | 'highest' | 'lowest'> {
  return {
    id: sheet.id,
    schoolId: sheet.schoolId,
    classId: sheet.classId,
    className: sheet.className,
    subjectId: sheet.subjectId,
    subjectName: sheet.subjectName,
    termId: sheet.termId,
    termName: sheet.termName,
    sessionName: sheet.sessionName,
    gradingSchemeId: sheet.gradingSchemeId,
    status: sheet.status,
    submittedByName: sheet.submittedByName,
    submittedAt: sheet.submittedAt,
    approvedByName: sheet.approvedByName,
    approvedAt: sheet.approvedAt,
    publishedAt: sheet.publishedAt,
    version: sheet.version,
  };
}

function latestPublished(sheets: SheetRow[]): Date | null {
  const dates = sheets.map((sheet) => sheet.publishedAt).filter((d): d is string => Boolean(d));
  return dates.length === 0 ? null : new Date(dates.sort()[dates.length - 1]);
}

/** Ten hex characters from a cryptographic source, same as a receipt's. */
function verificationCode(): string {
  return randomBytes(5).toString('hex').toUpperCase();
}

function verifyUrl(code: string): string {
  return `${env.appUrl.replace(/\/$/, '')}/verify/${code}`;
}

function bandLabel(averagePercentage: number): string {
  if (averagePercentage >= 70) return 'Distinction';
  if (averagePercentage >= 60) return 'Credit';
  if (averagePercentage >= 40) return 'Pass';
  return 'Below pass';
}
