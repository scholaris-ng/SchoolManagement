import { DashboardService } from '../services/dashboard.service';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import type { RequestContext } from '../../../shared/types/context';
import type { TermDTO } from '../../academics/dto/academics.dto';

/**
 * Two contracts are protected here. The registers a teacher owes are real, and
 * must be asked for as *their* form classes on today's date. Every other field
 * answers a module with no table yet, so the honest-absence shape stands:
 * empty arrays and zero, never a fabricated lesson or score sheet.
 */

const today = new Date().toISOString().slice(0, 10);

const contextFor = (staffId: string | null) =>
  ({ schoolId: 'school-1', membership: { staffId } }) as unknown as RequestContext;

const currentTermCovering = (date: string) =>
  [
    {
      id: 'term-1',
      isCurrent: true,
      startDate: date,
      endDate: date,
    } as TermDTO,
  ] as TermDTO[];

describe('DashboardService.fetchTeacher', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists the form registers still unmarked today', async () => {
    const pending = [{ classId: 'class-1', className: 'JSS 1 Gold', date: today }];
    jest
      .spyOn(TermRepository.Instance, 'fetchForSchool')
      .mockResolvedValue(currentTermCovering(today));
    const registers = jest
      .spyOn(AttendanceRepository.Instance, 'pendingRegistersFor')
      .mockResolvedValue(pending);

    const result = await DashboardService.Instance.fetchTeacher(contextFor('staff-1'));

    expect(registers).toHaveBeenCalledWith('school-1', 'staff-1', today);
    expect(result.pendingAttendance).toEqual(pending);

    // The modules behind the rest of the list still do not exist.
    expect(result).toMatchObject({
      todayClasses: [],
      pendingScoreEntry: [],
      lessonNotesDue: [],
      upcomingAssessments: [],
      unreadMessages: 0,
      curriculumCoverage: [],
    });
  });

  it('owes nothing on a day outside the current term', async () => {
    jest
      .spyOn(TermRepository.Instance, 'fetchForSchool')
      .mockResolvedValue(currentTermCovering('2000-01-01'));
    const registers = jest.spyOn(AttendanceRepository.Instance, 'pendingRegistersFor');

    const result = await DashboardService.Instance.fetchTeacher(contextFor('staff-1'));

    expect(result.pendingAttendance).toEqual([]);
    expect(registers).not.toHaveBeenCalled();
  });

  it('owes nothing to a caller with no staff record', async () => {
    const terms = jest.spyOn(TermRepository.Instance, 'fetchForSchool');
    const registers = jest.spyOn(AttendanceRepository.Instance, 'pendingRegistersFor');

    const result = await DashboardService.Instance.fetchTeacher(contextFor(null));

    expect(result.pendingAttendance).toEqual([]);
    // A parent reading this screen is not late with a register, so neither
    // lookup is even attempted.
    expect(terms).not.toHaveBeenCalled();
    expect(registers).not.toHaveBeenCalled();
  });
});
