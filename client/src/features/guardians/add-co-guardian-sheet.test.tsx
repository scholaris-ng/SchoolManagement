import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { StudentGuardianLink } from '@/types/people';

const useAddCoGuardian = vi.fn();

vi.mock('./use-add-co-guardian', () => ({
  useAddCoGuardian: () => useAddCoGuardian(),
}));

const { AddCoGuardianSheet } = await import('./add-co-guardian-sheet');

function link(over: Partial<StudentGuardianLink>): StudentGuardianLink {
  return {
    id: 'lnk_1',
    studentId: 'stu_1',
    studentName: 'Ada Eze',
    studentAdmissionNo: 'ADM-001',
    guardianId: 'gdn_1',
    guardianName: 'Mr Eze',
    guardianPhone: '+2348030000000',
    relationship: 'FATHER',
    isPrimaryContact: true,
    isEmergencyContact: false,
    isFinanciallyResponsible: true,
    canPickUp: true,
    ...over,
  };
}

const links = [
  link({}),
  link({ id: 'lnk_2', studentId: 'stu_2', studentName: 'Chike Eze', studentAdmissionNo: 'ADM-002' }),
];

function renderSheet(props: Partial<React.ComponentProps<typeof AddCoGuardianSheet>> = {}) {
  return render(
    <MemoryRouter>
      <AddCoGuardianSheet
        guardianName="Mr Eze"
        links={links}
        open
        onOpenChange={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

const mutateAsync = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue({
    guardian: { id: 'gdn_2', fullName: 'Ngozi Eze' },
    linkedStudentIds: ['stu_1', 'stu_2'],
    failedCount: 0,
  });
  useAddCoGuardian.mockReturnValue({ mutateAsync, isPending: false, error: null, reset: vi.fn() });
});

describe('AddCoGuardianSheet', () => {
  it("offers the other parent's relationship and pre-selects every child", async () => {
    renderSheet();

    const relationship = (await screen.findByLabelText(/^Relationship to the children/)) as HTMLSelectElement;
    expect(relationship.value).toBe('MOTHER');

    expect(screen.getByLabelText(/Ada Eze/)).toBeChecked();
    expect(screen.getByLabelText(/Chike Eze/)).toBeChecked();
  });

  it('adds a guardian with no email, linked to every child', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderSheet({ onOpenChange });

    await user.type(await screen.findByLabelText(/^First name/), 'Ngozi');
    await user.type(screen.getByLabelText(/^Surname/), 'Eze');
    await user.type(screen.getByLabelText(/^Phone number/), '08031234567');
    await user.click(screen.getByRole('button', { name: 'Add guardian' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({
      relationship: 'MOTHER',
      firstName: 'Ngozi',
      lastName: 'Eze',
      phone: '08031234567',
      email: '',
      studentIds: ['stu_1', 'stu_2'],
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('takes the title from a fixed list rather than free text', async () => {
    const user = userEvent.setup();
    renderSheet();

    const title = (await screen.findByLabelText(/^Title/)) as HTMLSelectElement;
    expect(title.tagName).toBe('SELECT');
    expect(title.value).toBe('');

    await user.selectOptions(title, 'Mrs');
    await user.type(screen.getByLabelText(/^First name/), 'Ngozi');
    await user.type(screen.getByLabelText(/^Surname/), 'Eze');
    await user.type(screen.getByLabelText(/^Phone number/), '08031234567');
    await user.click(screen.getByRole('button', { name: 'Add guardian' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({ title: 'Mrs' });
  });

  it('refuses to submit when every child is unticked', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.type(await screen.findByLabelText(/^First name/), 'Ngozi');
    await user.type(screen.getByLabelText(/^Surname/), 'Eze');
    await user.type(screen.getByLabelText(/^Phone number/), '08031234567');
    await user.click(screen.getByLabelText(/Ada Eze/));
    await user.click(screen.getByLabelText(/Chike Eze/));
    await user.click(screen.getByRole('button', { name: 'Add guardian' }));

    expect(await screen.findByText('Select at least one child')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('rejects a malformed email but not a blank one', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.type(await screen.findByLabelText(/^First name/), 'Ngozi');
    await user.type(screen.getByLabelText(/^Surname/), 'Eze');
    await user.type(screen.getByLabelText(/^Phone number/), '08031234567');
    await user.type(screen.getByLabelText(/^Email address/), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Add guardian' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('blocks adding when the guardian has no children to share', async () => {
    renderSheet({ links: [] });

    expect(await screen.findByText(/has no children linked yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add guardian' })).toBeDisabled();
  });
});
