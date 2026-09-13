import { CurriculumService } from '../services/curriculum.service';
import { CurriculumRepository } from '../repositories/curriculum.repository';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { SubjectRepository } from '../../academics/repositories/subject.repository';
import { SessionRepository } from '../../academics/repositories/session.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AcademicScopeService, type AcademicScope } from '../../academics/services/academicScope.service';
import { AuditService } from '../../audit/services/audit.service';
import type { RequestContext } from '../../../shared/types/context';
import type { CurriculumDTO, CurriculumTopicDTO } from '../dto/curriculum.dto';

/**
 * The rules with teeth (spec section 13): who sees which plan, who may
 * delete one, one plan per class/subject/session, and nothing assessed before
 * it is taught.
 */

const UNRESTRICTED: AcademicScope = { classIds: null, subjectIds: null, pairs: null };

const context = (over: { userId?: string; permissions?: string[]; roles?: string[] } = {}) =>
  ({
    schoolId: 'school-1',
    user: { id: over.userId ?? 'user-1', displayName: 'Mrs Bello' },
    membership: {
      staffId: 'staff-1',
      guardianId: null,
      studentId: null,
      roles: over.roles ?? ['TEACHER'],
      customRoleNames: [],
    },
    can: (permission: string) => (over.permissions ?? ['curriculum.read', 'curriculum.manage']).includes(permission),
    requestId: 'req-1',
    ipAddress: null,
    userAgent: null,
  }) as unknown as RequestContext;

