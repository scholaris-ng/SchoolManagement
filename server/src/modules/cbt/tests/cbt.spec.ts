import { CbtService } from '../services/cbt.service';
import { CbtRepository } from '../repositories/cbt.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { createQuestionSchema, submitAttemptSchema } from '../validators/cbt.schema';
import type { RequestContext } from '../../../shared/types/context';
import type { CbtAssessmentDTO, QuestionDTO } from '../dto/cbt.dto';
import type { CbtAttempt } from '../entities/cbtAssessment.entity';

const pupil = (studentId = 'child-a') =>
  ({
    schoolId: 'school-1',
    user: { id: 'user-1', displayName: 'Amara' },
    membership: { staffId: null, guardianId: null, studentId, roles: ['STUDENT'], customRoleNames: [] },
    can: (permission: string) => permission === 'cbt.take',
    requestId: 'req-1',
    ipAddress: null,
    userAgent: null,
  }) as unknown as RequestContext;

const question = (over: Partial<QuestionDTO> = {}): QuestionDTO => ({
  id: 'q1',
  schoolId: 'school-1',
  subjectId: 'subject-1',
  subjectName: 'Maths',
  topicId: null,
  topicTitle: null,
  objectiveId: null,
  objectiveStatement: null,
  levelId: null,
  type: 'MULTIPLE_CHOICE',
  difficulty: 'EASY',
  text: 'What is 2 + 2?',
  imageUrl: null,
  options: [
    { id: 'a', label: 'A', text: '3', isCorrect: false },
    { id: 'b', label: 'B', text: '4', isCorrect: true },
  ],
  correctAnswer: null,
  explanation: 'Two and two make four.',
  marks: 2,
  usageCount: 0,
  createdByName: 'Mrs Bello',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const assessment = (over: Partial<CbtAssessmentDTO> = {}): CbtAssessmentDTO =>
  ({
    id: 'paper-1',
    title: 'Quiz',
    mode: 'PRACTICE',
    classIds: ['class-a'],
    questionIds: ['q1'],
    state: 'OPEN',
    passScore: 50,
    durationMinutes: 30,
    attemptsAllowed: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
    showResultImmediately: true,
    startsAt: null,
    endsAt: null,
    submissionCount: 0,
    version: 1,
    ...over,
  }) as CbtAssessmentDTO;

const attempt = (over: Partial<CbtAttempt> = {}): CbtAttempt =>
  ({
    id: 'attempt-1',
    schoolId: 'school-1',
    assessmentId: 'paper-1',
    studentId: 'child-a',
    questionIds: ['q1'],
    answers: {},
    startedAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 600_000),
    submittedAt: null,
    score: null,
    totalMarks: 2,
    status: 'IN_PROGRESS',
    updatedAt: new Date(),
    ...over,
  }) as CbtAttempt;

describe('CbtService.submitAttempt', () => {
  afterEach(() => jest.restoreAllMocks());

  function stub(over: { assessment?: Partial<CbtAssessmentDTO>; attempt?: Partial<CbtAttempt>; questions?: QuestionDTO[] } = {}) {
    jest.spyOn(CbtRepository.Instance, 'findAttempt').mockResolvedValue(attempt(over.attempt));
    jest.spyOn(CbtRepository.Instance, 'findAssessmentDTO').mockResolvedValue(assessment(over.assessment));
    jest.spyOn(CbtRepository.Instance, 'questionsByIds').mockResolvedValue(over.questions ?? [question()]);
    return jest.spyOn(CbtRepository.Instance, 'updateAttempt').mockResolvedValue(undefined);
  }

  it('marks a multiple-choice answer and reports the working', async () => {
    stub();
    const result = await CbtService.Instance.submitAttempt(pupil(), 'attempt-1', {
      assessmentId: 'paper-1',
      answers: [{ questionId: 'q1', answer: 'b' }],
    });
    expect(result).toMatchObject({ score: 2, totalMarks: 2, percentage: 100, passed: true, correctCount: 1, unansweredCount: 0 });
    expect(result.breakdown[0]).toMatchObject({ isCorrect: true, yourAnswer: 'B. 4', correctAnswer: 'B. 4', explanation: 'Two and two make four.' });
  });

  it('ignores case and stray spaces on a short answer', async () => {
    stub({ questions: [question({ type: 'SHORT_ANSWER', options: [], correctAnswer: 'Abuja', marks: 3 })], attempt: { totalMarks: 3 } });
    const result = await CbtService.Instance.submitAttempt(pupil(), 'attempt-1', {
      assessmentId: 'paper-1',
      answers: [{ questionId: 'q1', answer: '  abuja ' }],
    });
    expect(result).toMatchObject({ score: 3, correctCount: 1 });
  });

  it('ignores answers that arrive after time is up, marking what was already saved', async () => {
    const save = stub({
      attempt: { expiresAt: new Date(Date.now() - 1_000), answers: { q1: 'a' } },
    });
    const result = await CbtService.Instance.submitAttempt(pupil(), 'attempt-1', {
      assessmentId: 'paper-1',
      answers: [{ questionId: 'q1', answer: 'b' }],
    });
    expect(result).toMatchObject({ score: 0, correctCount: 1 - 1, wrongCount: 1 });
    expect(save).toHaveBeenCalledWith('school-1', 'attempt-1', expect.objectContaining({ answers: { q1: 'a' } }));
  });

  it('withholds the answer key when the paper does not release results immediately', async () => {
    stub({ assessment: { showResultImmediately: false } });
    const result = await CbtService.Instance.submitAttempt(pupil(), 'attempt-1', {
      assessmentId: 'paper-1',
      answers: [{ questionId: 'q1', answer: 'b' }],
    });
    expect(result.score).toBe(2);
    expect(result.breakdown).toEqual([]);
  });

  it("is a 404 for somebody else's attempt", async () => {
    stub();
    await expect(
      CbtService.Instance.submitAttempt(pupil('child-b'), 'attempt-1', { assessmentId: 'paper-1', answers: [] }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses a second submission', async () => {
    stub({ attempt: { status: 'GRADED' } });
    await expect(
      CbtService.Instance.submitAttempt(pupil(), 'attempt-1', { assessmentId: 'paper-1', answers: [] }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('CbtService.startAttempt', () => {
  afterEach(() => jest.restoreAllMocks());

  it('refuses a paper set for another class', async () => {
    jest.spyOn(CbtRepository.Instance, 'findAssessmentDTO').mockResolvedValue(assessment({ classIds: ['class-z'] }));
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({ classIds: ['class-a'], subjectIds: [], pairs: null });
    await expect(CbtService.Instance.startAttempt(pupil(), 'paper-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses a member of staff, who has no candidate record', async () => {
    const staff = { ...pupil(), membership: { staffId: 'staff-1', studentId: null, guardianId: null, roles: [], customRoleNames: [] } } as unknown as RequestContext;
    await expect(CbtService.Instance.startAttempt(staff, 'paper-1')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('cbt validators', () => {
  const wrap = (body: unknown) => ({ body, query: {}, params: {} });
  const base = { subjectId: '11111111-1111-4111-8111-111111111111', text: 'Q', marks: 1 };

  it('refuses a question nobody could mark', () => {
    expect(createQuestionSchema.safeParse(wrap({ ...base, type: 'SHORT_ANSWER' })).success).toBe(false);
    expect(createQuestionSchema.safeParse(wrap({ ...base, type: 'SHORT_ANSWER', correctAnswer: 'Abuja' })).success).toBe(true);
    expect(
      createQuestionSchema.safeParse(wrap({ ...base, type: 'MULTIPLE_CHOICE', options: [{ id: 'a', label: 'A', text: '1', isCorrect: true }] })).success,
    ).toBe(false);
    expect(
      createQuestionSchema.safeParse(
        wrap({
          ...base,
          type: 'MULTIPLE_CHOICE',
          options: [
            { id: 'a', label: 'A', text: '1', isCorrect: true },
            { id: 'b', label: 'B', text: '2', isCorrect: true },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('accepts a blank answer on submission — an unanswered question is a real answer', () => {
    const result = submitAttemptSchema.safeParse({
      params: { attemptId: '33333333-3333-4333-8333-333333333333' },
      query: {},
      body: {
        assessmentId: '11111111-1111-4111-8111-111111111111',
        answers: [{ questionId: '22222222-2222-4222-8222-222222222222', answer: null }],
      },
    });
    expect(result.success).toBe(true);
  });
});
