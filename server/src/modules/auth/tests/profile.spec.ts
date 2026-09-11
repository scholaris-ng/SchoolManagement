import { ProfileService } from '../services/profile.service';
import { UserRepository } from '../repositories/user.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { StaffRepository } from '../../staff/repositories/staff.repository';
import type { User } from '../entities/user.entity';
import type { RequestContext } from '../../../shared/types/context';

jest.mock('../repositories/user.repository', () => ({
  UserRepository: { Instance: { findById: jest.fn(), update: jest.fn() } },
}));
jest.mock('../repositories/membership.repository', () => ({
  MembershipRepository: { Instance: { findForUser: jest.fn() } },
}));
jest.mock('../../staff/repositories/staff.repository', () => ({
  StaffRepository: { Instance: { updateForUser: jest.fn() } },
}));
jest.mock('../../audit/services/audit.service', () => ({
  AuditService: { Instance: { record: jest.fn() } },
}));

const users = UserRepository.Instance as jest.Mocked<typeof UserRepository.Instance>;
const memberships = MembershipRepository.Instance as jest.Mocked<
  typeof MembershipRepository.Instance
>;
const staff = StaffRepository.Instance as jest.Mocked<typeof StaffRepository.Instance>;

const context = { user: { id: 'usr_1' }, schoolId: 'sch_1' } as RequestContext;

function user(over: Partial<User> = {}): User {
  return {
    id: 'usr_1',
    firebaseUid: 'uid_1',
    email: 'chidinma.eze@brightfield.edu.ng',
    firstName: 'Chidinma',
    lastName: 'Eze',
    displayName: 'Chidinma Eze',
    emailVerified: true,
    phone: '+2348012345678',
    photoUrl: null,
    isPlatformAdmin: false,
    lastLoginAt: null,
    createdAt: new Date('2024-01-09T09:00:00.000Z'),
    ...over,
  } as User;
}

beforeEach(() => {
  users.findById.mockResolvedValue(user());
  users.update.mockImplementation(async (_id, patch) => user(patch as Partial<User>));
  memberships.findForUser.mockResolvedValue([]);
  staff.updateForUser.mockResolvedValue(undefined);
});

/**
 * The staff directory keeps its own copy of the person, so a profile edit that
 * stops at the account leaves an administrator looking at whatever was typed
 * on the day the employee was added. These pin the carry-over.
 */
describe('ProfileService.updateProfile', () => {
  it('rebuilds the joined name from the two parts', async () => {
    await ProfileService.Instance.updateProfile(context, { lastName: 'Eze-Nwosu' });

    expect(users.update).toHaveBeenCalledWith('usr_1', {
      firstName: 'Chidinma',
      lastName: 'Eze-Nwosu',
      displayName: 'Chidinma Eze-Nwosu',
    });
  });

  it('carries a new name onto the employee record behind it', async () => {
    await ProfileService.Instance.updateProfile(context, {
      firstName: 'Chidi',
      lastName: 'Eze',
    });

    expect(staff.updateForUser).toHaveBeenCalledWith('usr_1', {
      firstName: 'Chidi',
      lastName: 'Eze',
    });
  });

  it('carries a new phone number and photograph across', async () => {
    await ProfileService.Instance.updateProfile(context, {
      phone: '+2348099999999',
      photoUrl: 'https://cdn.example.test/p.jpg',
    });

    expect(staff.updateForUser).toHaveBeenCalledWith('usr_1', {
      phone: '+2348099999999',
      photoUrl: 'https://cdn.example.test/p.jpg',
    });
  });

  it('does not blank the employee phone when the account clears its own', async () => {
    await ProfileService.Instance.updateProfile(context, { phone: null });

    // An employee must have a contact number; an account need not.
    expect(users.update).toHaveBeenCalledWith('usr_1', { phone: null });
    expect(staff.updateForUser).toHaveBeenCalledWith('usr_1', {});
  });

  it('does not remove a photograph an administrator put on the record', async () => {
    await ProfileService.Instance.updateProfile(context, { photoUrl: null });

    expect(users.update).toHaveBeenCalledWith('usr_1', { photoUrl: null });
    expect(staff.updateForUser).toHaveBeenCalledWith('usr_1', {});
  });

  it('leaves the employee record alone when nothing about the person changed', async () => {
    await ProfileService.Instance.updateProfile(context, {});

    expect(staff.updateForUser).toHaveBeenCalledWith('usr_1', {});
  });
});
