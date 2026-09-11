import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';

const changePassword = vi.fn();
const useAuthMock = vi.fn();

vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
  useSchoolId: () => 'sch_1',
  usePermission: () => true,
}));

const { ChangePasswordDialog } = await import('./change-password-dialog');

beforeEach(() => {
  vi.clearAllMocks();
  changePassword.mockResolvedValue(undefined);
  useAuthMock.mockReturnValue({ ...authStub([]), changePassword });
});

function renderDialog() {
  return renderPage(<ChangePasswordDialog open onOpenChange={vi.fn()} />, { dataRouter: true });
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  values: { current?: string; next?: string; confirm?: string },
) {
  if (values.current) await user.type(screen.getByLabelText(/Current password/), values.current);
  if (values.next) await user.type(screen.getByLabelText(/^New password/), values.next);
  if (values.confirm) {
    await user.type(screen.getByLabelText(/Confirm new password/), values.confirm);
  }
  await user.click(screen.getByRole('button', { name: 'Change password' }));
}

/**
 * Someone hired last week signs in with a password an administrator generated,
 * and the email that carried it tells them to change it straight away. Until
 * this dialog existed the only thing the app offered was a reset link, which is
 * the recovery path for a password you cannot remember.
 */
describe('ChangePasswordDialog', () => {
  it('hands the current and new password to the identity provider', async () => {
    const user = userEvent.setup();
    renderDialog();

    await fill(user, {
      current: 'Kq7!vbnm2xZa',
      next: 'a-longer-phrase-2026',
      confirm: 'a-longer-phrase-2026',
    });

    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1));
    expect(changePassword).toHaveBeenCalledWith('Kq7!vbnm2xZa', 'a-longer-phrase-2026');
  });

  it('will not submit when the confirmation does not match', async () => {
    const user = userEvent.setup();
    renderDialog();

    await fill(user, {
      current: 'Kq7!vbnm2xZa',
      next: 'a-longer-phrase-2026',
      confirm: 'a-longer-phrase-2027',
    });

    expect(await screen.findByText('Those passwords do not match')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('refuses a new password that is the one already in use', async () => {
    const user = userEvent.setup();
    renderDialog();

    await fill(user, {
      current: 'a-longer-phrase-2026',
      next: 'a-longer-phrase-2026',
      confirm: 'a-longer-phrase-2026',
    });

    expect(
      await screen.findByText('Choose a password you have not used here before'),
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('puts a wrong current password on that field rather than in a banner', async () => {
    const user = userEvent.setup();
    changePassword.mockRejectedValue(new Error('That is not your current password.'));
    renderDialog();

    await fill(user, {
      current: 'wrong-one-entirely',
      next: 'a-longer-phrase-2026',
      confirm: 'a-longer-phrase-2026',
    });

    const message = await screen.findByText('That is not your current password.');
    expect(message).toBeInTheDocument();
    expect(screen.queryByTestId('change-password-error')).not.toBeInTheDocument();
  });

  /*
    The passwords this app issues are machine-generated strings where l, 1 and I
    are hard to tell apart, so a field nobody can read is a field nobody can
    retype correctly.
  */
  it('reveals a password on request, one field at a time', async () => {
    const user = userEvent.setup();
    renderDialog();

    const current = screen.getByLabelText(/Current password/);
    const next = screen.getByLabelText(/^New password/);
    expect(current).toHaveAttribute('type', 'password');

    const [reveal] = screen.getAllByRole('button', { name: 'Show password' });
    await user.click(reveal);

    expect(current).toHaveAttribute('type', 'text');
    // The other boxes stay covered; revealing one is not revealing all.
    expect(next).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(current).toHaveAttribute('type', 'password');
  });

  it('shows anything else the provider says as a banner', async () => {
    const user = userEvent.setup();
    changePassword.mockRejectedValue(
      new Error('Please sign out and back in, then change your password.'),
    );
    renderDialog();

    await fill(user, {
      current: 'Kq7!vbnm2xZa',
      next: 'a-longer-phrase-2026',
      confirm: 'a-longer-phrase-2026',
    });

    expect(
      await screen.findByText('Please sign out and back in, then change your password.'),
    ).toBeInTheDocument();
  });
});
