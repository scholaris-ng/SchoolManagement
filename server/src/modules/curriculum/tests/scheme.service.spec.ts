import { SchemeService, allocateWeeks, layOutWeeks } from '../services/scheme.service';
import { SchemeRepository } from '../repositories/scheme.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { CurriculumRepository } from '../repositories/curriculum.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import type { RequestContext } from '../../../shared/types/context';
import type { TermDTO } from '../../academics/dto/academics.dto';
import type { CurriculumTopicDTO } from '../dto/curriculum.dto';
import type { LessonNoteDTO } from '../dto/scheme.dto';

describe('allocateWeeks', () => {
  it('gives every topic what it asked for when the term has room', () => {
    expect(allocateWeeks([3, 2, 4], 12)).toEqual([3, 2, 4]);
  });

  it('squeezes proportionally, never below a week, and hands rounding to the earliest topics', () => {
    expect(allocateWeeks([3, 2, 4], 4)).toEqual([2, 1, 1]);
    expect(allocateWeeks([4, 4], 4)).toEqual([2, 2]);
  });

  it('drops the last topics entirely when there are more topics than weeks', () => {
    expect(allocateWeeks([1, 1, 1, 1, 1], 3)).toEqual([1, 1, 1, 0, 0]);
  });
});

describe('layOutWeeks', () => {
  const term = {
    startDate: '2026-09-07',
    endDate: '2026-12-11',
    teachingWeeks: 0,
  } as TermDTO;

  const topic = (id: string, title: string, weeks: number, objectives: string[]): CurriculumTopicDTO => ({
    id,
    curriculumId: 'cur-1',
    title,
    description: null,
    sequence: 1,
    suggestedWeeks: weeks,
    objectives: objectives.map((statement, index) => ({
      id: `${id}-o${index}`,
      topicId: id,
      code: `1.${index + 1}`,
      statement,
      sequence: index + 1,
      bloomLevel: null,
      taught: false,
      assessed: false,
      taughtOn: null,
    })),
  });

  it('derives the week count from the dates when no teaching weeks are set, and fills the tail with revision', () => {
    const weeks = layOutWeeks(term, [topic('t1', 'Numbers', 2, ['a', 'b', 'c'])]);
    expect(weeks).toHaveLength(14);
    expect(weeks[0]).toMatchObject({ weekNumber: 1, startDate: '2026-09-07', endDate: '2026-09-13', topicTitle: 'Numbers (1/2)' });
    expect(weeks[1].objectiveStatements).toEqual(['c']);
    expect(weeks[0].objectiveStatements).toEqual(['a', 'b']);
    expect(weeks[2].topicTitle).toBe('Revision');
    expect(weeks[13]).toMatchObject({ topicTitle: 'Revision and examinations', endDate: '2026-12-11' });
  });

  it('never runs a week past the end of the term', () => {
    const short = { ...term, endDate: '2026-09-10', teachingWeeks: 1 } as TermDTO;
    const [only] = layOutWeeks(short, [topic('t1', 'Numbers', 1, [])]);
    expect(only).toMatchObject({ startDate: '2026-09-07', endDate: '2026-09-10' });
  });
});

describe('SchemeService.updateLessonNote status rules', () => {
  afterEach(() => jest.restoreAllMocks());

  const context = (over: { staffId?: string | null; permissions?: string[] }) =>
    ({
      schoolId: 'school-1',
      user: { id: 'user-1', displayName: 'Mrs Bello' },
      membership: { staffId: over.staffId ?? 'staff-1', guardianId: null, studentId: null, roles: [], customRoleNames: [] },
      can: (permission: string) => (over.permissions ?? ['lessonnote.read', 'lessonnote.manage']).includes(permission),
      requestId: 'req-1',
      ipAddress: null,
      userAgent: null,
    }) as unknown as RequestContext;

  const note = (over: Partial<LessonNoteDTO>): LessonNoteDTO =>
    ({ id: 'note-1', teacherId: 'staff-1', status: 'DRAFT', version: 1, ...over }) as LessonNoteDTO;

  it("a colleague cannot see, let alone edit, another teacher's note", async () => {
    jest.spyOn(SchemeRepository.Instance, 'findNoteDTO').mockResolvedValue(note({ teacherId: 'staff-2' }));
    await expect(
      SchemeService.Instance.updateLessonNote(context({ staffId: 'staff-1' }), 'note-1', { content: 'x' }, 1),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a reviewer sees it but may not rewrite its content', async () => {
    jest.spyOn(SchemeRepository.Instance, 'findNoteDTO').mockResolvedValue(note({ teacherId: 'staff-2' }));
    await expect(
      SchemeService.Instance.updateLessonNote(
        context({ staffId: 'staff-1', permissions: ['lessonnote.approve'] }),
        'note-1',
        { content: 'x' },
        1,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returning a submitted note stamps the reviewer and keeps the comment', async () => {
    jest.spyOn(SchemeRepository.Instance, 'findNoteDTO').mockResolvedValue(note({ teacherId: 'staff-2', status: 'SUBMITTED' }));
    const update = jest.spyOn(SchemeRepository.Instance, 'updateNoteIfVersionMatches').mockResolvedValue(true);

    await SchemeService.Instance.updateLessonNote(
      context({ staffId: null, permissions: ['lessonnote.approve'] }),
      'note-1',
      { status: 'RETURNED', reviewComment: 'Add the assignment.' },
      1,
    );

    expect(update).toHaveBeenCalledWith(
      'school-1',
      'note-1',
      1,
      expect.objectContaining({ status: 'RETURNED', reviewerName: 'Mrs Bello', reviewComment: 'Add the assignment.' }),
    );
  });

  it('a stale version is a conflict', async () => {
    jest.spyOn(SchemeRepository.Instance, 'findNoteDTO').mockResolvedValue(note({}));
    jest.spyOn(SchemeRepository.Instance, 'updateNoteIfVersionMatches').mockResolvedValue(false);
    await expect(
      SchemeService.Instance.updateLessonNote(context({}), 'note-1', { content: 'x' }, 0),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('SchemeService.generateScheme', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is a 404 for a curriculum outside the teacher’s remit', async () => {
    jest.spyOn(CurriculumRepository.Instance, 'findOneDTO').mockResolvedValue({
      id: 'cur-1', classId: 'class-a', subjectId: 'subject-1', sessionId: 'ses-1', createdById: 'someone-else',
    } as never);
    jest.spyOn(TermRepository.Instance, 'findOneDTO').mockResolvedValue({ id: 'term-1', sessionId: 'ses-1' } as never);
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({ classIds: [], subjectIds: [], pairs: [] });

    await expect(
      SchemeService.Instance.generateScheme(
        {
          schoolId: 'school-1',
          user: { id: 'user-1', displayName: 'T' },
          membership: { staffId: 'staff-1', roles: ['TEACHER'], customRoleNames: [] },
          can: () => true,
        } as unknown as RequestContext,
        { curriculumId: 'cur-1', classId: 'class-a', termId: 'term-1' },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
