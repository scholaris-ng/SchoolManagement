import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';
import type { StaffMember } from '@/types/people';

const useStaffMember = vi.fn();
const updateMutate = vi.fn();

vi.mock('./api', () => ({
  useStaffMember: (id?: string) => useStaffMember(id),
  useCreateStaff: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useUpdateStaff: () => ({ mutateAsync: updateMutate, isPending: false, error: null }),
}));
vi.mock('@/features/academics/api', () => ({
  useSubjectOptions: () => [],
  useClassOptions: () => [],
}));
vi.mock('@/features/settings/api', () => ({
  useSchool: () => ({ data: { settings: { country: 'NG' } } }),
}));
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub(['staff.manage', 'staff.read']),
  useSchoolId: () => 'sch_1',
  usePermission: () => true,
}));

const { StaffFormPage } = await import('./staff-form-page');

function member(over: Partial<StaffMember> = {}): StaffMember {
  return {
    id: 'stf_1',
    schoolId: 'sch_1',
    userId: 'usr_9',
    staffNo: 'BA/STF/014',
    firstName: 'Chidinma',
    lastName: 'Eze',
    fullName: 'Chidinma Eze',
    email: 'chidinma.eze@brightfield.edu.ng',
    phone: '+2348012345678',
    gender: 'FEMALE',
    photoUrl: null,
    designation: 'Mathematics teacher',
    department: 'Sciences',
    employmentType: 'FULL_TIME',
    employmentDate: '2023-01-09',
    status: 'ACTIVE',
    roleNames: ['TEACHER'],
    subjectIds: [],
    subjectNames: [],
    classIds: [],
    classNames: [],
    teachingAssignments: [],
    isFormTeacher: false,
    createdAt: '2023-01-09T09:00:00.000Z',
    version: 3,
    ...over,
  };
}

function renderEdit(data: StaffMember) {
  useStaffMember.mockReturnValue({ data, isPending: false, isError: false, error: null });
  return renderPage(<StaffFormPage />, {
    route: '/staff/stf_1/edit',
    path: '/staff/:id/edit',
    dataRouter: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMutate.mockResolvedValue(member());
});

/**
 * The roles the server sends back are role *keys*. It briefly sent display
 * names instead, and the damage was quiet: the checkbox list matched nothing
 * so the roles read as unset, and the value it was still holding failed
 * validation at `roleNames.0` — a path no field displayed. The form simply
 * stopped responding to Save. Both halves are pinned here.
 */
describe('StaffFormPage — editing', () => {
  it('ticks the roles the staff member already holds', async () => {
    renderEdit(member({ roleNames: ['TEACHER', 'FORM_TEACHER'] }));

    const roles = within(await screen.findByRole('group', { name: 'Roles' }));
    expect(roles.getByLabelText('Teacher')).toBeChecked();
    expect(roles.getByLabelText('Form teacher')).toBeChecked();
    expect(roles.getByLabelText('Bursar')).not.toBeChecked();
  });

  it('saves the record, sending role keys and the version it loaded', async () => {
    const user = userEvent.setup();
    renderEdit(member());

    await user.clear(await screen.findByLabelText(/Designation/));
    await user.type(screen.getByLabelText(/Designation/), 'Head of mathematics');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0][0]).toMatchObject({
      version: 3,
      values: { roleNames: ['TEACHER'], designation: 'Head of mathematics' },
    });
  });

  /**
   * There used to be a separate "Form teacher" switch here, which meant
   * someone could hold the role's permissions with the switch left off — no
   * register to take, no way to release a child — because ticking the role
   * did not touch it. There is no second control left to forget: whatever the
   * record's own stored flag says, what is actually sent is derived from the
   * role ticked on save.
   */
  it('sends isFormTeacher true when the Form teacher role is ticked, regardless of the loaded flag', async () => {
    const user = userEvent.setup();
    renderEdit(member({ roleNames: ['TEACHER'], isFormTeacher: false }));

    const roles = within(await screen.findByRole('group', { name: 'Roles' }));
    await user.click(roles.getByLabelText('Form teacher'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0][0].values).toMatchObject({
      roleNames: ['TEACHER', 'FORM_TEACHER'],
      isFormTeacher: true,
    });
  });

  it('sends isFormTeacher false when the Form teacher role is unticked, regardless of the loaded flag', async () => {
    const user = userEvent.setup();
    renderEdit(member({ roleNames: ['TEACHER', 'FORM_TEACHER'], isFormTeacher: true }));

    const roles = within(await screen.findByRole('group', { name: 'Roles' }));
    await user.click(roles.getByLabelText('Form teacher'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate.mock.calls[0][0].values).toMatchObject({
      roleNames: ['TEACHER'],
      isFormTeacher: false,
    });
  });

  it('has no separate Form teacher switch any more', async () => {
    renderEdit(member());
    await screen.findByRole('group', { name: 'Roles' });

    expect(screen.queryByRole('switch', { name: 'Form teacher' })).not.toBeInTheDocument();
  });

  it('says why it will not save when a role is one this form cannot set', async () => {
    const user = userEvent.setup();
    renderEdit(member({ roleNames: ['Head of Year'] }));

    await user.clear(await screen.findByLabelText(/Designation/));
    await user.type(screen.getByLabelText(/Designation/), 'Head of year');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/role this form cannot set/)).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
  });
});
