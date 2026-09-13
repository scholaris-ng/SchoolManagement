import { DashboardService } from '../services/dashboard.service';
import { SchoolRepository } from '../../school/repositories/school.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { StudentRepository } from '../../students/repositories/student.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import { LedgerRepository } from '../../finance/repositories/ledger.repository';
import { PaymentRepository } from '../../finance/repositories/payment.repository';
import { NotificationRepository } from '../../notifications/repositories/notification.repository';
import type { RequestContext } from '../../../shared/types/context';
import type { TermDTO } from '../../academics/dto/academics.dto';
import type { School } from '../../school/entities/school.entity';

/**
 * A child's identity, attendance and balance are real, read the same way the
 * admin and bursar dashboards already do. Results, messaging and the
 * calendar have no table yet, so the honest-absence shape stands: null, zero
 * and empty, never a fabricated average or event.
 */

const contextFor = (userId: string) =>
  ({ schoolId: 'school-1', user: { id: userId } }) as unknown as RequestContext;

const school = { settings: { currency: 'NGN' } } as unknown as School;

const currentTermCovering = (from: string, to: string) =>
  [{ id: 'term-1', isCurrent: true, startDate: from, endDate: to } as TermDTO] as TermDTO[];

describe('DashboardService.fetchParent', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends an empty screen, but a real notification count, for a guardian with no linked children', async () => {
    jest.spyOn(SchoolRepository.Instance, 'findById').mockResolvedValue(school);
    jest.spyOn(StudentAccessService.Instance, 'visibleStudentIds').mockResolvedValue([]);
    const unread = jest.spyOn(NotificationRepository.Instance, 'countUnread').mockResolvedValue(3);
    const summaries = jest.spyOn(StudentRepository.Instance, 'parentSummariesFor');

    const result = await DashboardService.Instance.fetchParent(contextFor('user-1'));

    expect(result).toEqual({
      currency: 'NGN',
      children: [],
      recentPayments: [],
      upcomingEvents: [],
      unreadNotifications: 3,
    });
    expect(unread).toHaveBeenCalledWith('school-1', 'user-1');
    // Nothing to summarise for zero children — not even attempted.
    expect(summaries).not.toHaveBeenCalled();
  });

  it("matches each child's attendance and balance back up by id, not by array position", async () => {
    jest.spyOn(SchoolRepository.Instance, 'findById').mockResolvedValue(school);
    jest
      .spyOn(StudentAccessService.Instance, 'visibleStudentIds')
      .mockResolvedValue(['child-a', 'child-b']);
    jest
      .spyOn(TermRepository.Instance, 'fetchForSchool')
      .mockResolvedValue(currentTermCovering('2026-01-01', '2026-04-01'));
    // Deliberately returned in the opposite order from `visibleStudentIds`.
    jest.spyOn(StudentRepository.Instance, 'parentSummariesFor').mockResolvedValue([
      {
        studentId: 'child-b',
        fullName: 'Bisi',
        admissionNo: 'B1',
        photoUrl: null,
        className: 'JSS 1',
        housePoints: 40,
      },
      {
        studentId: 'child-a',
        fullName: 'Amara',
        admissionNo: 'A1',
        photoUrl: null,
        className: 'JSS 2',
        housePoints: 15,
      },
    ]);
    jest
      .spyOn(AttendanceRepository.Instance, 'rateForStudent')
      .mockImplementation(async (_schoolId, studentId) => (studentId === 'child-a' ? 90 : 60));
    jest
      .spyOn(LedgerRepository.Instance, 'summaryFor')
      .mockImplementation(async (_schoolId, studentId) =>
        studentId === 'child-a'
          ? ({ balance: 5000 } as never)
          : ({ balance: 0 } as never),
      );
    jest.spyOn(PaymentRepository.Instance, 'recentForStudents').mockResolvedValue([]);
    jest.spyOn(NotificationRepository.Instance, 'countUnread').mockResolvedValue(0);

    const result = await DashboardService.Instance.fetchParent(contextFor('user-1'));

    const amara = result.children.find((child) => child.studentId === 'child-a');
    const bisi = result.children.find((child) => child.studentId === 'child-b');
    expect(amara).toMatchObject({ attendanceRate: 90, outstandingBalance: 5000, housePoints: 15 });
    expect(bisi).toMatchObject({ attendanceRate: 60, outstandingBalance: 0, housePoints: 40 });

    // What no module can back yet is answered honestly, not fabricated.
    for (const child of result.children) {
      expect(child).toMatchObject({
        lastTermAverage: null,
        currentTermAverage: null,
        position: null,
        classSize: null,
        unreadMessages: 0,
        resultPublished: false,
      });
    }
    expect(result.upcomingEvents).toEqual([]);
  });

  it('reports zero attendance without querying it when the school has no current term', async () => {
    jest.spyOn(SchoolRepository.Instance, 'findById').mockResolvedValue(school);
    jest.spyOn(StudentAccessService.Instance, 'visibleStudentIds').mockResolvedValue(['child-a']);
    jest.spyOn(TermRepository.Instance, 'fetchForSchool').mockResolvedValue([]);
    jest.spyOn(StudentRepository.Instance, 'parentSummariesFor').mockResolvedValue([
      {
        studentId: 'child-a',
        fullName: 'Amara',
        admissionNo: 'A1',
        photoUrl: null,
        className: 'JSS 2',
        housePoints: 0,
      },
    ]);
    jest.spyOn(LedgerRepository.Instance, 'summaryFor').mockResolvedValue({ balance: 0 } as never);
    jest.spyOn(PaymentRepository.Instance, 'recentForStudents').mockResolvedValue([]);
    jest.spyOn(NotificationRepository.Instance, 'countUnread').mockResolvedValue(0);
    const rate = jest.spyOn(AttendanceRepository.Instance, 'rateForStudent');

    const result = await DashboardService.Instance.fetchParent(contextFor('user-1'));

    expect(result.children[0]).toMatchObject({ attendanceRate: 0 });
    expect(rate).not.toHaveBeenCalled();
  });
});
