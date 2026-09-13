import { AttendanceService } from '../services/attendance.service';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import type { RequestContext } from '../../../shared/types/context';
import type { TermDTO } from '../../academics/dto/academics.dto';
import type { AttendanceRecordDTO } from '../dto/attendance.dto';

/**
 * The portal's attendance tab: one pupil's own history, for themselves or a
 * guardian — never a whole class's, which is what `attendance.manage` is for
 * (see the note on `attendance.routes.ts`).
 */

const contextFor = (schoolId = 'school-1') => ({ schoolId }) as unknown as RequestContext;

const term = (from: string, to: string, id = 'term-1'): TermDTO =>
  ({ id, isCurrent: true, startDate: from, endDate: to }) as TermDTO;

const record = (over: Partial<AttendanceRecordDTO>): AttendanceRecordDTO => ({
  id: 'rec-1',
  schoolId: 'school-1',
  studentId: 'child-a',
  studentName: 'Amara',
  admissionNo: 'A1',
  photoUrl: null,
  classId: 'class-1',
  date: '2026-01-05',
  status: 'PRESENT',
  reason: null,
  note: null,
  markedByName: 'Mrs Bello',
  markedAt: '2026-01-05T08:00:00.000Z',
  guardianNotifiedAt: null,
  ...over,
});

describe('AttendanceService.fetchStudentHistory', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refuses a guardian who cannot see this child, as a 404 not a 403', async () => {
    jest.spyOn(StudentAccessService.Instance, 'canSeeStudent').mockResolvedValue(false);
    const history = jest.spyOn(AttendanceRepository.Instance, 'historyForStudent');

    await expect(
      AttendanceService.Instance.fetchStudentHistory(contextFor(), 'child-a', {}),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(history).not.toHaveBeenCalled();
  });

  it('defaults the window to the current term when neither termId nor from/to is given', async () => {
    jest.spyOn(StudentAccessService.Instance, 'canSeeStudent').mockResolvedValue(true);
    jest
      .spyOn(TermRepository.Instance, 'fetchForSchool')
      .mockResolvedValue([term('2026-01-01', '2026-04-01')]);
    const history = jest
      .spyOn(AttendanceRepository.Instance, 'historyForStudent')
      .mockResolvedValue([]);

    const result = await AttendanceService.Instance.fetchStudentHistory(
      contextFor(),
      'child-a',
      {},
    );

    expect(history).toHaveBeenCalledWith('school-1', 'child-a', {
      from: '2026-01-01',
      to: '2026-04-01',
    });
    expect(result.summary).toMatchObject({
      studentId: 'child-a',
      from: '2026-01-01',
      to: '2026-04-01',
      totalDays: 0,
      attendanceRate: 0,
    });
  });

  it('resolves a named term to its own dates rather than the current one', async () => {
    jest.spyOn(StudentAccessService.Instance, 'canSeeStudent').mockResolvedValue(true);
    jest
      .spyOn(TermRepository.Instance, 'fetchForSchool')
      .mockResolvedValue([
        term('2026-01-01', '2026-04-01', 'term-current'),
        term('2025-09-01', '2025-12-01', 'term-past'),
      ]);
    const history = jest
      .spyOn(AttendanceRepository.Instance, 'historyForStudent')
      .mockResolvedValue([]);

    await AttendanceService.Instance.fetchStudentHistory(contextFor(), 'child-a', {
      termId: 'term-past',
    });

    expect(history).toHaveBeenCalledWith('school-1', 'child-a', {
      from: '2025-09-01',
      to: '2025-12-01',
    });
  });

  it('rejects a termId the school has no record of', async () => {
    jest.spyOn(StudentAccessService.Instance, 'canSeeStudent').mockResolvedValue(true);
    jest.spyOn(TermRepository.Instance, 'fetchForSchool').mockResolvedValue([]);

    await expect(
      AttendanceService.Instance.fetchStudentHistory(contextFor(), 'child-a', {
        termId: 'does-not-exist',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('an explicit from/to wins outright, without even reading the terms', async () => {
    jest.spyOn(StudentAccessService.Instance, 'canSeeStudent').mockResolvedValue(true);
    const terms = jest.spyOn(TermRepository.Instance, 'fetchForSchool');
    const history = jest
      .spyOn(AttendanceRepository.Instance, 'historyForStudent')
      .mockResolvedValue([]);

    await AttendanceService.Instance.fetchStudentHistory(contextFor(), 'child-a', {
      from: '2020-01-01',
      to: '2020-01-31',
    });

    expect(terms).not.toHaveBeenCalled();
    expect(history).toHaveBeenCalledWith('school-1', 'child-a', {
      from: '2020-01-01',
      to: '2020-01-31',
    });
  });

  it('counts late as attended for the rate, and a reasonless non-present day as unexplained', async () => {
    jest.spyOn(StudentAccessService.Instance, 'canSeeStudent').mockResolvedValue(true);
    jest
      .spyOn(TermRepository.Instance, 'fetchForSchool')
      .mockResolvedValue([term('2026-01-01', '2026-04-01')]);
    jest.spyOn(AttendanceRepository.Instance, 'historyForStudent').mockResolvedValue([
      record({ id: '1', date: '2026-01-05', status: 'PRESENT' }),
      record({ id: '2', date: '2026-01-06', status: 'LATE' }),
      record({ id: '3', date: '2026-01-07', status: 'ABSENT', reason: 'SICK' }),
      record({ id: '4', date: '2026-01-08', status: 'ABSENT', reason: null }),
      record({ id: '5', date: '2026-01-09', status: 'EXCUSED', reason: 'PERMITTED' }),
    ]);

    const result = await AttendanceService.Instance.fetchStudentHistory(
      contextFor(),
      'child-a',
      {},
    );

    expect(result.summary).toMatchObject({
      totalDays: 5,
      present: 1,
      late: 1,
      absent: 2,
      excused: 1,
      unexplainedAbsences: 1,
      attendanceRate: 40, // (present + late) / total = 2/5
    });
    expect(result.records).toHaveLength(5);
  });
});
