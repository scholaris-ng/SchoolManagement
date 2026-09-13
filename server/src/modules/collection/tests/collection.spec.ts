import { CollectionService } from '../services/collection.service';
import { CollectionRepository } from '../repositories/collection.repository';
import { StudentRepository } from '../../students/repositories/student.repository';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AuditService } from '../../audit/services/audit.service';
import { releaseChildSchema } from '../validators/collection.schema';
import type { RequestContext } from '../../../shared/types/context';

const context = () =>
  ({
    schoolId: 'school-1',
    user: { id: 'user-1', displayName: 'Mr Gateman' },
    membership: { staffId: 'staff-1', guardianId: null, studentId: null, roles: ['FORM_TEACHER'], customRoleNames: [] },
    can: () => true,
    requestId: 'req-1',
    ipAddress: null,
    userAgent: null,
  }) as unknown as RequestContext;

const student = { id: 'child-a', fullName: 'Amara Okoro' };

describe('CollectionService.releaseChild', () => {
  afterEach(() => jest.restoreAllMocks());

  function stub() {
    jest.spyOn(StudentRepository.Instance, 'findOneDTO').mockResolvedValue(student as never);
    jest.spyOn(AuditService.Instance, 'record').mockResolvedValue(undefined);
    jest.spyOn(CollectionRepository.Instance, 'findEventDTO').mockResolvedValue({ id: 'evt-1' } as never);
    jest.spyOn(CollectionRepository.Instance, 'markParentNotified').mockResolvedValue(undefined);
  }

  it('refuses a listed person who is not currently authorised', async () => {
    stub();
    jest.spyOn(CollectionRepository.Instance, 'findPersonDTO').mockResolvedValue({
      id: 'p-1', studentId: 'child-a', name: 'Uncle Emeka', relationship: 'Uncle', authorizationStatus: 'REVOKED',
    } as never);
    const create = jest.spyOn(CollectionRepository.Instance, 'createEvent');

    await expect(
      CollectionService.Instance.releaseChild(context(), {
        studentId: 'child-a', pickupPersonId: 'p-1', pickupPersonName: '', relationship: '', method: 'GATE', note: null,
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(create).not.toHaveBeenCalled();
  });

  it("takes the name and relationship from the list, tells the guardians, and stamps the record", async () => {
    stub();
    jest.spyOn(CollectionRepository.Instance, 'findPersonDTO').mockResolvedValue({
      id: 'p-1', studentId: 'child-a', name: 'Uncle Emeka', relationship: 'Uncle', authorizationStatus: 'AUTHORIZED',
    } as never);
    const create = jest.spyOn(CollectionRepository.Instance, 'createEvent').mockResolvedValue({ id: 'evt-1', releasedAt: new Date() } as never);
    jest.spyOn(AttendanceRepository.Instance, 'guardianRecipientsFor').mockResolvedValue([
      { studentId: 'child-a', studentName: 'Amara', userId: 'guardian-user' },
    ]);
    const notify = jest.spyOn(NotificationsService.Instance, 'notifyUsers').mockResolvedValue(undefined);
    const stamp = jest.spyOn(CollectionRepository.Instance, 'markParentNotified').mockResolvedValue(undefined);

    await CollectionService.Instance.releaseChild(context(), {
      studentId: 'child-a', pickupPersonId: 'p-1', pickupPersonName: 'ignored', relationship: 'ignored', method: 'GATE', note: null,
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ pickupPersonName: 'Uncle Emeka', relationship: 'Uncle', releasedByName: 'Mr Gateman' }));
    expect(notify).toHaveBeenCalledWith('school-1', ['guardian-user'], expect.objectContaining({ category: 'COLLECTION' }));
    expect(stamp).toHaveBeenCalledWith('school-1', 'evt-1');
  });

  it('records an unlisted collector as such, and does not claim a parent was told when nobody could be', async () => {
    stub();
    const create = jest.spyOn(CollectionRepository.Instance, 'createEvent').mockResolvedValue({ id: 'evt-1', releasedAt: new Date() } as never);
    jest.spyOn(AttendanceRepository.Instance, 'guardianRecipientsFor').mockResolvedValue([]);
    const notify = jest.spyOn(NotificationsService.Instance, 'notifyUsers');
    const stamp = jest.spyOn(CollectionRepository.Instance, 'markParentNotified');

    await CollectionService.Instance.releaseChild(context(), {
      studentId: 'child-a', pickupPersonId: null, pickupPersonName: 'Driver Musa', relationship: '', method: 'BUS', note: null,
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ pickupPersonName: 'Driver Musa', relationship: 'Unlisted', parentNotified: false }));
    expect(notify).not.toHaveBeenCalled();
    expect(stamp).not.toHaveBeenCalled();
  });
});

describe('releaseChildSchema', () => {
  const wrap = (body: unknown) => ({ body, query: {}, params: {} });
  const studentId = '11111111-1111-4111-8111-111111111111';

  it('needs either a listed person or a typed name', () => {
    expect(releaseChildSchema.safeParse(wrap({ studentId, method: 'GATE' })).success).toBe(false);
    expect(releaseChildSchema.safeParse(wrap({ studentId, method: 'GATE', pickupPersonName: 'Aunt' })).success).toBe(true);
    expect(releaseChildSchema.safeParse(wrap({ studentId, method: 'GATE', pickupPersonId: studentId })).success).toBe(true);
  });
});
