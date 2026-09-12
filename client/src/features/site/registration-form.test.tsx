import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '@/test/harness';
import type { PublicAdmissionOptions } from '@/types/admissions';

/**
 * The public application form.
 *
 * Two behaviours are worth holding still. The steps a visitor walks through
 * are chosen from who they say they are, so a parent and a student applying
 * for themselves are asked different things. And what reaches the API is the
 * same application the office would have keyed in — with the people on it sent
 * as contacts, never as guardians.
 */

const SESSION_ID = '11111111-2222-4333-8444-555555555555';
const CLASS_ID = '22222222-3333-4444-8555-666666666666';

const options: PublicAdmissionOptions = {
  open: true,
  sessions: [{ id: SESSION_ID, name: '2026/2027', isCurrent: true }],
  classes: [{ id: CLASS_ID, name: 'JSS 1', levelName: 'Junior Secondary' }],
};

const submitApplication = vi.fn();
const usePublicSchool = vi.fn();
const usePublicAdmissionOptions = vi.fn();

vi.mock('@/features/public/api', () => ({
  usePublicSchool: (...args: unknown[]) => usePublicSchool(...args),
  usePublicAdmissionOptions: (...args: unknown[]) => usePublicAdmissionOptions(...args),
  useSubmitApplication: () => ({
    mutateAsync: submitApplication,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

const { SiteContentProvider } = await import('./site-context');
const { RegistrationSection } = await import('./components/registration-form');

function renderForm() {
  return renderPage(
    <SiteContentProvider>
      <RegistrationSection />
    </SiteContentProvider>,
    { route: '/s/brightfield', path: '/s/:slug' },
  );
}

/** Fills a labelled control, matching the label exactly enough to be unique. */
async function fill(user: ReturnType<typeof userEvent.setup>, label: RegExp, value: string) {
  await user.type(screen.getByLabelText(label), value);
}

describe('public application form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePublicSchool.mockReturnValue({ data: undefined, isPending: false });
    usePublicAdmissionOptions.mockReturnValue({ data: options, isPending: false });
    submitApplication.mockResolvedValue({
      submittedAt: '2026-09-12T10:00:00.000Z',
      applications: [
        { applicationNo: 'APP/2026-2027/0001', applicantName: 'Amara Okafor', className: 'JSS 1' },
      ],
      contactEmail: 'office@brightfield.test',
    });
  });

  it('asks a parent for their own details before the children', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('radio', { name: /I am a parent or guardian/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // A parent's own details come first: the school writes to them, and one
    // set of details covers every child on the application.
    expect(await screen.findByRole('heading', { name: 'Your details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add the other parent/i })).toBeInTheDocument();
  });

  it('asks an applicant applying for themselves about themselves first', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('radio', { name: /I am the one applying/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    expect(await screen.findByRole('heading', { name: 'About you' })).toBeInTheDocument();
    // Their own address, because the school corresponds with them and not a parent.
    expect(screen.getByLabelText(/Your email/i)).toBeInTheDocument();
    // And no way to add a second applicant: this application is about them.
    expect(screen.queryByRole('button', { name: /Add another child/i })).not.toBeInTheDocument();
  });

  it('will not move past a step whose required fields are empty', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /Next/i }));

    expect(await screen.findByText('Choose who is filling in this form')).toBeInTheDocument();
  });

  it('submits the application as contacts and applicants, not as guardians', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('radio', { name: /I am a parent or guardian/i }));
    await user.click(screen.getByRole('button', { name: /Next/i }));

    await fill(user, /^First name/i, 'Ngozi');
    await fill(user, /^Surname/i, 'Okafor');
    await fill(user, /^Email/i, 'ngozi@example.com');
    await fill(user, /Phone or WhatsApp/i, '+2348030000000');
    await user.click(screen.getByRole('button', { name: /Next/i }));

    await fill(user, /^Surname/i, 'Okafor');
    await fill(user, /^First name/i, 'Amara');
    await user.selectOptions(screen.getByLabelText(/^Gender/i), 'FEMALE');
    await fill(user, /Date of birth/i, '2013-04-11');
    await user.click(screen.getByRole('button', { name: /Next/i }));

    await user.selectOptions(screen.getByLabelText(/Academic session/i), SESSION_ID);
    await user.selectOptions(screen.getByLabelText(/Class applying into/i), CLASS_ID);
    await user.click(screen.getByRole('button', { name: /Next/i }));

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Submit application/i }));

    await waitFor(() => expect(submitApplication).toHaveBeenCalledTimes(1));
    const payload = submitApplication.mock.calls[0][0];
    expect(payload.applicantType).toBe('GUARDIAN');
    expect(payload.sessionId).toBe(SESSION_ID);
    expect(payload.applicants).toHaveLength(1);
    expect(payload.applicants[0]).toMatchObject({ firstName: 'Amara', classId: CLASS_ID });
    // The people on the form travel as contacts. Nothing here asks the API to
    // create a guardian, and nothing on the server does until enrolment.
    expect(payload.contacts[0]).toMatchObject({ email: 'ngozi@example.com', isPrimaryContact: true });
    expect(payload).not.toHaveProperty('guardians');

    // And the family leaves with the reference they will be asked for.
    expect(await screen.findByText('APP/2026-2027/0001')).toBeInTheDocument();
  });
});
