import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authStub, renderPage } from '@/test/harness';
import type { Permission } from '@/types/rbac';

let stub = authStub([]);
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => stub,
}));

let studentSearch: { data: unknown[] | undefined; isSearching: boolean } = {
  data: undefined,
  isSearching: false,
};
vi.mock('@/features/students/api', () => ({
  useStudentSearch: () => studentSearch,
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

const { CommandPalette } = await import('./command-palette');

const PERMISSIONS: Permission[] = ['student.read', 'student.create', 'attendance.manage', 'import.run'];

function openPalette(permissions: Permission[] = PERMISSIONS) {
  stub = authStub(permissions);
  const onOpenChange = vi.fn();
  renderPage(<CommandPalette open onOpenChange={onOpenChange} />);
  return { onOpenChange, user: userEvent.setup() };
}

const input = () => screen.getByRole('combobox', { name: /command palette search/i });

beforeEach(() => {
  studentSearch = { data: undefined, isSearching: false };
  navigate.mockReset();
});
afterEach(cleanup);

describe('CommandPalette', () => {
  it('lists the actions a person may take, without printing their search keywords beside them', () => {
    openPalette();

    expect(screen.getByRole('option', { name: /add a student/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /take attendance/i })).toBeInTheDocument();
    // Those words exist to be searched, not read.
    expect(screen.queryByText(/enrol/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/spreadsheet/i)).not.toBeInTheDocument();
  });

  it('finds an action by one of its keywords and says why it is there', async () => {
    const { user } = openPalette();

    await user.type(input(), 'excel');

    expect(screen.getByRole('option', { name: /import records/i })).toBeInTheDocument();
    expect(screen.getByText('matches “excel”')).toBeInTheDocument();
  });

  it('finds an action from words typed in different places', async () => {
    const { user } = openPalette();

    await user.type(input(), 'add stu');

    // By text rather than by accessible name: jsdom puts a space between the
    // highlighted fragments of the label ("Add a stu dent"); a browser doesn't.
    expect(screen.getByRole('option')).toHaveTextContent('Add a student');
  });

  it('opens the highlighted result on Enter, and follows the arrow keys', async () => {
    const { user, onOpenChange } = openPalette();

    await user.type(input(), '{ArrowDown}{Enter}');

    // Add a student is first; one press down is Take attendance.
    expect(navigate).toHaveBeenCalledWith('/attendance');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('tells assistive technology which result is highlighted', async () => {
    const { user } = openPalette();

    const first = screen.getByRole('option', { name: /add a student/i });
    expect(input()).toHaveAttribute('aria-activedescendant', first.id);

    await user.type(input(), '{ArrowDown}');
    const second = screen.getByRole('option', { name: /take attendance/i });
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(input()).toHaveAttribute('aria-activedescendant', second.id);
  });

  it('wraps from the top of the list to the bottom', async () => {
    const { user } = openPalette();

    await user.type(input(), '{ArrowUp}');

    const options = screen.getAllByRole('option');
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');
  });

  it('opens a result when it is clicked', async () => {
    const { user } = openPalette();

    await user.click(screen.getByRole('option', { name: /import records/i }));

    expect(navigate).toHaveBeenCalledWith('/import');
  });

  it('shows matching students with their admission number and class, after the actions and pages', async () => {
    studentSearch = {
      isSearching: false,
      data: [
        {
          id: 's1',
          fullName: 'Chidi Nwosu',
          admissionNo: 'ADM-001',
          className: 'JSS 1A',
          photoUrl: null,
          photoConsent: false,
        },
      ],
    };
    const { user } = openPalette();

    await user.type(input(), 'chidi');

    const list = screen.getByRole('listbox', { name: /results/i });
    const student = within(list).getByRole('option', { name: /chidi nwosu/i });
    expect(student).toHaveTextContent('ADM-001 · JSS 1A');
    expect(within(list).getByText('Students')).toBeInTheDocument();
  });

  it('says what it looked for when nothing matches', async () => {
    const { user } = openPalette();

    await user.type(input(), 'zzzzz');

    expect(screen.getByText('No results for “zzzzz”')).toBeInTheDocument();
    expect(screen.getByText(/student’s name or admission number/i)).toBeInTheDocument();
  });

  it('only offers to search students to someone who may see them', () => {
    openPalette(['attendance.manage']);

    expect(input()).toHaveAttribute('placeholder', 'Search pages and actions…');
    expect(screen.queryByRole('option', { name: /add a student/i })).not.toBeInTheDocument();
  });

  it('draws no focus ring of its own around the search field', () => {
    openPalette();

    // The app-wide ring is a box-shadow that this dialog's overflow clips into
    // a stray frame around half the field.
    expect(input().className).toContain('focus-visible:ring-0');
  });
});
