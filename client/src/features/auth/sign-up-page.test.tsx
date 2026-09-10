import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';

const register = vi.fn();
const navigate = vi.fn();

vi.mock('./auth.endpoints', () => ({
  AuthEndpoints: {
    register: (values: unknown) => register(values),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
  },
}));

vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub([], { status: 'unauthenticated' }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const { SignUpPage } = await import('./sign-up-page');

/**
 * School registration is the only form that creates a tenant. The rules worth
 * protecting are that it never signs anyone in, and that it hands off to
 * verification rather than to a dashboard the API would refuse.
 */
describe('SignUpPage', () => {
  beforeEach(() => {
    register.mockReset();
    navigate.mockReset();
  });

  async function fillForm(overrides: Record<string, string> = {}) {
    const user = userEvent.setup();
    const values: Record<string, string> = {
      'First name': 'Ngozi',
      Surname: 'Adeleke',
      'School name': 'Harmony International College',
      'Email address': 'ngozi@harmony.edu.ng',
      '^Password': 'correct-horse-battery',
      'Confirm password': 'correct-horse-battery',
      ...overrides,
    };

    for (const [label, value] of Object.entries(values)) {
      await user.type(screen.getByLabelText(new RegExp(label, 'i')), value);
    }
    return user;
  }

  it('registers the school and sends the user on to verify their email', async () => {
    register.mockResolvedValue({
      email: 'ngozi@harmony.edu.ng',
      schoolName: 'Harmony International College',
      expiresInMinutes: 15,
      emailVerified: false,
    });

    renderPage(<SignUpPage />);
    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: /create school/i }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Ngozi',
        lastName: 'Adeleke',
        schoolName: 'Harmony International College',
        email: 'ngozi@harmony.edu.ng',
        password: 'correct-horse-battery',
      }),
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        '/verify-email',
        expect.objectContaining({
          state: expect.objectContaining({ email: 'ngozi@harmony.edu.ng' }),
        }),
      ),
    );
  });

  it('never sends the confirmation field to the server', async () => {
    register.mockResolvedValue({
      email: 'ngozi@harmony.edu.ng',
      schoolName: 'Harmony',
      expiresInMinutes: 15,
      emailVerified: false,
    });

    renderPage(<SignUpPage />);
    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: /create school/i }));

    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(register.mock.calls[0][0]).not.toHaveProperty('confirmPassword');
  });

  it('does not submit when the passwords differ', async () => {
    renderPage(<SignUpPage />);
    const user = await fillForm({ 'Confirm password': 'something-else-entirely' });
    await user.click(screen.getByRole('button', { name: /create school/i }));

    expect(await screen.findByText(/those passwords do not match/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects a password of one repeated character', async () => {
    renderPage(<SignUpPage />);
    const user = await fillForm({
      '^Password': 'aaaaaaaaaa',
      'Confirm password': 'aaaaaaaaaa',
    });
    await user.click(screen.getByRole('button', { name: /create school/i }));

    expect(await screen.findByText(/less predictable/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('shows the server message when the address is already registered', async () => {
    register.mockRejectedValue(new Error('An account with that email address already exists.'));

    renderPage(<SignUpPage />);
    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: /create school/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    // A failed registration must not move anyone on.
    expect(navigate).not.toHaveBeenCalled();
  });
});
