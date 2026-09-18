const mockIsAdmin = jest.fn();
jest.mock('../../../shared/utils/subscriptionAdmin', () => ({
  isSubscriptionAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

import { SessionService } from '../services/session.service';
import type { MembershipRow } from '../repositories/membership.repository';
import type { User } from '../entities/user.entity';

const DAY = 24 * 60 * 60 * 1000;

const row = (over: Partial<MembershipRow> = {}) =>
  ({
    schoolStatus: 'TRIAL',
    schoolAccessEndsAt: new Date(Date.now() + 5 * DAY),
    ...over,
  }) as MembershipRow;

const user = (over: Partial<User> = {}) =>
  ({ email: 'teacher@school.example', emailVerified: true, isPlatformAdmin: false, ...over }) as User;

const service = SessionService.Instance;

beforeEach(() => mockIsAdmin.mockReset().mockReturnValue(false));

describe('SessionService.assertAccessOpen', () => {
  it('lets a school through while its trial has days left', () => {
    expect(() => service.assertAccessOpen(row(), user())).not.toThrow();
  });

  it('refuses a school whose trial has ended, with a 402 the client can recognise', () => {
    const ended = row({ schoolAccessEndsAt: new Date(Date.now() - DAY) });

    expect(() => service.assertAccessOpen(ended, user())).toThrow(
      expect.objectContaining({ statusCode: 402, code: 'SUBSCRIPTION_EXPIRED' }),
    );
  });

  it('says a paid school’s subscription has ended, not that its trial has', () => {
    const lapsed = row({ schoolStatus: 'ACTIVE', schoolAccessEndsAt: new Date(Date.now() - DAY) });

    expect(() => service.assertAccessOpen(lapsed, user())).toThrow(/subscription has ended/i);
    expect(() =>
      service.assertAccessOpen(row({ schoolAccessEndsAt: new Date(Date.now() - DAY) }), user()),
    ).toThrow(/free trial/i);
  });

  it('lets a subscription administrator in even when their own school has lapsed', () => {
    mockIsAdmin.mockReturnValue(true);
    const ended = row({ schoolAccessEndsAt: new Date(Date.now() - 30 * DAY) });

    expect(() => service.assertAccessOpen(ended, user())).not.toThrow();
  });

  it('lets a platform operator in too', () => {
    const ended = row({ schoolAccessEndsAt: new Date(Date.now() - 30 * DAY) });

    expect(() => service.assertAccessOpen(ended, user({ isPlatformAdmin: true }))).not.toThrow();
  });
});
