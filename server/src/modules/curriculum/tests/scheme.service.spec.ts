import { SchemeService, allocateWeeks, layOutWeeks } from '../services/scheme.service';
import { SchemeRepository } from '../repositories/scheme.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { CurriculumRepository } from '../repositories/curriculum.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AuditService } from '../../audit/services/audit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import type { RequestContext } from '../../../shared/types/context';
import type { TermDTO } from '../../academics/dto/academics.dto';
import type { CurriculumTopicDTO } from '../dto/curriculum.dto';
import type { LessonNoteDTO, SchemeOfWorkDTO } from '../dto/scheme.dto';

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

  it('an admin who returned the note may not edit it afterwards, even holding academics.manage', async () => {
    jest
      .spyOn(SchemeRepository.Instance, 'findNoteDTO')
      .mockResolvedValue(note({ teacherId: 'staff-2', status: 'RETURNED' }));
    await expect(
      SchemeService.Instance.updateLessonNote(
        context({ staffId: 'staff-1', permissions: ['lessonnote.approve', 'academics.manage'] }),
        'note-1',
        { content: 'Rewritten by the admin.' },
        1,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('the author may still edit their own note once it is returned to them', async () => {
    jest
      .spyOn(SchemeRepository.Instance, 'findNoteDTO')
      .mockResolvedValue(note({ teacherId: 'staff-1', status: 'RETURNED' }));
    const update = jest.spyOn(SchemeRepository.Instance, 'updateNoteIfVersionMatches').mockResolvedValue(true);

    await SchemeService.Instance.updateLessonNote(
      context({ staffId: 'staff-1' }),
      'note-1',
      { content: 'Fixed per the review comment.' },
      1,
    );

    expect(update).toHaveBeenCalledWith(
      'school-1',
      'note-1',
      1,
      expect.objectContaining({ content: 'Fixed per the review comment.' }),
    );
  });

  it('returning a submitted note stamps the reviewer and keeps the comment', async () => {
    jest.spyOn(SchemeRepository.Instance, 'findNoteDTO').mockResolvedValue(note({ teacherId: 'staff-2', status: 'SUBMITTED' }));
    const update = jest.spyOn(SchemeRepository.Instance, 'updateNoteIfVersionMatches').mockResolvedValue(true);
    jest.spyOn(StaffRepository.Instance, 'findByIdScoped').mockResolvedValue(null);

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

describe('SchemeService.updateLessonNote notifications', () => {
  afterEach(() => jest.restoreAllMocks());

  const context = (over: { staffId?: string | null; userId?: string; permissions?: string[] } = {}) =>
    ({
      schoolId: 'school-1',
      user: { id: over.userId ?? 'user-1', displayName: 'Mrs Bello' },
      membership: { staffId: over.staffId ?? 'staff-1', guardianId: null, studentId: null, roles: [], customRoleNames: [] },
      can: (permission: string) => (over.permissions ?? ['lessonnote.read', 'lessonnote.manage']).includes(permission),
      requestId: 'req-1',
      ipAddress: null,
      userAgent: null,
    }) as unknown as RequestContext;

  const note = (over: Partial<LessonNoteDTO> = {}): LessonNoteDTO =>
    ({
      id: 'note-1',
      teacherId: 'staff-2',
      subjectName: 'Mathematics',
      className: 'JSS 1',
      topic: 'Fractions',
      status: 'DRAFT',
      version: 1,
      ...over,
    }) as LessonNoteDTO;

  it('notifies people who can review when a note is submitted', async () => {
    jest
      .spyOn(SchemeRepository.Instance, 'findNoteDTO')
      .mockResolvedValueOnce(note({ teacherId: 'staff-1', status: 'DRAFT' }))
      .mockResolvedValueOnce(note({ teacherId: 'staff-1', status: 'SUBMITTED' }));
    jest.spyOn(SchemeRepository.Instance, 'updateNoteIfVersionMatches').mockResolvedValue(true);
    const notifyAdmins = jest
      .spyOn(NotificationsService.Instance, 'notifySchoolAdmins')
      .mockResolvedValue(undefined);
    const notifyUser = jest.spyOn(NotificationsService.Instance, 'notifyUser').mockResolvedValue(undefined);

    await SchemeService.Instance.updateLessonNote(
      context({ staffId: 'staff-1', userId: 'teacher-1' }),
      'note-1',
      { status: 'SUBMITTED' },
      1,
    );

    expect(notifyAdmins).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        category: 'SYSTEM',
        title: 'Lesson note submitted for review',
        entityType: 'LessonNote',
        entityId: 'note-1',
        exceptUserId: 'teacher-1',
      }),
    );
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("notifies the note's author, resolved from their staff record, when it is approved", async () => {
    jest
      .spyOn(SchemeRepository.Instance, 'findNoteDTO')
      .mockResolvedValueOnce(note({ status: 'SUBMITTED' }))
      .mockResolvedValueOnce(note({ status: 'APPROVED' }));
    jest.spyOn(SchemeRepository.Instance, 'updateNoteIfVersionMatches').mockResolvedValue(true);
    jest
      .spyOn(StaffRepository.Instance, 'findByIdScoped')
      .mockResolvedValue({ userId: 'teacher-user-1' } as never);
    const notifyUser = jest.spyOn(NotificationsService.Instance, 'notifyUser').mockResolvedValue(undefined);
    const notifyAdmins = jest
      .spyOn(NotificationsService.Instance, 'notifySchoolAdmins')
      .mockResolvedValue(undefined);

    await SchemeService.Instance.updateLessonNote(
      context({ staffId: null, userId: 'reviewer-1', permissions: ['lessonnote.approve'] }),
      'note-1',
      { status: 'APPROVED' },
      1,
    );

    expect(notifyUser).toHaveBeenCalledWith(
      'school-1',
      'teacher-user-1',
      expect.objectContaining({
        category: 'SYSTEM',
        title: 'Lesson note approved',
        severity: 'SUCCESS',
        entityType: 'LessonNote',
        entityId: 'note-1',
        exceptUserId: 'reviewer-1',
      }),
    );
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('carries the review comment into the notification when a note is returned', async () => {
    jest
      .spyOn(SchemeRepository.Instance, 'findNoteDTO')
      .mockResolvedValueOnce(note({ status: 'SUBMITTED' }))
      .mockResolvedValueOnce(note({ status: 'RETURNED' }));
    jest.spyOn(SchemeRepository.Instance, 'updateNoteIfVersionMatches').mockResolvedValue(true);
    jest
      .spyOn(StaffRepository.Instance, 'findByIdScoped')
      .mockResolvedValue({ userId: 'teacher-user-1' } as never);
    const notifyUser = jest.spyOn(NotificationsService.Instance, 'notifyUser').mockResolvedValue(undefined);

    await SchemeService.Instance.updateLessonNote(
      context({ staffId: null, userId: 'reviewer-1', permissions: ['lessonnote.approve'] }),
      'note-1',
      { status: 'RETURNED', reviewComment: 'Add the assignment.' },
      1,
    );

    expect(notifyUser).toHaveBeenCalledWith(
      'school-1',
      'teacher-user-1',
      expect.objectContaining({
        title: 'Lesson note returned for changes',
        severity: 'WARNING',
        body: expect.stringContaining('Add the assignment.'),
      }),
    );
  });

  it('skips the notification rather than throwing when the author has no linked user account', async () => {
    jest
      .spyOn(SchemeRepository.Instance, 'findNoteDTO')
      .mockResolvedValueOnce(note({ status: 'SUBMITTED' }))
      .mockResolvedValueOnce(note({ status: 'APPROVED' }));
    jest.spyOn(SchemeRepository.Instance, 'updateNoteIfVersionMatches').mockResolvedValue(true);
    jest.spyOn(StaffRepository.Instance, 'findByIdScoped').mockResolvedValue({ userId: null } as never);
    const notifyUser = jest.spyOn(NotificationsService.Instance, 'notifyUser').mockResolvedValue(undefined);

    await expect(
      SchemeService.Instance.updateLessonNote(
        context({ staffId: null, userId: 'reviewer-1', permissions: ['lessonnote.approve'] }),
        'note-1',
        { status: 'APPROVED' },
        1,
      ),
    ).resolves.toBeDefined();

    expect(notifyUser).not.toHaveBeenCalled();
  });
});

describe('SchemeService.updateScheme notifications', () => {
  afterEach(() => jest.restoreAllMocks());

  const scheme = (over: Partial<SchemeOfWorkDTO> = {}): SchemeOfWorkDTO =>
    ({
      id: 'scheme-1',
      schoolId: 'school-1',
      subjectId: 'subject-1',
      subjectName: 'Mathematics',
      classId: 'class-1',
      className: 'JSS 1',
      termId: 'term-1',
      termName: 'First Term',
      sessionName: '2026/2027',
      curriculumId: 'cur-1',
      status: 'DRAFT',
      weeks: [],
      createdById: 'teacher-1',
      createdByName: 'Mr Teacher',
      approvedByName: null,
      approvedAt: null,
      version: 1,
      ...over,
    }) as SchemeOfWorkDTO;

  const context = (over: { userId?: string; permissions?: string[] } = {}) =>
    ({
      schoolId: 'school-1',
      user: { id: over.userId ?? 'teacher-1', displayName: 'Mrs Bello' },
      membership: { staffId: 'staff-1', guardianId: null, studentId: null, roles: [], customRoleNames: [] },
      can: (permission: string) => (over.permissions ?? []).includes(permission),
      requestId: 'req-1',
      ipAddress: null,
      userAgent: null,
    }) as unknown as RequestContext;

  beforeEach(() => {
    jest.spyOn(AcademicScopeService.Instance, 'forContext').mockResolvedValue({
      classIds: null,
      subjectIds: null,
      pairs: null,
    } as never);
    jest
      .spyOn(AppDataSource, 'transaction')
      .mockImplementation(((run: (manager: unknown) => unknown) => run({})) as typeof AppDataSource.transaction);
    jest.spyOn(SchemeRepository.Instance, 'saveWeeksIfVersionMatches').mockResolvedValue(true);
    jest.spyOn(AuditService.Instance, 'record').mockResolvedValue(undefined as never);
  });

  it('notifies school admins when a draft is submitted for approval', async () => {
    jest
      .spyOn(SchemeRepository.Instance, 'findOneDTO')
      .mockResolvedValueOnce(scheme({ status: 'DRAFT' }))
      .mockResolvedValueOnce(scheme({ status: 'SUBMITTED' }));
    const notifyAdmins = jest
      .spyOn(NotificationsService.Instance, 'notifySchoolAdmins')
      .mockResolvedValue(undefined);
    const notifyUser = jest.spyOn(NotificationsService.Instance, 'notifyUser').mockResolvedValue(undefined);

    await SchemeService.Instance.updateScheme(
      context({ userId: 'teacher-1' }),
      'scheme-1',
      { status: 'SUBMITTED' },
      1,
    );

    expect(notifyAdmins).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        category: 'SYSTEM',
        title: 'Scheme of work submitted for approval',
        entityType: 'SchemeOfWork',
        entityId: 'scheme-1',
        exceptUserId: 'teacher-1',
      }),
    );
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("notifies the scheme's author when it is approved", async () => {
    jest
      .spyOn(SchemeRepository.Instance, 'findOneDTO')
      .mockResolvedValueOnce(scheme({ status: 'SUBMITTED', createdById: 'teacher-1' }))
      .mockResolvedValueOnce(scheme({ status: 'APPROVED', createdById: 'teacher-1' }));
    const notifyUser = jest.spyOn(NotificationsService.Instance, 'notifyUser').mockResolvedValue(undefined);
    const notifyAdmins = jest
      .spyOn(NotificationsService.Instance, 'notifySchoolAdmins')
      .mockResolvedValue(undefined);

    await SchemeService.Instance.updateScheme(
      context({ userId: 'principal-1', permissions: ['scheme.approve'] }),
      'scheme-1',
      { status: 'APPROVED' },
      1,
    );

    expect(notifyUser).toHaveBeenCalledWith(
      'school-1',
      'teacher-1',
      expect.objectContaining({
        category: 'SYSTEM',
        title: 'Scheme of work approved',
        severity: 'SUCCESS',
        entityType: 'SchemeOfWork',
        entityId: 'scheme-1',
      }),
    );
    expect(notifyAdmins).not.toHaveBeenCalled();
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