const curriculum = (over: Partial<CurriculumDTO> = {}): CurriculumDTO => ({
  id: 'cur-1',
  schoolId: 'school-1',
  name: 'Mathematics — JSS 1 Gold',
  subjectId: 'subject-maths',
  subjectName: 'Mathematics',
  classId: 'class-a',
  className: 'JSS 1 Gold',
  levelId: 'level-jss1',
  levelName: 'JSS 1',
  sessionId: 'session-1',
  sessionName: '2026/2027',
  description: null,
  topicCount: 0,
  objectiveCount: 0,
  isActive: true,
  createdById: 'user-1',
  createdByName: 'Mrs Bello',
  createdByRole: 'TEACHER',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const teachesMathsInClassA: AcademicScope = {
  classIds: ['class-a'],
  subjectIds: ['subject-maths'],
  pairs: [{ classId: 'class-a', subjectId: 'subject-maths' }],
};

describe('CurriculumService visibility', () => {
  afterEach(() => jest.restoreAllMocks());

  it('a teacher opens a plan for a pair they teach', async () => {
    jest.spyOn(CurriculumRepository.Instance, 'findOneDTO').mockResolvedValue(curriculum({ createdById: 'someone-else' }));
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue(teachesMathsInClassA);
    const tree = jest.spyOn(CurriculumRepository.Instance, 'topicsWithObjectives').mockResolvedValue([]);

    await expect(CurriculumService.Instance.fetchTopics(context(), 'cur-1')).resolves.toEqual([]);
    expect(tree).toHaveBeenCalledWith('school-1', 'cur-1');
  });

  it('a teacher opens a plan they wrote even after losing the assignment', async () => {
    jest.spyOn(CurriculumRepository.Instance, 'findOneDTO').mockResolvedValue(curriculum({ createdById: 'user-1' }));
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({
      classIds: [],
      subjectIds: [],
      pairs: [],
    });
    jest.spyOn(CurriculumRepository.Instance, 'topicsWithObjectives').mockResolvedValue([]);

    await expect(CurriculumService.Instance.fetchTopics(context(), 'cur-1')).resolves.toEqual([]);
  });

  it("a teacher cannot see a colleague's plan for a pair they do not teach — 404, not 403", async () => {
    jest.spyOn(CurriculumRepository.Instance, 'findOneDTO').mockResolvedValue(curriculum({ createdById: 'someone-else' }));
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({
      classIds: ['class-b'],
      subjectIds: ['subject-maths'],
      // Teaches maths, and teaches class B — but not maths to class A.
      pairs: [{ classId: 'class-b', subjectId: 'subject-maths' }],
    });

    await expect(CurriculumService.Instance.fetchTopics(context(), 'cur-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('lists only the current session unless asked otherwise, and nothing when there is none', async () => {
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue(UNRESTRICTED);
    const sessions = jest.spyOn(SessionRepository.Instance, 'fetchForSchool');
    const fetchAll = jest.spyOn(CurriculumRepository.Instance, 'fetchAll').mockResolvedValue([]);

    sessions.mockResolvedValue([{ id: 'session-1', isCurrent: true } as never]);
    await CurriculumService.Instance.fetchCurricula(context(), {});
    expect(fetchAll).toHaveBeenLastCalledWith('school-1', expect.objectContaining({ sessionId: 'session-1' }));

    await CurriculumService.Instance.fetchCurricula(context(), { sessionId: 'ALL' });
    expect(fetchAll).toHaveBeenLastCalledWith('school-1', expect.objectContaining({ sessionId: undefined }));

    sessions.mockResolvedValue([]);
    fetchAll.mockClear();
    await expect(CurriculumService.Instance.fetchCurricula(context(), {})).resolves.toEqual([]);
    expect(fetchAll).not.toHaveBeenCalled();
  });
});

describe('CurriculumService.createCurriculum', () => {
  afterEach(() => jest.restoreAllMocks());

  function stub() {
    jest.spyOn(ClassRepository.Instance, 'findOneDTO').mockResolvedValue({
      id: 'class-a',
      name: 'JSS 1 Gold',
      levelId: 'level-jss1',
    } as never);
    jest.spyOn(SubjectRepository.Instance, 'findOneDTO').mockResolvedValue({
      id: 'subject-maths',
      name: 'Mathematics',
    } as never);
    jest.spyOn(SessionRepository.Instance, 'fetchForSchool').mockResolvedValue([
      { id: 'session-1', isCurrent: true } as never,
    ]);
    jest.spyOn(AuditService.Instance, 'record').mockResolvedValue(undefined);
  }

  it('files the plan under the current session, derives the level, and stamps the author', async () => {
    stub();
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue(teachesMathsInClassA);
    jest.spyOn(CurriculumRepository.Instance, 'findByTrio').mockResolvedValue(null);
    const create = jest.spyOn(CurriculumRepository.Instance, 'create').mockResolvedValue({ id: 'cur-1' } as never);
    jest.spyOn(CurriculumRepository.Instance, 'findOneDTO').mockResolvedValue(curriculum());

    await CurriculumService.Instance.createCurriculum(context(), {
      classId: 'class-a',
      subjectId: 'subject-maths',
      description: null,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        levelId: 'level-jss1',
        name: 'Mathematics — JSS 1 Gold',
        createdByUserId: 'user-1',
        createdByName: 'Mrs Bello',
        createdByRole: 'TEACHER',
      }),
    );
  });

  it('refuses a second plan for the same class, subject and session', async () => {
    stub();
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue(UNRESTRICTED);
    jest.spyOn(CurriculumRepository.Instance, 'findByTrio').mockResolvedValue({ id: 'cur-existing' } as never);

    await expect(
      CurriculumService.Instance.createCurriculum(context(), {
        classId: 'class-a',
        subjectId: 'subject-maths',
        description: null,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('refuses a teacher writing a plan for a pair they are not assigned', async () => {
    stub();
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({
      classIds: ['class-b'],
      subjectIds: ['subject-maths'],
      pairs: [{ classId: 'class-b', subjectId: 'subject-maths' }],
    });

    await expect(
      CurriculumService.Instance.createCurriculum(context(), {
        classId: 'class-a',
        subjectId: 'subject-maths',
        description: null,
      }),
    ).rejects.toMatchObject({ statusCode: 422, message: 'You are not assigned Mathematics in JSS 1 Gold.' });
  });

  it('refuses when the school has no current session', async () => {
    stub();
    jest.spyOn(SessionRepository.Instance, 'fetchForSchool').mockResolvedValue([]);
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue(UNRESTRICTED);

    await expect(
      CurriculumService.Instance.createCurriculum(context(), {
        classId: 'class-a',
        subjectId: 'subject-maths',
        description: null,
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('CurriculumService.removeCurriculum', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lets the author delete their own plan, and an administrator delete anyone’s', async () => {
    jest.spyOn(CurriculumRepository.Instance, 'findOneDTO').mockResolvedValue(curriculum({ createdById: 'user-1' }));
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue(UNRESTRICTED);
    jest.spyOn(AuditService.Instance, 'record').mockResolvedValue(undefined);
    const remove = jest.spyOn(CurriculumRepository.Instance, 'remove').mockResolvedValue(true);

    await CurriculumService.Instance.removeCurriculum(context({ userId: 'user-1' }), 'cur-1');
    await CurriculumService.Instance.removeCurriculum(
      context({ userId: 'admin', permissions: ['curriculum.manage', 'academics.manage'] }),
      'cur-1',
    );
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("refuses a colleague deleting somebody else's plan", async () => {
    jest.spyOn(CurriculumRepository.Instance, 'findOneDTO').mockResolvedValue(curriculum({ createdById: 'user-1' }));
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue(UNRESTRICTED);
    const remove = jest.spyOn(CurriculumRepository.Instance, 'remove');

    await expect(
      CurriculumService.Instance.removeCurriculum(context({ userId: 'user-2' }), 'cur-1'),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('CurriculumService.fetchCoverage', () => {
  afterEach(() => jest.restoreAllMocks());

  it('counts taught, assessed, the gap between them, and what was never taught', async () => {
    jest.spyOn(CurriculumRepository.Instance, 'findOneDTO').mockResolvedValue(curriculum());
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue(UNRESTRICTED);
    jest.spyOn(TermRepository.Instance, 'fetchForSchool').mockResolvedValue([
      { id: 'term-1', name: 'First term', sessionName: '2026/2027', isCurrent: true } as never,
    ]);
    const objective = (id: string, taught: boolean, assessed: boolean) => ({
      id,
      topicId: 'topic-1',
      code: `1.${id}`,
      statement: `Objective ${id}`,
      sequence: 1,
      bloomLevel: null,
      taught,
      assessed,
      taughtOn: taught ? '2026-09-10' : null,
    });
    jest.spyOn(CurriculumRepository.Instance, 'topicsWithObjectives').mockResolvedValue([
      {
        id: 'topic-1',
        curriculumId: 'cur-1',
        title: 'Numbers',
        description: null,
        sequence: 1,
        suggestedWeeks: 2,
        objectives: [
          objective('a', true, true),
          objective('b', true, false),
          objective('c', true, false),
          objective('d', false, false),
        ],
      } satisfies CurriculumTopicDTO,
    ]);

    const report = await CurriculumService.Instance.fetchCoverage(context(), { curriculumId: 'cur-1' });

    expect(report).toMatchObject({
      termName: 'First term, 2026/2027',
      totalObjectives: 4,
      taughtCount: 3,
      assessedCount: 1,
      taughtNotAssessed: 2,
      neverTaught: 1,
      coverageRate: 75,
      assessmentRate: 25,
    });
    expect(report.cells).toHaveLength(4);
  });
});
