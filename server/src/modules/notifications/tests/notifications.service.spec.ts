import { NotificationsService } from '../services/notifications.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPreferenceRepository } from '../repositories/notificationPreference.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { sendNotificationEmail } from '../../../shared/utils/mailer';

jest.mock('../repositories/notification.repository', () => ({
  NotificationRepository: {
    Instance: { createMany: jest.fn().mockResolvedValue(undefined), fetchPaginated: jest.fn() },
  },
}));
jest.mock('../repositories/notificationPreference.repository', () => ({
  NotificationPreferenceRepository: { Instance: { findFlagsForUsers: jest.fn() } },
}));
jest.mock('../repositories/pushToken.repository', () => ({
  PushTokenRepository: {
    Instance: { tokensForUsers: jest.fn().mockResolvedValue([]), deleteTokens: jest.fn() },
  },
}));
jest.mock('../../auth/repositories/membership.repository', () => ({
  MembershipRepository: { Instance: { findUserIdsByRoleKeys: jest.fn() } },
}));
jest.mock('../../auth/repositories/user.repository', () => ({
  UserRepository: { Instance: { findContactInfoForIds: jest.fn() } },
}));
jest.mock('../../school/repositories/school.repository', () => ({
  SchoolRepository: { Instance: { findById: jest.fn().mockResolvedValue({ email: 'admin@brightfield.test' }) } },
}));
jest.mock('../../../shared/utils/mailer', () => ({
  sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
}));

const preferences = NotificationPreferenceRepository.Instance as jest.Mocked<
  typeof NotificationPreferenceRepository.Instance
>;
const users = UserRepository.Instance as jest.Mocked<typeof UserRepository.Instance>;
const email = sendNotificationEmail as jest.Mock;

/** Lets the fire-and-forget email fan-out settle before assertions run. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('NotificationsService.notifyUsers — email fan-out', () => {
  afterEach(() => jest.clearAllMocks());

  it('emails only the recipients who have turned email on for that category, per /profile/notifications', async () => {
    preferences.findFlagsForUsers.mockResolvedValue([
      { userId: 'user-1', category: 'SYSTEM', inApp: true, push: false, email: true, sms: false },
      { userId: 'user-2', category: 'SYSTEM', inApp: true, push: false, email: false, sms: false },
    ]);
    users.findContactInfoForIds.mockResolvedValue([
      { id: 'user-1', email: 'teacher@brightfield.edu.ng', firstName: 'Ada' },
    ]);

    await NotificationsService.Instance.notifyUsers('school-1', ['user-1', 'user-2'], {
      category: 'SYSTEM',
      title: 'Scheme of work approved',
      body: 'Your scheme was approved.',
      actionUrl: '/schemes/1',
    });
    await flush();

    expect(users.findContactInfoForIds).toHaveBeenCalledWith(['user-1']);
    expect(email).toHaveBeenCalledTimes(1);
    expect(email).toHaveBeenCalledWith({
      to: 'teacher@brightfield.edu.ng',
      firstName: 'Ada',
      schoolEmail: 'admin@brightfield.test',
      title: 'Scheme of work approved',
      body: 'Your scheme was approved.',
      actionUrl: '/schemes/1',
    });
  });

  it('sends no email at all when nobody has the channel on', async () => {
    preferences.findFlagsForUsers.mockResolvedValue([
      { userId: 'user-1', category: 'SYSTEM', inApp: true, push: false, email: false, sms: false },
    ]);

    await NotificationsService.Instance.notifyUsers('school-1', ['user-1'], {
      category: 'SYSTEM',
      title: 'x',
      body: 'y',
    });
    await flush();

    expect(users.findContactInfoForIds).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('defaults email off for a person who has never touched the settings screen', async () => {
    preferences.findFlagsForUsers.mockResolvedValue([]);

    await NotificationsService.Instance.notifyUsers('school-1', ['user-1'], {
      category: 'SYSTEM',
      title: 'x',
      body: 'y',
    });
    await flush();

    expect(email).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.fetchAll', () => {
  afterEach(() => jest.clearAllMocks());

  const context = { schoolId: 'school-1', user: { id: 'user-1' } } as never;
  const inbox = NotificationRepository.Instance as jest.Mocked<typeof NotificationRepository.Instance>;

  it('hands the unread/read filter to the inbox query, scoped to the caller', async () => {
    await NotificationsService.Instance.fetchAll(context, {
      page: 2,
      pageSize: 20,
      status: 'unread',
      sortDir: 'desc',
    });

    expect(inbox.fetchPaginated).toHaveBeenCalledWith('school-1', 'user-1', {
      page: 2,
      pageSize: 20,
      search: undefined,
      status: 'unread',
    });
  });
});
