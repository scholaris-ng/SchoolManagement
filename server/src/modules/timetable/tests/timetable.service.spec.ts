import { TimetableService } from '../services/timetable.service';
import { TimetableEntryRepository, type SlotClashRow } from '../repositories/timetableEntry.repository';
import { PeriodRepository, RoomRepository } from '../../academics/repositories/facility.repository';
import { ClassRepository } from '../../academics/repositories/class.repository';
import { SubjectRepository } from '../../academics/repositories/subject.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import { AuditService } from '../../audit/services/audit.service';
import type { RequestContext } from '../../../shared/types/context';
import type { TimetableEntryDTO } from '../dto/timetable.dto';

/**
 * Clash detection (spec section 16): a class, a teacher and a room can each be
 * in one place per period, and a refusal names the lesson it collided with.
 */

const context = (membership: Partial<RequestContext['membership']> = {}) =>
  ({
    schoolId: 'school-1',
    user: { id: 'user-1', displayName: 'Admin' },
    membership: {
      staffId: null,
      guardianId: null,
      studentId: null,
      roles: ['SCHOOL_ADMIN'],
      customRoleNames: [],
      ...membership,
    },
    can: () => true,
    requestId: 'req-1',
    ipAddress: null,
    userAgent: null,
  }) as unknown as RequestContext;

const input = {
  classId: 'class-a',
  subjectId: 'subject-maths',
  teacherId: 'teacher-1',
  roomId: 'room-1' as string | null,
  periodId: 'period-1',
  day: 'MONDAY' as const,
};

const occupant = (over: Partial<SlotClashRow>): SlotClashRow => ({
  id: 'existing-1',
  classId: 'class-b',
  className: 'JSS 1 Silver',
  teacherId: 'teacher-2',
  teacherName: 'Mrs Bello',
  roomId: 'room-2',
  roomName: 'Lab 2',
  subjectName: 'English',
  ...over,
});

const savedEntry = (over: Partial<TimetableEntryDTO> = {}): TimetableEntryDTO => ({
  id: 'entry-1',
  schoolId: 'school-1',
  timetableId: 'term-1',
  classId: 'class-a',
  className: 'JSS 1 Gold',
  subjectId: 'subject-maths',
  subjectName: 'Mathematics',
  teacherId: 'teacher-1',
  teacherName: 'Mr Okafor',
  roomId: 'room-1',
  roomName: 'Room 1',
  periodId: 'period-1',
  periodName: 'Period 1',
  startTime: '08:00',
  endTime: '08:40',
  day: 'MONDAY',
  ...over,
});

function stubLookups(options: { isBreak?: boolean; occupants?: SlotClashRow[] } = {}) {
  jest.spyOn(TermRepository.Instance, 'findOneDTO').mockResolvedValue({
    id: 'term-1',
    name: 'First term',
    sessionName: '2026/2027',
  } as never);
  jest.spyOn(PeriodRepository.Instance, 'findOneDTO').mockResolvedValue({
    id: 'period-1',
    name: 'Period 1',
    isBreak: options.isBreak ?? false,
  } as never);
  jest.spyOn(ClassRepository.Instance, 'findOneDTO').mockResolvedValue({ id: 'class-a' } as never);
  jest.spyOn(SubjectRepository.Instance, 'findOneDTO').mockResolvedValue({ id: 'subject-maths' } as never);
  jest.spyOn(StaffRepository.Instance, 'existsScoped').mockResolvedValue(true);
  jest.spyOn(RoomRepository.Instance, 'findOneDTO').mockResolvedValue({ id: 'room-1' } as never);
  jest.spyOn(TimetableEntryRepository.Instance, 'lessonsInSlot').mockResolvedValue(
    options.occupants ?? [],
  );
  jest.spyOn(AuditService.Instance, 'record').mockResolvedValue(undefined);
}

