import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';
import type { ParentChildSummary, ParentDashboard } from '@/types/analytics';

const useParentDashboard = vi.fn();

vi.mock('@/features/dashboard/api', () => ({
  useParentDashboard: () => useParentDashboard(),
}));
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub(['student.read', 'attendance.read', 'result.read', 'finance.read']),
  useSchoolId: () => 'sch_1',
  usePermission: () => true,
}));

// The tab panels each own several queries of their own; this suite is about the
// portal's child scoping, so they are stubbed to a marker.
vi.mock('@/features/students/tabs/attendance-tab', () => ({
  StudentAttendanceTab: ({ studentId }: { studentId: string }) => (
    <div data-testid="attendance-tab">{studentId}</div>
  ),
}));
vi.mock('@/features/students/tabs/results-tab', () => ({
  StudentResultsTab: ({ studentId }: { studentId: string }) => (
    <div data-testid="results-tab">{studentId}</div>
  ),
}));
vi.mock('@/features/students/tabs/behaviour-tab', () => ({
  StudentBehaviourTab: () => <div />,
}));
vi.mock('@/features/students/tabs/finance-tab', () => ({
  StudentFinanceTab: ({ studentId }: { studentId: string }) => (
    <div data-testid="finance-tab">{studentId}</div>
  ),
}));
vi.mock('@/features/students/tabs/documents-tab', () => ({
  StudentDocumentsTab: () => <div />,
}));
vi.mock('@/features/students/tabs/pickup-tab', () => ({
  StudentPickupTab: () => <div />,
}));

const { FamilyPage } = await import('./family-page');

function child(over: Partial<ParentChildSummary> = {}): ParentChildSummary {
  return {
    studentId: 'stu_1',
    fullName: 'Tobenna Eze',
    admissionNo: 'BRF/2023/001',
    photoUrl: null,
    className: 'JSS 2 Silver',
    attendanceRate: 94,
    lastTermAverage: 68,
    currentTermAverage: 71,
    position: 4,
    classSize: 28,
    outstandingBalance: 0,
    unreadMessages: 0,
    housePoints: 40,
    resultPublished: true,
    ...over,
  };
}

function dashboard(children: ParentChildSummary[]): ParentDashboard {
  return {
    currency: 'NGN',
    children,
    recentPayments: [],
    upcomingEvents: [],
    unreadNotifications: 0,
  };
}

function queryResult(over: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('FamilyPage', () => {
  it('explains what to do when no children are linked yet', () => {
    useParentDashboard.mockReturnValue(queryResult({ data: dashboard([]) }));

    renderPage(<FamilyPage />, { route: '/family', path: '/family' });

    expect(screen.getByText('No children linked to your account yet')).toBeInTheDocument();
    expect(screen.getByText(/Ask the school office to link your children/i)).toBeInTheDocument();
  });

  it('shows a single child without asking the parent to choose', () => {
    useParentDashboard.mockReturnValue(queryResult({ data: dashboard([child()]) }));

    renderPage(<FamilyPage />, { route: '/family', path: '/family' });

    expect(screen.getByText('Tobenna Eze')).toBeInTheDocument();
    // The switcher is pointless with one child, so it is not rendered.
    expect(screen.queryByRole('tablist', { name: 'Choose a child' })).not.toBeInTheDocument();
  });

  it('offers a switcher and scopes the panels to the chosen child', async () => {
    const user = userEvent.setup();
    useParentDashboard.mockReturnValue(
      queryResult({
        data: dashboard([
          child(),
          child({ studentId: 'stu_2', fullName: 'Amara Eze', admissionNo: 'BRF/2023/002' }),
        ]),
      }),
    );

    // Both addresses map to this page in the real router, and selecting a child
    // navigates from one to the other.
    renderPage(<FamilyPage />, { route: '/family', path: '/family/:studentId?' });

    const switcher = screen.getByRole('tablist', { name: 'Choose a child' });
    expect(switcher).toBeInTheDocument();
    expect(screen.getByTestId('attendance-tab')).toHaveTextContent('stu_1');

    await user.click(within(switcher).getByRole('tab', { name: /Amara Eze/ }));

    // The panel must follow the switcher, or a parent reads one child's
    // attendance believing it is the other's.
    expect(screen.getByTestId('attendance-tab')).toHaveTextContent('stu_2');
  });

  it('honours a deep link to a specific child', () => {
    useParentDashboard.mockReturnValue(
      queryResult({
        data: dashboard([child(), child({ studentId: 'stu_2', fullName: 'Amara Eze' })]),
      }),
    );

    renderPage(<FamilyPage />, { route: '/family/stu_2', path: '/family/:studentId' });

    expect(screen.getByTestId('attendance-tab')).toHaveTextContent('stu_2');
  });

  it('ignores a deep link to a child who is not theirs', () => {
    // The list comes from the server; a guessed id in the address bar must not
    // select anything, and the API would refuse the follow-up queries anyway.
    useParentDashboard.mockReturnValue(queryResult({ data: dashboard([child()]) }));

    renderPage(<FamilyPage />, { route: '/family/stu_999', path: '/family/:studentId' });

    expect(screen.getByTestId('attendance-tab')).toHaveTextContent('stu_1');
  });

  it('only shows tabs the guardian has permission for', () => {
    useParentDashboard.mockReturnValue(queryResult({ data: dashboard([child()]) }));

    renderPage(<FamilyPage />, { route: '/family', path: '/family' });

    expect(screen.getByRole('tab', { name: /Attendance/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Results/ })).toBeInTheDocument();
    // `collection.read` and `behaviour.read` were not granted in the stub.
    expect(screen.queryByRole('tab', { name: /Collection/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Behaviour/ })).not.toBeInTheDocument();
  });

  it('prompts to pay when a balance is outstanding', () => {
    useParentDashboard.mockReturnValue(
      queryResult({ data: dashboard([child({ outstandingBalance: 125_000 })]) }),
    );

    renderPage(<FamilyPage />, { route: '/family', path: '/family' });

    expect(screen.getByRole('link', { name: /Pay ₦125,000/ })).toBeInTheDocument();
  });

  it('surfaces a load failure instead of an empty portal', () => {
    useParentDashboard.mockReturnValue(
      queryResult({ isError: true, error: new Error('offline') }),
    );

    renderPage(<FamilyPage />, { route: '/family', path: '/family' });

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

