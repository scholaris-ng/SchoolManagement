import { StaffService } from '../services/staff.service';
import { StaffRepository } from '../repositories/staff.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import type { Staff } from '../entities/staff.entity';
import type { StaffMemberDTO } from '../dto/staff.dto';
import type { RequestContext } from '../../../shared/types/context';

jest.mock('../repositories/staff.repository', () => ({
  StaffRepository: {
    Instance: {
      findByIdScoped: jest.fn(),
      findByStaffNo: jest.fn(),
      findByEmail: jest.fn(),
      updateIfVersionMatches: jest.fn(),
      update: jest.fn(),
      findOneDTO: jest.fn(),
    },
  },
}));
jest.mock('../../auth/repositories/user.repository', () => ({
  UserRepository: { Instance: { update: jest.fn() } },
}));
jest.mock('../../rbac/repositories/role.repository', () => ({
  RoleRepository: { Instance: { findByKey: jest.fn() } },
}));
jest.mock('../../academics/repositories/class.repository', () => ({
  ClassRepository: { Instance: { findByIdScoped: jest.fn() } },
}));
jest.mock('../../academics/repositories/subject.repository', () => ({
  SubjectRepository: { Instance: { findByIdScoped: jest.fn() } },
}));
jest.mock('../../audit/services/audit.service', () => ({
  AuditService: { Instance: { record: jest.fn() } },
}));
jest.mock('../../../infrastructure/database/dataSource', () => ({
  AppDataSource: { transaction: jest.fn(async (run: (m: unknown) => unknown) => run({})) },
}));

const staff = StaffRepository.Instance as jest.Mocked<typeof StaffRepository.Instance>;
const users = UserRepository.Instance as jest.Mocked<typeof UserRepository.Instance>;

const context = { schoolId: 'sch_1', user: { id: 'usr_admin' } } as RequestContext;

function existing(over: Partial<Staff> = {}): Staff {
  return {
    id: 'stf_1',
    schoolId: 'sch_1',
    userId: 'usr_9',
    staffNo: 'BA/STF/014',
    firstName: 'Chidinma',
    lastName: 'Eze',
    email: 'chidinma.eze@brightfield.edu.ng',
    phone: '+2348012345678',
    gender: 'FEMALE',
    photoUrl: null,
    designation: 'Mathematics teacher',
    department: 'Sciences',
    employmentType: 'FULL_TIME',
    employmentDate: '2023-01-09',
    status: 'ACTIVE',
    version: 3,
    ...over,
  } as Staff;
}

beforeEach(() => {
  staff.findByIdScoped.mockResolvedValue(existing());
  staff.updateIfVersionMatches.mockResolvedValue(true);
  staff.findOneDTO.mockResolvedValue({ id: 'stf_1' } as StaffMemberDTO);
});

describe('StaffService.updateStaff', () => {
  /*
    The photo upload hands the form a storage path and the form sends it back
    with every other field. Only the student table has a column for it, so
    letting it reach the update turned an ordinary staff edit into a crash.
  */
  it('keeps the photo storage path out of the columns it writes', async () => {
    await StaffService.Instance.updateStaff(
      context,
      'stf_1',
      { designation: 'Head of mathematics', photoStoragePath: 'staff-photo/stf_1/a.jpg' },
      3,
    );

    expect(staff.updateIfVersionMatches).toHaveBeenCalledTimes(1);
    const [, , columns] = staff.updateIfVersionMatches.mock.calls[0];
    expect(columns).toEqual({ designation: 'Head of mathematics' });
    expect(columns).not.toHaveProperty('photoStoragePath');
  });

  it('carries a corrected name onto the account behind the record', async () => {
    await StaffService.Instance.updateStaff(context, 'stf_1', { lastName: 'Eze-Nwosu' }, 3);

    expect(users.update).toHaveBeenCalledWith('usr_9', {
      lastName: 'Eze-Nwosu',
      displayName: 'Chidinma Eze-Nwosu',
    });
  });

  it('leaves the account alone when only the job details change', async () => {
    await StaffService.Instance.updateStaff(context, 'stf_1', { designation: 'Head of year' }, 3);

    expect(users.update).not.toHaveBeenCalled();
  });
});
