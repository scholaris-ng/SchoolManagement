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
  it('says in words who did what, to which record', () => {
    useAuditLog.mockReturnValue(result([entry()]));

    renderPage(<AuditPage />, { route: '/audit' });

    // The machine name is not what a person reads; it stays on hover only.
    expect(screen.getAllByText('Result published amended').length).toBeGreaterThan(0);
    expect(screen.queryByText('result.published_amended')).not.toBeInTheDocument();
    expect(screen.getAllByText('Adaeze Okonkwo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('School admin').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Score sheet · JSS 2 Silver · Mathematics/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('CRITICAL').length).toBeGreaterThan(0);
  });

  it('shows what changed as old and new values, not as JSON', async () => {
    const user = userEvent.setup();
    useAuditLog.mockReturnValue(result([entry()]));

    renderPage(<AuditPage />, { route: '/audit' });

    await user.click(screen.getAllByText('Result published amended')[0]);

    const dialog = await screen.findByRole('dialog');
    const details = within(dialog).getByText('What changed').closest('section') as HTMLElement;
    // A changed mark is meaningless without both numbers.
    expect(within(details).getByText('Total')).toBeInTheDocument();
    expect(within(details).getByText('62')).toBeInTheDocument();
    expect(within(details).getByText('71')).toBeInTheDocument();
    expect(within(details).queryByText(/"total"/)).not.toBeInTheDocument();
  });

  it('keeps the request details, and the raw JSON, in a section that starts closed', async () => {
    const user = userEvent.setup();
    useAuditLog.mockReturnValue(result([entry()]));

    renderPage(<AuditPage />, { route: '/audit' });
    await user.click(screen.getAllByText('Result published amended')[0]);

    const dialog = await screen.findByRole('dialog');
    const technical = dialog.querySelector('[data-cy="audit-technical"]') as HTMLElement;
    expect(technical).not.toHaveAttribute('open');
    expect(within(technical).getByText('102.89.0.1')).toBeInTheDocument();
    expect(within(technical).getByText('result.published_amended')).toBeInTheDocument();
    expect(within(technical).getByText(/"total": 62/)).toBeInTheDocument();
    expect(within(technical).getByText(/"total": 71/)).toBeInTheDocument();
  });

  it('says plainly that a value was never recorded rather than showing nothing', async () => {
    const user = userEvent.setup();
    useAuditLog.mockReturnValue(
      result([entry({ before: null, ipAddress: null, requestId: null })]),
    );

    renderPage(<AuditPage />, { route: '/audit' });
    await user.click(screen.getAllByText('Result published amended')[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText('Not recorded').length).toBeGreaterThan(0);
  });

  it('says so when an action recorded no details at all', async () => {
    const user = userEvent.setup();
    useAuditLog.mockReturnValue(result([entry({ before: null, after: null })]));

    renderPage(<AuditPage />, { route: '/audit' });
    await user.click(screen.getAllByText('Result published amended')[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/No further details were recorded/)).toBeInTheDocument();
  });

  it('puts every severity badge in the list behind its explanation', () => {
    useAuditLog.mockReturnValue(result([entry({ severity: 'WARNING' })]));

    renderPage(<AuditPage />, { route: '/audit' });

    // Opening a Radix tooltip in jsdom takes ~25s (it does for any tooltip in
    // this project), so what is checked here is that the list uses the badge
    // that carries the tooltip; its wording is covered in audit-severity.test.
    const badge = screen.getAllByText('WARNING')[0];
    expect(badge.closest('[data-cy="audit-severity-warning"]')).not.toBeNull();
  });

  it('opens the detail dialog without a tooltip springing open on the badge', async () => {
    const user = userEvent.setup({ delay: null });
    useAuditLog.mockReturnValue(result([entry({ severity: 'WARNING' })]));

    renderPage(<AuditPage />, { route: '/audit' });
    await user.click(screen.getAllByText('Result published amended')[0]);
    await screen.findByRole('dialog');

    // The badge is not a tab stop, so the dialog's opening focus cannot land on it.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    const badge = screen.getByRole('dialog').querySelector('[data-cy="audit-severity-warning"]');
    expect(badge).not.toHaveAttribute('tabindex');
  });

  it('spells the meaning out for screen readers in the detail dialog', async () => {
    const user = userEvent.setup({ delay: null });
    useAuditLog.mockReturnValue(result([entry({ severity: 'WARNING' })]));

    renderPage(<AuditPage />, { route: '/audit' });
    await user.click(screen.getAllByText('Result published amended')[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/A sensitive change, such as a deletion/)).toHaveClass('sr-only');
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

  it('asks the server for admissions by their stored name, so the filter finds them', async () => {
    const user = userEvent.setup();
    useAuditLog.mockReturnValue(result([entry()]));

    renderPage(<AuditPage />, { route: '/audit' });

    await user.selectOptions(screen.getByLabelText('Record type'), 'Admission application');

    await waitFor(() => {
      const lastQuery = useAuditLog.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(lastQuery.entityType).toBe('AdmissionApplication');
    });
  });

  it('offers an empty state before anything has been audited', () => {
    useAuditLog.mockReturnValue(result([]));

    renderPage(<AuditPage />, { route: '/audit' });

    expect(screen.getByText('Nothing audited yet')).toBeInTheDocument();
  });
});

describe('AuditPage — names instead of ids', () => {
  const studentId = '0797ab32-364a-43fd-a3c5-13b62aaaaaaa';
  const classId = 'dab3303b-15db-4463-afbf-3bf9671bbbbb';
  const applicationId = '40b7eff3-ff31-4fd5-94d2-d346c50795b0';

  /** The entry from the bug report: an applicant enrolled as a student. */
  function converted(over: Partial<AuditLogEntry> = {}): AuditLogEntry {
    return entry({
      action: 'admission.converted',
      actorName: 'OYEYEMI ADESHINA',
      actorRole: 'ADMISSION_OFFICER',
      entityType: 'AdmissionApplication',
      entityId: applicationId,
      entityLabel: 'APP/2026-2027/0047',
      severity: 'WARNING',
      before: null,
      after: { classId, studentId, admissionNo: 'A1S/2026/0046', guardiansAttached: 1 },
      references: {
        [applicationId]: {
          type: 'AdmissionApplication',
          label: 'APP/2026-2027/0047 · Lotanna Ohanyere',
          removed: false,
        },
        [studentId]: { type: 'Student', label: 'Lotanna Ohanyere (A1S/2026/0046)', removed: false },
        [classId]: { type: 'SchoolClass', label: 'JSS 1 A', removed: false },
      },
      ...over,
    });
  }

  async function openEntry(row: AuditLogEntry) {
    const user = userEvent.setup();
    useAuditLog.mockReturnValue(result([row]));
    renderPage(<AuditPage />, { route: '/audit' });
    await user.click(screen.getAllByText('Applicant enrolled as a student')[0]);
    const dialog = await screen.findByRole('dialog');
    return {
      dialog,
      friendly: dialog.querySelector('[data-cy="audit-details"]') as HTMLElement,
    };
  }

  it('describes the action and the person in plain words', async () => {
    const { dialog } = await openEntry(converted());

    expect(
      within(dialog).getByRole('heading', { name: 'Applicant enrolled as a student' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Admission officer/)).toBeInTheDocument();
    expect(within(dialog).getByText('Admission application')).toBeInTheDocument();
    expect(within(dialog).getByText('APP/2026-2027/0047')).toBeInTheDocument();
  });

  it('names the class and the student rather than printing their ids', async () => {
    const { friendly } = await openEntry(converted());

    expect(within(friendly).getByText('Class')).toBeInTheDocument();
    expect(within(friendly).getByText('JSS 1 A')).toBeInTheDocument();
    expect(within(friendly).getByText('Student')).toBeInTheDocument();
    expect(within(friendly).getByText('Lotanna Ohanyere (A1S/2026/0046)')).toBeInTheDocument();
    expect(within(friendly).getByText('Admission number')).toBeInTheDocument();
    expect(within(friendly).getByText('A1S/2026/0046')).toBeInTheDocument();
    expect(within(friendly).getByText('Guardians attached')).toBeInTheDocument();

    // Nothing in what a person reads is a uuid.
    expect(friendly.textContent).not.toContain(studentId);
    expect(friendly.textContent).not.toContain(classId);
  });

  it('links to the student the action created, so it can be traced', async () => {
    const { friendly } = await openEntry(converted());

    const link = within(friendly).getByRole('link', { name: 'Lotanna Ohanyere (A1S/2026/0046)' });
    expect(link).toHaveAttribute('href', `/students/${studentId}`);
  });

  it('offers to open the record the entry is about', async () => {
    const { dialog } = await openEntry(converted());

    const open = dialog.querySelector('[data-cy="audit-open-record"]');
    expect(open).toHaveAttribute('href', `/admissions/${applicationId}`);
  });

  it('keeps the ids one click away, for tracing a request through the logs', async () => {
    const { dialog } = await openEntry(converted());

    const technical = dialog.querySelector('[data-cy="audit-technical"]') as HTMLElement;
    expect(within(technical).getByText(applicationId)).toBeInTheDocument();
    expect(within(technical).getByText('admission.converted')).toBeInTheDocument();
  });

  it('says a record has been deleted, and does not link to where it used to be', async () => {
    const { friendly } = await openEntry(
      converted({
        references: {
          [studentId]: { type: 'Student', label: 'Lotanna Ohanyere (A1S/2026/0046)', removed: true },
          [classId]: { type: 'SchoolClass', label: 'JSS 1 A', removed: false },
        },
      }),
    );

    expect(within(friendly).getByText('Lotanna Ohanyere (A1S/2026/0046)')).toBeInTheDocument();
    expect(within(friendly).getByText('(deleted)')).toBeInTheDocument();
    expect(within(friendly).queryByRole('link')).not.toBeInTheDocument();
  });

  it('says when a record can no longer be named, instead of falling back to its id', async () => {
    const { friendly } = await openEntry(converted({ references: {} }));

    expect(within(friendly).getAllByText('No longer available')).toHaveLength(2);
    expect(friendly.textContent).not.toContain(studentId);
  });

  it('still opens for an entry written before names were resolved', async () => {
    const { dialog, friendly } = await openEntry(converted({ references: undefined }));

    expect(
      within(dialog).getByRole('heading', { name: 'Applicant enrolled as a student' }),
    ).toBeInTheDocument();
    expect(within(friendly).getByText('A1S/2026/0046')).toBeInTheDocument();
    expect(friendly.textContent).not.toContain(classId);
  });
});
