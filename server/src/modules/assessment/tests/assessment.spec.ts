import { bandFor, rank, summarise } from '../services/grading';
import { AssessmentService } from '../services/assessment.service';
import { AssessmentRepository } from '../repositories/assessment.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { AuditService } from '../../audit/services/audit.service';
import { BehaviourService } from '../../behaviour/services/behaviour.service';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { TermRepository } from '../../academics/repositories/term.repository';
import { createGradingSchemeSchema, saveScoresSchema } from '../validators/assessment.schema';
import type { RequestContext } from '../../../shared/types/context';
import type { GradingSchemeDTO } from '../dto/assessment.dto';

const scheme: Pick<GradingSchemeDTO, 'components' | 'bands'> = {
  components: [
    { id: 'ca1', schoolId: 's', schemeId: 'g', name: 'CA 1', code: 'CA1', maxScore: 20, sequence: 1, type: 'CONTINUOUS_ASSESSMENT' },
    { id: 'ca2', schoolId: 's', schemeId: 'g', name: 'CA 2', code: 'CA2', maxScore: 20, sequence: 2, type: 'CONTINUOUS_ASSESSMENT' },
    { id: 'exam', schoolId: 's', schemeId: 'g', name: 'Exam', code: 'EXAM', maxScore: 60, sequence: 3, type: 'EXAM' },
  ],
  bands: [
    { id: 'a', label: 'A', minScore: 70, maxScore: 100, remark: 'Excellent', gradePoint: 5, isPass: true, color: null },
    { id: 'c', label: 'C', minScore: 50, maxScore: 69, remark: 'Good', gradePoint: 3, isPass: true, color: null },
    { id: 'f', label: 'F', minScore: 0, maxScore: 49, remark: 'Fail', gradePoint: 0, isPass: false, color: null },
  ],
};

describe('grading', () => {
  it('sums the components and grades the percentage of what was obtainable', () => {
    const mark = summarise(scheme, [
      { componentId: 'ca1', score: 18 },
      { componentId: 'ca2', score: 17 },
      { componentId: 'exam', score: 50 },
    ]);
    expect(mark).toMatchObject({ total: 85, obtainable: 100, percentage: 85, grade: 'A', remark: 'Excellent', isPass: true });
  });

  it('treats a missing component as not yet entered, not as zero, and nothing entered as absent', () => {
    expect(summarise(scheme, [{ componentId: 'exam', score: 40 }])).toMatchObject({ total: 40, grade: 'F' });
    expect(summarise(scheme, [])).toMatchObject({ total: null, grade: null, isPass: null });
  });

  it('rounds to the nearest band boundary the way a teacher expects (69.5 is an A)', () => {
    expect(bandFor(scheme.bands, 69.5)?.label).toBe('A');
    expect(bandFor(scheme.bands, 69.4)?.label).toBe('C');
  });

  it('ranks with shared positions and skips after a tie', () => {
    const rows = [{ t: 80 }, { t: 90 }, { t: 80 }, { t: null }, { t: 70 }];
    const positions = rank(rows, (row) => row.t);
    expect(rows.map((row) => positions.get(row))).toEqual([2, 1, 2, null, 4]);
  });
});

