import {
  escapeHtml,
  sendPasswordResetEmail,
  sendSchoolReadyEmail,
  sendStaffAccountEmail,
  sendGuardianInviteEmail,
} from '../utils/mailer';

const sendMail = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: () => ({ sendMail: (args: unknown) => sendMail(args) }) },
}));

jest.mock('../../config/env', () => ({
  env: {
    appUrl: 'https://app.test',
    email: {
      configured: true,
      host: 'smtp.test',
      port: 587,
      user: 'no-reply@scholaris.test',
      password: 'secret',
      fromName: 'Scholaris',
    },
  },
}));

function lastSend(): { subject: string; html: string; text: string } {
  expect(sendMail).toHaveBeenCalled();
  return sendMail.mock.calls[sendMail.mock.calls.length - 1][0];
}

/** The hidden line an inbox shows beside the subject, before anything is opened. */
function preheaderOf(html: string): string {
  return html.match(/mso-hide:all">([^<]*)</)?.[1] ?? '';
}

describe('escapeHtml', () => {
  it('escapes the characters a typed school name actually carries', () => {
    expect(escapeHtml('St Mary & St John')).toBe('St Mary &amp; St John');
    expect(escapeHtml('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;');
    expect(escapeHtml(`Ade's "School"`)).toBe('Ade&#39;s &quot;School&quot;');
  });
});

describe('sendSchoolReadyEmail', () => {
  /*
    The plan was a hardcoded "Trial" in this template. It was wrong for any
    school that did not arrive on one, and commercial wording has no business
    in the mail announcing that a school is set up.
  */
  it('says nothing about plans, trials or subscriptions', async () => {
    await sendSchoolReadyEmail({
      to: 'ada@brightfield.edu.ng',
      firstName: 'Adaeze',
      schoolName: 'Brightfield Academy',
      schoolCode: 'BFA',
    });

    const { html, text } = lastSend();
    expect(html).not.toMatch(/plan|trial|subscri|billing|upgrade/i);
    expect(text).not.toMatch(/plan|trial|subscri|billing|upgrade/i);
  });

  it('still carries the school, its code and the next step', async () => {
    await sendSchoolReadyEmail({
      to: 'ada@brightfield.edu.ng',
      firstName: 'Adaeze',
      schoolName: 'Brightfield Academy',
      schoolCode: 'BFA',
    });

    const { html } = lastSend();
    expect(html).toContain('Brightfield Academy');
    expect(html).toContain('BFA');
    expect(html).toContain('https://app.test/settings');
  });

  it('escapes a school name rather than letting it break the markup', async () => {
    await sendSchoolReadyEmail({
      to: 'head@kings.edu.ng',
      firstName: 'Emeka',
      schoolName: 'Kings & Queens',
      schoolCode: 'KQ',
    });

    const { html } = lastSend();
    expect(html).toContain('Kings &amp; Queens');
    expect(html).not.toContain('Kings & Queens');
  });
});

describe('sendStaffAccountEmail', () => {
  const staff = {
    to: 'chidinma.eze@brightfield.edu.ng',
    firstName: 'Chidinma',
    schoolName: 'Brightfield Academy',
    designation: 'Mathematics teacher',
    temporaryPassword: 'Kq7!vbnm2xZa',
  };

  it('tells a new employee about their job, not about the school account', async () => {
    await sendStaffAccountEmail(staff);

    const { html } = lastSend();
    expect(html).toContain('Mathematics teacher');
    expect(html).not.toMatch(/plan|trial|subscri|billing/i);
  });

  it('keeps the temporary password out of the inbox preview line', async () => {
    await sendStaffAccountEmail(staff);

    const { html } = lastSend();
    // In the message itself, which the reader has chosen to open.
    expect(html).toContain(staff.temporaryPassword);
    // Not on a lock screen, in front of whoever is holding the phone.
    expect(preheaderOf(html)).not.toContain(staff.temporaryPassword);
    expect(preheaderOf(html)).toContain('Brightfield Academy');
  });

  it('offers the sign-in address as plain text as well as a button', async () => {
    await sendStaffAccountEmail(staff);

    const { html } = lastSend();
    expect(html).toContain('Or paste this into your browser: https://app.test/sign-in');
  });
});

describe('sendPasswordResetEmail', () => {
  const reset = {
    to: 'chidinma.eze@brightfield.edu.ng',
    firstName: 'Chidinma',
    resetUrl: 'https://auth.test/reset?oobCode=abc123',
    expiresInHours: 1,
  };

  it('carries the link as a button and as text, in our own template', async () => {
    await sendPasswordResetEmail(reset);

    const { html, subject } = lastSend();
    expect(subject).toBe('Reset your password — Scholaris');
    // The Scholaris shell, not the identity provider's unbranded mail.
    expect(html).toContain('Schol');
    expect(html).toContain(`href="${reset.resetUrl}"`);
    expect(html).toContain(`Or paste this into your browser: ${reset.resetUrl}`);
  });

  it('keeps the link out of the inbox preview line', async () => {
    await sendPasswordResetEmail(reset);

    // The link alone is enough to take over the account, and a preheader shows
    // on a locked phone.
    expect(preheaderOf(lastSend().html)).not.toContain('oobCode');
  });

  it('says how long the link lasts, in words that read properly at one hour', async () => {
    await sendPasswordResetEmail(reset);
    expect(lastSend().text).toContain('expires in one hour');

    await sendPasswordResetEmail({ ...reset, expiresInHours: 6 });
    expect(lastSend().text).toContain('expires in 6 hours');
  });
});

describe('sendGuardianInviteEmail', () => {
  it('keeps the code out of the preview line', async () => {
    await sendGuardianInviteEmail({
      to: 'parent@example.test',
      firstName: 'Ngozi',
      schoolName: 'Brightfield Academy',
      childNames: ['Ada Eze'],
      code: '418923',
      expiresInMinutes: 15,
    });

    const { html } = lastSend();
    expect(html).toContain('418923');
    expect(preheaderOf(html)).not.toContain('418923');
  });
});