describe('TimetableService.saveEntry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refuses a lesson in a break period', async () => {
    stubLookups({ isBreak: true });
    const place = jest.spyOn(TimetableEntryRepository.Instance, 'place');

    await expect(
      TimetableService.Instance.saveEntry(context(), 'term-1', input),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(place).not.toHaveBeenCalled();
  });

  it('names the class clash', async () => {
    stubLookups({ occupants: [occupant({ classId: 'class-a', className: 'JSS 1 Gold' })] });

    await expect(
      TimetableService.Instance.saveEntry(context(), 'term-1', input),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'JSS 1 Gold already has English with Mrs Bello on Monday in Period 1.',
    });
  });

  it('names the teacher clash', async () => {
    stubLookups({ occupants: [occupant({ teacherId: 'teacher-1', teacherName: 'Mr Okafor' })] });

    await expect(
      TimetableService.Instance.saveEntry(context(), 'term-1', input),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Mr Okafor is already teaching English to JSS 1 Silver on Monday in Period 1.',
    });
  });

  it('names the room clash, and only when a room was asked for', async () => {
    stubLookups({ occupants: [occupant({ roomId: 'room-1', roomName: 'Room 1' })] });

    await expect(
      TimetableService.Instance.saveEntry(context(), 'term-1', input),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Room 1 is already being used by JSS 1 Silver for English on Monday in Period 1.',
    });

    // The same slot, but the new lesson has no room: nothing to clash with.
    jest.spyOn(TimetableEntryRepository.Instance, 'place').mockResolvedValue({ id: 'entry-1' } as never);
    jest.spyOn(TimetableEntryRepository.Instance, 'findOneDTO').mockResolvedValue(savedEntry({ roomId: null, roomName: null }));
    await expect(
      TimetableService.Instance.saveEntry(context(), 'term-1', { ...input, roomId: null }),
    ).resolves.toMatchObject({ id: 'entry-1' });
  });

  it('does not treat the lesson being moved as its own clash', async () => {
    stubLookups({
      occupants: [occupant({ id: 'entry-1', classId: 'class-a', teacherId: 'teacher-1', roomId: 'room-1' })],
    });
    const findOne = jest
      .spyOn(TimetableEntryRepository.Instance, 'findOneDTO')
      .mockResolvedValue(savedEntry({ day: 'TUESDAY' }));
    const move = jest.spyOn(TimetableEntryRepository.Instance, 'move').mockResolvedValue(true);
    const place = jest.spyOn(TimetableEntryRepository.Instance, 'place');

    const result = await TimetableService.Instance.saveEntry(context(), 'term-1', {
      ...input,
      entryId: 'entry-1',
      day: 'TUESDAY',
    });

    expect(move).toHaveBeenCalledWith('school-1', 'entry-1', expect.objectContaining({ day: 'TUESDAY' }));
    expect(place).not.toHaveBeenCalled();
    expect(findOne).toHaveBeenCalled();
    expect(result.day).toBe('TUESDAY');
  });

  it('refuses to move a lesson that belongs to another term', async () => {
    stubLookups();
    jest
      .spyOn(TimetableEntryRepository.Instance, 'findOneDTO')
      .mockResolvedValue(savedEntry({ timetableId: 'term-other' }));

    await expect(
      TimetableService.Instance.saveEntry(context(), 'term-1', { ...input, entryId: 'entry-1' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('turns a unique-index race into a conflict rather than a 500', async () => {
    stubLookups();
    jest
      .spyOn(TimetableEntryRepository.Instance, 'place')
      .mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));

    await expect(
      TimetableService.Instance.saveEntry(context(), 'term-1', input),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('TimetableService.fetchCurrent', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function stubGrid() {
    jest.spyOn(PeriodRepository.Instance, 'fetchForSchool').mockResolvedValue([]);
    jest.spyOn(TermRepository.Instance, 'fetchForSchool').mockResolvedValue([
      { id: 'term-1', name: 'First term', sessionId: 'ses-1', sessionName: '2026/2027', isCurrent: true } as never,
    ]);
    return jest.spyOn(TimetableEntryRepository.Instance, 'fetchForTerm').mockResolvedValue([]);
  }

  it("uses the current term's id as the timetable id and reads the whole school for oversight roles", async () => {
    const fetch = stubGrid();
    jest.spyOn(AcademicScopeService.Instance, 'formTeacherClassIds').mockResolvedValue(null);

    const grid = await TimetableService.Instance.fetchCurrent(context(), { classId: 'class-a' });

    expect(grid.id).toBe('term-1');
    expect(fetch).toHaveBeenCalledWith('school-1', 'term-1', {
      classId: 'class-a',
      visibility: { classIds: null, ownTeacherId: null },
    });
  });

  it("narrows a teacher to their own lessons plus their form class", async () => {
    const fetch = stubGrid();
    jest.spyOn(AcademicScopeService.Instance, 'formTeacherClassIds').mockResolvedValue(['class-form']);

    await TimetableService.Instance.fetchCurrent(context({ staffId: 'teacher-1', roles: ['TEACHER'] }), {});

    expect(fetch).toHaveBeenCalledWith('school-1', 'term-1', {
      visibility: { classIds: ['class-form'], ownTeacherId: 'teacher-1' },
    });
  });

  it("narrows a parent to their children's classes", async () => {
    const fetch = stubGrid();
    jest.spyOn(AcademicScopeService.Instance, 'formTeacherClassIds').mockResolvedValue(null);
    jest
      .spyOn(AcademicScopeService.Instance, 'forContext')
      .mockResolvedValue({ classIds: ['class-child'], subjectIds: [], pairs: null });

    await TimetableService.Instance.fetchCurrent(context({ guardianId: 'g-1', roles: ['PARENT'] }), {});

    expect(fetch).toHaveBeenCalledWith('school-1', 'term-1', {
      visibility: { classIds: ['class-child'], ownTeacherId: null },
    });
  });

  it('says so when the school has no current term', async () => {
    jest.spyOn(PeriodRepository.Instance, 'fetchForSchool').mockResolvedValue([]);
    jest.spyOn(TermRepository.Instance, 'fetchForSchool').mockResolvedValue([]);
    jest.spyOn(AcademicScopeService.Instance, 'formTeacherClassIds').mockResolvedValue(null);

    await expect(TimetableService.Instance.fetchCurrent(context(), {})).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