describe('AssessmentService.transitionScoreSheet', () => {
  afterEach(() => jest.restoreAllMocks());

  const context = (permissions: string[]) =>
    ({
      schoolId: 'school-1',
      user: { id: 'user-1', displayName: 'Mrs Bello' },
      membership: { staffId: 'staff-1', guardianId: null, studentId: null, roles: ['TEACHER'], customRoleNames: [] },
      can: (permission: string) => permissions.includes(permission),
      requestId: 'req-1',
      ipAddress: null,
      userAgent: null,
    }) as unknown as RequestContext;

  const sheet = (status: string) =>
    ({ id: 'sheet-1', classId: 'class-a', subjectId: 'subject-1', status, subjectName: 'Maths', className: 'JSS 1', termName: 'T1' }) as never;

  it('a teacher may submit but not approve', async () => {
    jest.spyOn(AssessmentRepository.Instance, 'findSheet').mockResolvedValue(sheet('SUBMITTED'));
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({ classIds: null, subjectIds: null, pairs: null });
    await expect(
      AssessmentService.Instance.transitionScoreSheet(context(['result.enter']), 'sheet-1', { to: 'APPROVED', note: null }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('a sheet cannot skip a step', async () => {
    jest.spyOn(AssessmentRepository.Instance, 'findSheet').mockResolvedValue(sheet('DRAFT'));
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({ classIds: null, subjectIds: null, pairs: null });
    await expect(
      AssessmentService.Instance.transitionScoreSheet(context(['result.publish']), 'sheet-1', { to: 'PUBLISHED', note: null }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('stamps who submitted and when', async () => {
    jest.spyOn(AssessmentRepository.Instance, 'findSheet').mockResolvedValue(sheet('DRAFT'));
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({ classIds: null, subjectIds: null, pairs: null });
    const transition = jest.spyOn(AssessmentRepository.Instance, 'transitionSheet').mockResolvedValue(undefined);
    jest.spyOn(AuditService.Instance, 'record').mockResolvedValue(undefined);
    jest.spyOn(AssessmentService.Instance as never, 'buildSheet' as never).mockResolvedValue({} as never);

    await AssessmentService.Instance.transitionScoreSheet(context(['result.enter']), 'sheet-1', { to: 'SUBMITTED', note: null });

    expect(transition).toHaveBeenCalledWith('school-1', 'sheet-1', expect.objectContaining({ status: 'SUBMITTED', submittedByName: 'Mrs Bello' }));
  });

  it("a sheet outside the teacher's pairs is not found", async () => {
    jest.spyOn(AssessmentRepository.Instance, 'findSheet').mockResolvedValue(sheet('DRAFT'));
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({
      classIds: ['class-b'], subjectIds: ['subject-1'], pairs: [{ classId: 'class-b', subjectId: 'subject-1' }],
    });
    await expect(
      AssessmentService.Instance.transitionScoreSheet(context(['result.enter']), 'sheet-1', { to: 'SUBMITTED', note: null }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('assessment validators', () => {
  const wrap = (body: unknown) => ({ body, query: {}, params: { id: '11111111-1111-4111-8111-111111111111' } });
  const band = (label: string, min: number, max: number) => ({ label, minScore: min, maxScore: max, remark: label });
  const component = { name: 'Exam', code: 'EXAM', maxScore: 100, sequence: 1 };

  it('refuses grade bands that leave a gap or overlap', () => {
    expect(createGradingSchemeSchema.safeParse(wrap({ name: 'x', components: [component], bands: [band('A', 50, 100), band('F', 0, 48)] })).success).toBe(false);
    expect(createGradingSchemeSchema.safeParse(wrap({ name: 'x', components: [component], bands: [band('A', 50, 100), band('F', 0, 50)] })).success).toBe(false);
    expect(createGradingSchemeSchema.safeParse(wrap({ name: 'x', components: [component], bands: [band('A', 50, 100), band('F', 0, 49)] })).success).toBe(true);
  });

  it('keeps the extra fields the client sends back on a scheme, and a null mark on a score', () => {
    const scheme = createGradingSchemeSchema.safeParse(
      wrap({ name: 'x', schoolId: 'ignored', version: 3, components: [{ ...component, schemeId: 'ignored' }], bands: [band('A', 0, 100)] }),
    );
    expect(scheme.success).toBe(true);
    const scores = saveScoresSchema.safeParse(
      wrap({ entries: [{ studentId: '11111111-1111-4111-8111-111111111111', componentId: '22222222-2222-4222-8222-222222222222', score: null }] }),
    );
    expect(scores.success).toBe(true);
  });
});

/**
 * The read paths assemble a class's marks from one flat list of entries. These
 * cover what that assembly must produce: the right mark against the right
 * pupil and subject, positions that are shared on a tie, and a pupil with
 * nothing entered left out of the ranking rather than ranked last on zero.
 */
describe('AssessmentService results assembly', () => {
  afterEach(() => jest.restoreAllMocks());

  const context = {
    schoolId: 'school-1',
    user: { id: 'user-1', displayName: 'Mrs Bello' },
    membership: { staffId: 'staff-1', guardianId: null, studentId: null, roles: ['TEACHER'], customRoleNames: [] },
    can: () => true,
    requestId: 'req-1',
    ipAddress: null,
    userAgent: null,
  } as unknown as RequestContext;

  const fullScheme = {
    id: 'scheme-1',
    schoolId: 'school-1',
    name: 'Standard',
    description: null,
    isDefault: true,
    passMark: 40,
    levelIds: [],
    levelNames: [],
    showPosition: true,
    components: [
      { id: 'ca', schoolId: 'school-1', schemeId: 'scheme-1', name: 'CA', code: 'CA', maxScore: 40, sequence: 1, type: 'CONTINUOUS_ASSESSMENT' },
      { id: 'exam', schoolId: 'school-1', schemeId: 'scheme-1', name: 'Exam', code: 'EXAM', maxScore: 60, sequence: 2, type: 'EXAM' },
    ],
    bands: [
      { id: 'a', label: 'A', minScore: 70, maxScore: 100, remark: 'Excellent', gradePoint: 5, isPass: true, color: null },
      { id: 'c', label: 'C', minScore: 50, maxScore: 69, remark: 'Good', gradePoint: 3, isPass: true, color: null },
      { id: 'f', label: 'F', minScore: 0, maxScore: 49, remark: 'Fail', gradePoint: 0, isPass: false, color: null },
    ],
  } as unknown as GradingSchemeDTO;

  const sheetRow = (id: string, subjectId: string, subjectName: string) =>
    ({
      id,
      schoolId: 'school-1',
      classId: 'class-a',
      className: 'JSS 1',
      levelName: 'JSS',
      subjectId,
      subjectName,
      termId: 'term-1',
      termName: 'First term',
      sessionId: 'session-1',
      sessionName: '2025/2026',
      gradingSchemeId: 'scheme-1',
      status: 'APPROVED',
      teacherName: 'Mr Obi',
      version: 1,
    }) as never;

  const pupil = (studentId: string, studentName: string, admissionNo: string) =>
    ({ studentId, studentName, admissionNo, photoUrl: null, photoConsent: false, currentClassId: 'class-a' }) as never;

  const entry = (scoreSheetId: string, studentId: string, componentId: string, score: number) =>
    ({ scoreSheetId, studentId, componentId, score }) as never;

  const term = {
    id: 'term-1',
    name: 'First term',
    sessionId: 'session-1',
    sessionName: '2025/2026',
    sequence: 1,
    startDate: '2025-09-01',
    endDate: '2025-12-12',
    isCurrent: true,
  } as never;

  const sheets = [sheetRow('sheet-maths', 'subject-maths', 'Maths'), sheetRow('sheet-eng', 'subject-eng', 'English')];
  const roster = [pupil('p1', 'Ada Ade', 'ADM-1'), pupil('p2', 'Bola Bala', 'ADM-2'), pupil('p3', 'Chidi Chi', 'ADM-3')];

  describe('fetchBroadsheet', () => {
    // Ada and Bola both average 85 across the two subjects; Chidi has nothing.
    const entries = [
      entry('sheet-maths', 'p1', 'ca', 40), entry('sheet-maths', 'p1', 'exam', 50),
      entry('sheet-eng', 'p1', 'ca', 30), entry('sheet-eng', 'p1', 'exam', 50),
      entry('sheet-maths', 'p2', 'ca', 40), entry('sheet-maths', 'p2', 'exam', 50),
      entry('sheet-eng', 'p2', 'ca', 30), entry('sheet-eng', 'p2', 'exam', 50),
    ];

    const arrange = (rows: never[] = entries) => {
      jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({ classIds: null, subjectIds: null, pairs: null });
      jest.spyOn(TermRepository.Instance, 'findOneDTO').mockResolvedValue(term);
      jest.spyOn(AssessmentRepository.Instance, 'sheetsForClassTerm').mockResolvedValue(sheets);
      jest.spyOn(AssessmentRepository.Instance, 'rosterForClass').mockResolvedValue(roster);
      jest.spyOn(AssessmentRepository.Instance, 'schemesForSchool').mockResolvedValue([fullScheme]);
      jest.spyOn(AssessmentRepository.Instance, 'entriesForSheets').mockResolvedValue(rows);
    };

    it('puts each pupil against their own marks, shares a tied position and ranks nobody on no marks', async () => {
      arrange();
      const broadsheet = await AssessmentService.Instance.fetchBroadsheet(context, 'class-a', 'term-1');

      expect(broadsheet.rows.map((row) => [row.studentName, row.position])).toEqual([
        ['Ada Ade', 1],
        ['Bola Bala', 1],
        ['Chidi Chi', 0],
      ]);
      expect(broadsheet.rows[0]).toMatchObject({
        subjects: { 'subject-maths': 90, 'subject-eng': 80 },
        total: 170,
        average: 85,
        grade: 'A',
      });
      expect(broadsheet.rows[2]).toMatchObject({ subjects: { 'subject-maths': null, 'subject-eng': null }, total: 0 });
      expect(broadsheet.classAverage).toBe(85);
    });

    it('holds up when nothing has been entered at all', async () => {
      arrange([]);
      const broadsheet = await AssessmentService.Instance.fetchBroadsheet(context, 'class-a', 'term-1');

      expect(broadsheet.rows).toHaveLength(3);
      expect(broadsheet.rows.every((row) => row.position === 0 && row.total === 0)).toBe(true);
      expect(broadsheet.classAverage).toBe(0);
    });
  });

  describe('fetchReportCard', () => {
    // Ada takes 90 and 80; Bola 70 and 90; Chidi has nothing entered.
    const entries = [
      entry('sheet-maths', 'p1', 'ca', 40), entry('sheet-maths', 'p1', 'exam', 50),
      entry('sheet-eng', 'p1', 'ca', 30), entry('sheet-eng', 'p1', 'exam', 50),
      entry('sheet-maths', 'p2', 'ca', 30), entry('sheet-maths', 'p2', 'exam', 40),
      entry('sheet-eng', 'p2', 'ca', 40), entry('sheet-eng', 'p2', 'exam', 50),
    ];

    beforeEach(() => {
      jest.spyOn(StudentAccessService.Instance, 'canSeeStudent').mockResolvedValue(true);
      jest.spyOn(TermRepository.Instance, 'findOneDTO').mockResolvedValue(term);
      jest.spyOn(TermRepository.Instance, 'fetchForSchool').mockResolvedValue([term]);
      jest.spyOn(StudentRepository.Instance, 'findOneDTO').mockResolvedValue({
        id: 'p1',
        fullName: 'Ada Ade',
        admissionNo: 'ADM-1',
        photoConsent: false,
        photoUrl: null,
        currentClassId: 'class-a',
        currentClassName: 'JSS 1',
        status: 'ACTIVE',
      } as never);
      jest.spyOn(AssessmentRepository.Instance, 'sheetsForStudent').mockResolvedValue(sheets);
      jest.spyOn(AssessmentRepository.Instance, 'schemesForSchool').mockResolvedValue([fullScheme]);
      jest.spyOn(AssessmentRepository.Instance, 'rosterForClass').mockResolvedValue(roster);
      jest.spyOn(AssessmentRepository.Instance, 'entriesForSheets').mockResolvedValue(entries);
      jest.spyOn(AssessmentRepository.Instance, 'findReportCard').mockResolvedValue(null as never);
      jest.spyOn(SchoolRepository.Instance, 'findById').mockResolvedValue({ id: 'school-1', name: 'Test School', branding: null } as never);
      jest.spyOn(BehaviourService.Instance, 'fetchStudentTermRatings').mockResolvedValue([]);
      jest.spyOn(AttendanceRepository.Instance, 'historyForStudent').mockResolvedValue([]);
    });

    it('reads each subject line off the marks of that pupil, with the class figures beside them', async () => {
      const card = await AssessmentService.Instance.fetchReportCard(context, 'p1', 'term-1');

      expect(card.subjects).toHaveLength(2);
      expect(card.subjects[0]).toMatchObject({
        subjectName: 'Maths',
        total: 90,
        grade: 'A',
        position: 1,
        classAverage: 80,
        classHighest: 90,
      });
      expect(card.subjects[0].components.map((component) => component.score)).toEqual([40, 50]);
      expect(card.subjects[1]).toMatchObject({ subjectName: 'English', total: 80, position: 2, classHighest: 90 });
    });

    it('places the pupil in the class on the average of the same sheets', async () => {
      const card = await AssessmentService.Instance.fetchReportCard(context, 'p1', 'term-1');

      // Ada 85, Bola 80, Chidi unmarked and so unranked.
      expect(card).toMatchObject({
        position: 1,
        classSize: 3,
        totalScore: 170,
        totalObtainable: 200,
        average: 85,
        grade: 'A',
        status: 'APPROVED',
      });
    });
  });
});
