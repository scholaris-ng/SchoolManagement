import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';

const updateMutate = vi.fn();
const useAuthMock = vi.fn();

vi.mock('./api', () => ({
  useUpdateProfile: () => ({ mutateAsync: updateMutate, isPending: false, error: null }),
}));
vi.mock('@/hooks/use-outbox', () => ({
  useOutbox: () => ({
    entries: [],
    pendingCount: 0,
    isFlushing: false,
    isOnline: true,
    retryNow: vi.fn(),
  }),
}));
vi.mock('@/app/providers/theme-provider', () => ({
  useTheme: () => ({ mode: 'system', setMode: vi.fn() }),
}));
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
  useSchoolId: () => 'sch_1',
  usePermission: () => true,
}));

const { ProfilePage } = await import('./profile-page');

beforeEach(() => {
  vi.clearAllMocks();
  updateMutate.mockResolvedValue(undefined);
  // One object for the whole test: the page reloads its fields whenever the
  // signed-in user changes, and a fresh stub per render would look like a
  // change and wipe what was just typed. The real provider memoises.
  const stub = authStub([]);
  stub.user.phone = '+2348012345678';
  useAuthMock.mockReturnValue(stub);
});

/**
 * The user row keeps a first name, a surname and the joined string. Editing
 * only the joined one left the two parts behind, which is what anything
 * sorting or addressing people by surname reads, so the screen asks for the
 * parts and the server rebuilds the joined name from them.
 */
describe('ProfilePage — personal details', () => {
  it('asks for the name in two parts rather than as one full name', async () => {
    renderPage(<ProfilePage />, { dataRouter: true });

    expect(await screen.findByLabelText(/First name/)).toHaveValue('Adaeze');
    expect(screen.getByLabelText(/Surname/)).toHaveValue('Okonkwo');
    expect(screen.queryByLabelText(/Full name/)).not.toBeInTheDocument();
  });

  it('sends both parts when the name is changed', async () => {
    const user = userEvent.setup();
    renderPage(<ProfilePage />, { dataRouter: true });

    const surname = await screen.findByLabelText(/Surname/);
    await user.clear(surname);
    await user.type(surname, 'Okonkwo-Bello');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Adaeze', lastName: 'Okonkwo-Bello' }),
    );
  });

  it('will not save a name with an empty half', async () => {
    const user = userEvent.setup();
    renderPage(<ProfilePage />, { dataRouter: true });

    await user.clear(await screen.findByLabelText(/First name/));

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(updateMutate).not.toHaveBeenCalled();
  });
});

/**
 * The number is one string on the record and two boxes on screen. The plain
 * text box this replaced accepted anything at all, so a number typed without
 * its dial code reached the SMS gateway unsendable.
 */
describe('ProfilePage — phone', () => {
  it('splits a stored number into its dial code and local part', async () => {
    renderPage(<ProfilePage />, { dataRouter: true });

    expect(await screen.findByLabelText('Country dial code')).toHaveTextContent('+234');
    expect(screen.getByRole('textbox', { name: 'Phone' })).toHaveValue('8012345678');
  });

  it('sends the dial code and the local part as one number', async () => {
    const user = userEvent.setup();
    renderPage(<ProfilePage />, { dataRouter: true });

    const local = await screen.findByRole('textbox', { name: 'Phone' });
    await user.clear(local);
    await user.type(local, '8099999999');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+2348099999999' }),
    );
  });
});
