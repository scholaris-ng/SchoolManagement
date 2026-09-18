import { isSubscriptionAdmin } from '../utils/subscriptionAdmin';

const allowed = new Set(['edoghotugiddy@gmail.com', 'gideonedoghotu@gmail.com']);

describe('isSubscriptionAdmin', () => {
  it('admits a listed, verified address', () => {
    expect(isSubscriptionAdmin({ email: 'edoghotugiddy@gmail.com', emailVerified: true }, allowed)).toBe(true);
    expect(isSubscriptionAdmin({ email: 'gideonedoghotu@gmail.com', emailVerified: true }, allowed)).toBe(true);
  });

  it('does not care how the address is capitalised or padded', () => {
    expect(isSubscriptionAdmin({ email: '  EdoghOtugiddy@Gmail.com ', emailVerified: true }, allowed)).toBe(true);
  });

  it('refuses a listed address that has not been verified', () => {
    expect(isSubscriptionAdmin({ email: 'edoghotugiddy@gmail.com', emailVerified: false }, allowed)).toBe(false);
  });

  it('refuses anyone not on the list, however senior they are at their school', () => {
    expect(isSubscriptionAdmin({ email: 'principal@school.example', emailVerified: true }, allowed)).toBe(false);
    // A look-alike is not the same address.
    expect(isSubscriptionAdmin({ email: 'edoghotugiddy@gmail.com.evil.example', emailVerified: true }, allowed)).toBe(false);
  });

  it('admits nobody when the list is empty', () => {
    expect(isSubscriptionAdmin({ email: 'edoghotugiddy@gmail.com', emailVerified: true }, new Set())).toBe(false);
  });
});
