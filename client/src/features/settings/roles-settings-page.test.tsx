import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';
import type { Role } from '@/types/rbac';

const useRoles = vi.fn();
const saveMutate = vi.fn();
const useSaveRole = vi.fn();

vi.mock('./api', () => ({
  useRoles: () => useRoles(),
  useSaveRole: (id?: string) => useSaveRole(id),
}));
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub(['role.manage', 'settings.manage']),
  useSchoolId: () => 'sch_1',
  usePermission: () => true,
}));

const { RolesSettingsPage } = await import('./roles-settings-page');

function role(over: Partial<Role> = {}): Role {
  return {
    id: 'rol_1',
    schoolId: 'sch_1',
    name: 'Form teacher',
    key: 'FORM_TEACHER',
    isSystem: false,
    permissions: ['student.read', 'attendance.read'],
    memberCount: 12,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  saveMutate.mockResolvedValue(undefined);
  useSaveRole.mockReturnValue({ mutateAsync: saveMutate, isPending: false, error: null });
});

describe('RolesSettingsPage', () => {
  it('lists each role with how much access it carries', async () => {
    useRoles.mockReturnValue({
      data: [role(), role({ id: 'rol_2', name: 'Bursar', key: 'BURSAR', memberCount: 2 })],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<RolesSettingsPage />, { dataRouter: true });

    expect(await screen.findByRole('button', { name: /Form teacher/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bursar/ })).toBeInTheDocument();
    expect(screen.getByText(/2 permissions · 12 members/)).toBeInTheDocument();
  });

  it('sends the full permission set when one is added', async () => {
    const user = userEvent.setup();
    useRoles.mockReturnValue({
      data: [role()],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<RolesSettingsPage />, { dataRouter: true });

    await user.click(await screen.findByRole('checkbox', { name: /Take and correct registers/i }));
    await user.click(screen.getByRole('button', { name: /save role/i }));

    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1));
    const payload = saveMutate.mock.calls[0][0] as { permissions: string[] };

    // The API replaces the set, so the payload must carry what was already
    // granted as well as the addition — a partial list would silently revoke.
    expect(payload.permissions).toEqual(
      expect.arrayContaining(['student.read', 'attendance.read', 'attendance.manage']),
    );
  });

  it('removes a permission that is switched off', async () => {
    const user = userEvent.setup();
    useRoles.mockReturnValue({
      data: [role()],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<RolesSettingsPage />, { dataRouter: true });

    await user.click(await screen.findByRole('checkbox', { name: /View attendance/i }));
    await user.click(screen.getByRole('button', { name: /save role/i }));

    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    const payload = saveMutate.mock.calls[0][0] as { permissions: string[] };
    expect(payload.permissions).not.toContain('attendance.read');
    expect(payload.permissions).toContain('student.read');
  });

  it('will not rename a built-in role', async () => {
    const user = userEvent.setup();
    useRoles.mockReturnValue({
      data: [role({ isSystem: true, name: 'Principal', key: 'PRINCIPAL' })],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<RolesSettingsPage />, { dataRouter: true });

    expect(await screen.findByText('Built-in')).toBeInTheDocument();
    expect(screen.queryByLabelText(/role name/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Publish results/i }));
    await user.click(screen.getByRole('button', { name: /save role/i }));

    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    // Name is omitted rather than echoed back, so the server never sees a rename.
    expect((saveMutate.mock.calls[0][0] as { name?: string }).name).toBeUndefined();
  });

  it('warns when a role grants the platform-wide escape hatch', async () => {
    useRoles.mockReturnValue({
      data: [role({ permissions: ['platform.manage'] })],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<RolesSettingsPage />, { dataRouter: true });

    expect(await screen.findByText('Platform operator role')).toBeInTheDocument();
  });

  it('warns before a user quietly removes their own access', async () => {
    useRoles.mockReturnValue({
      data: [role({ key: 'SCHOOL_ADMIN', name: 'School administrator' })],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<RolesSettingsPage />, { dataRouter: true });

    expect(await screen.findByText('This is one of your own roles')).toBeInTheDocument();
  });

  it('keeps the save button disabled until something changes', async () => {
    const user = userEvent.setup();
    useRoles.mockReturnValue({
      data: [role()],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<RolesSettingsPage />, { dataRouter: true });

    const save = await screen.findByRole('button', { name: /save role/i });
    expect(save).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /View students/i }));
    expect(save).toBeEnabled();
  });

  it('groups permissions so an administrator can grant a whole area at once', async () => {
    const user = userEvent.setup();
    useRoles.mockReturnValue({
      data: [role({ permissions: [] })],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<RolesSettingsPage />, { dataRouter: true });

    const financeCard = (await screen.findByText('Finance')).closest('.rounded-lg') as HTMLElement;
    await user.click(within(financeCard).getByRole('button', { name: /select all/i }));
    await user.click(screen.getByRole('button', { name: /save role/i }));

    await waitFor(() => expect(saveMutate).toHaveBeenCalled());
    const payload = saveMutate.mock.calls[0][0] as { permissions: string[] };
    expect(payload.permissions).toEqual(
      expect.arrayContaining([
        'finance.read',
        'fee.manage',
        'invoice.manage',
        'payment.manage',
        'payment.reconcile',
        'discount.manage',
      ]),
    );
  });
});
