import { bandFor, rank, summarise } from '../services/grading';
import { AssessmentService } from '../services/assessment.service';
import { AssessmentRepository } from '../repositories/assessment.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { AuditService } from '../../audit/services/audit.service';
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
