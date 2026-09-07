import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';
import type { AuditLogEntry } from '@/types/engagement';

const useAuditLog = vi.fn();

vi.mock('@/features/settings/api', () => ({
  useAuditLog: (...args: unknown[]) => useAuditLog(...args),
}));
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub(['audit.read', 'settings.manage']),
  useSchoolId: () => 'sch_1',
  usePermission: () => true,
}));

const { AuditPage } = await import('./audit-page');

function entry(over: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'aud_1',
    schoolId: 'sch_1',
    actorUserId: 'usr_1',
    actorName: 'Adaeze Okonkwo',
    actorRole: 'SCHOOL_ADMIN',
    action: 'result.published_amended',
    entityType: 'ScoreSheet',
    entityId: 'shs_1',
    entityLabel: 'JSS 2 Silver · Mathematics',
    before: { total: 62 },
    after: { total: 71 },
    ipAddress: '102.89.0.1',
    userAgent: 'Mozilla/5.0',
    requestId: 'req_abc',
    occurredAt: new Date('2026-09-01T10:30:00Z').toISOString(),
    severity: 'CRITICAL',
    ...over,
  };
}

function result(items: AuditLogEntry[], over: Record<string, unknown> = {}) {
  return {
    data: {
      items,
      meta: {
        page: 1,
        pageSize: 50,
        total: items.length,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    },
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('AuditPage', () => {
  it('shows who did what, to which record', () => {
    useAuditLog.mockReturnValue(result([entry()]));

    renderPage(<AuditPage />, { route: '/audit' });

    expect(screen.getAllByText('result.published_amended').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Adaeze Okonkwo').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/JSS 2 Silver · Mathematics/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('CRITICAL').length).toBeGreaterThan(0);
  });

  it('reveals the before and after values of a change', async () => {
    const user = userEvent.setup();
    useAuditLog.mockReturnValue(result([entry()]));

    renderPage(<AuditPage />, { route: '/audit' });

    await user.click(screen.getAllByText('result.published_amended')[0]);

    const dialog = await screen.findByRole('dialog');
    // A changed mark is meaningless without both numbers.
    expect(within(dialog).getByText('Before')).toBeInTheDocument();
    expect(within(dialog).getByText('After')).toBeInTheDocument();
    expect(within(dialog).getByText(/"total": 62/)).toBeInTheDocument();
    expect(within(dialog).getByText(/"total": 71/)).toBeInTheDocument();
    expect(within(dialog).getByText('102.89.0.1')).toBeInTheDocument();
  });

  it('says plainly that a value was never recorded rather than showing nothing', async () => {
    const user = userEvent.setup();
    useAuditLog.mockReturnValue(
      result([entry({ before: null, ipAddress: null, requestId: null })]),
    );

    renderPage(<AuditPage />, { route: '/audit' });
    await user.click(screen.getAllByText('result.published_amended')[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText('Not recorded').length).toBeGreaterThan(0);
  });

  it('states that the trail cannot be edited from the app', () => {
    useAuditLog.mockReturnValue(result([entry()]));

    renderPage(<AuditPage />, { route: '/audit' });

    expect(screen.getByText(/Audit records are append-only/i)).toBeInTheDocument();
  });

  it('passes filters through to the API rather than filtering in the browser', async () => {
    const user = userEvent.setup();
    useAuditLog.mockReturnValue(result([entry()]));

    renderPage(<AuditPage />, { route: '/audit' });

    await user.selectOptions(screen.getByLabelText('Severity'), 'CRITICAL');

    // Paging over a whole school's audit history in the browser is not viable;
    // the filter has to reach the server. The wait is for the router: list state
    // lives in the URL, and a data-router navigation settles asynchronously.
    await waitFor(() => {
      const lastQuery = useAuditLog.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(lastQuery.severity).toBe('CRITICAL');
    });
  });

  it('offers an empty state before anything has been audited', () => {
    useAuditLog.mockReturnValue(result([]));

    renderPage(<AuditPage />, { route: '/audit' });

    expect(screen.getByText('Nothing audited yet')).toBeInTheDocument();
  });
});
