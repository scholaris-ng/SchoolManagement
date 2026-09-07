import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';
import type { RetentionRiskRow } from '@/types/analytics';

const useRetentionRisk = vi.fn();
const useSchool = vi.fn();

vi.mock('./api', () => ({ useRetentionRisk: (...args: unknown[]) => useRetentionRisk(...args) }));
vi.mock('@/features/settings/api', () => ({ useSchool: () => useSchool() }));
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub(['analytics.retention', 'message.send']),
  useSchoolId: () => 'sch_1',
  usePermission: () => true,
}));

const { RetentionPage } = await import('./retention-page');

function row(over: Partial<RetentionRiskRow> = {}): RetentionRiskRow {
  return {
    studentId: 'stu_1',
    studentName: 'Tobenna Eze',
    admissionNo: 'BRF/2023/001',
    className: 'JSS 2 Silver',
    riskScore: 65,
    riskBand: 'HIGH',
    signals: [
      {
        key: 'arrears',
        label: 'Large fee arrears',
        detail: '₦180,000 outstanding',
        weight: 35,
      },
      {
        key: 'attendance',
        label: 'Falling attendance',
        detail: '74% attendance this term',
        weight: 30,
      },
    ],
    outstandingBalance: 180_000,
    attendanceRate: 74,
    guardianLastLoginAt: null,
    lastContactedAt: null,
    ...over,
  };
}

function queryResult(over: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  };
}

function paged(items: RetentionRiskRow[]) {
  return {
    items,
    meta: {
      page: 1,
      pageSize: 25,
      total: items.length,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useSchool.mockReturnValue(
    queryResult({ data: { settings: { currency: 'NGN' } }, isPending: false }),
  );
});

describe('RetentionPage', () => {
  it('ranks flagged families and names the signals behind each score', async () => {
    useRetentionRisk.mockReturnValue(
      queryResult({
        data: paged([
          row(),
          row({
            studentId: 'stu_2',
            studentName: 'Amara Nwosu',
            riskScore: 35,
            riskBand: 'MEDIUM',
            outstandingBalance: 60_000,
            attendanceRate: 88,
            signals: [
              { key: 'arrears', label: 'Fee arrears', detail: '₦60,000 outstanding', weight: 20 },
            ],
          }),
        ]),
      }),
    );

    renderPage(<RetentionPage />, { route: '/analytics/retention' });

    // The table renders desktop rows and mobile cards together; CSS picks one,
    // so tests assert presence rather than a single node.
    expect(await screen.findAllByRole('link', { name: 'Tobenna Eze' })).not.toHaveLength(0);
    expect(screen.getAllByRole('link', { name: 'Amara Nwosu' })).not.toHaveLength(0);

    // The signals are the point of the screen — the number alone is not actionable.
    expect(screen.getAllByText('Large fee arrears').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Falling attendance').length).toBeGreaterThan(0);
  });

  it('counts the high and medium bands separately', () => {
    useRetentionRisk.mockReturnValue(
      queryResult({
        data: paged([
          row(),
          row({ studentId: 'stu_2', riskBand: 'HIGH' }),
          row({ studentId: 'stu_3', riskBand: 'MEDIUM' }),
        ]),
      }),
    );

    renderPage(<RetentionPage />);

    const highCard = screen.getByText('High risk').closest('.rounded-lg');
    expect(within(highCard as HTMLElement).getByText('2')).toBeInTheDocument();

    const mediumCard = screen.getByText('Medium risk').closest('.rounded-lg');
    expect(within(mediumCard as HTMLElement).getByText('1')).toBeInTheDocument();
  });

  it('opens a detail dialog explaining why a family was flagged', async () => {
    const user = userEvent.setup();
    useRetentionRisk.mockReturnValue(queryResult({ data: paged([row()]) }));

    renderPage(<RetentionPage />);

    // Clicking anywhere in the row but the student link opens the dialog.
    const cell = (await screen.findAllByText('BRF/2023/001 · JSS 2 Silver'))[0];
    await user.click(cell);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('What triggered this')).toBeInTheDocument();
    expect(within(dialog).getByText('₦180,000 outstanding')).toBeInTheDocument();
    expect(within(dialog).getByText('+35')).toBeInTheDocument();
  });

  it('reassures rather than alarms when no family is at risk', () => {
    useRetentionRisk.mockReturnValue(queryResult({ data: paged([]) }));

    renderPage(<RetentionPage />);

    expect(screen.getByText('No families are showing warning signs')).toBeInTheDocument();
  });

  it('frames the list as a prompt to make contact, not grounds for exclusion', () => {
    useRetentionRisk.mockReturnValue(queryResult({ data: paged([row()]) }));

    renderPage(<RetentionPage />);

    expect(
      screen.getByText(/Nothing here should be used to exclude a child/i),
    ).toBeInTheDocument();
  });

  it('surfaces a load failure with a retry rather than an empty table', async () => {
    const refetch = vi.fn();
    useRetentionRisk.mockReturnValue(
      queryResult({ isError: true, error: new Error('boom'), refetch }),
    );

    const user = userEvent.setup();
    renderPage(<RetentionPage />);

    const retry = await screen.findByRole('button', { name: /try again/i });
    await user.click(retry);
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });
});
