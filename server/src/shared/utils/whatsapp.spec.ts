import {
  buildShareMessage,
  chooseRecipient,
  formatMessageDate,
  guardianGreeting,
  toWhatsAppNumber,
} from './whatsapp';

describe('toWhatsAppNumber', () => {
  it.each([
    ['08031234567', '2348031234567'],
    ['0803 123 4567', '2348031234567'],
    ['0803-123-4567', '2348031234567'],
    ['+234 803 123 4567', '2348031234567'],
    ['+2348031234567', '2348031234567'],
    ['2348031234567', '2348031234567'],
    ['(0803) 123 4567', '2348031234567'],
    ['8031234567', '2348031234567'],
    ['00234 803 123 4567', '2348031234567'],
  ])('turns the Nigerian number %s into %s', (raw, expected) => {
    expect(toWhatsAppNumber(raw)).toBe(expected);
  });

  it('drops the trunk zero people keep after the country code', () => {
    expect(toWhatsAppNumber('+234 0803 123 4567')).toBe('2348031234567');
  });

  it('leaves another country’s number alone', () => {
    expect(toWhatsAppNumber('+1 415 555 2671')).toBe('14155552671');
    expect(toWhatsAppNumber('0044 7911 123456')).toBe('447911123456');
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['not a number'],
    ['0803'],
    ['+234 803 123'],
    ['+0803 123 4567'],
    ['1234567890123456789'],
  ])('gives nothing for %p, so WhatsApp asks who to send it to', (raw) => {
    expect(toWhatsAppNumber(raw)).toBeNull();
  });
});

describe('guardianGreeting', () => {
  it('uses the title and surname when there is a title', () => {
    expect(guardianGreeting({ title: 'Mrs', firstName: 'Ada', lastName: 'Chizea' })).toBe('Mrs Chizea');
  });

  it('uses the full name when there is not', () => {
    expect(guardianGreeting({ title: null, firstName: 'Ada', lastName: 'Chizea' })).toBe('Ada Chizea');
    expect(guardianGreeting({ title: '  ', firstName: 'Ada', lastName: 'Chizea' })).toBe('Ada Chizea');
  });
});

describe('chooseRecipient', () => {
  const guardian = (over: Record<string, unknown> = {}) => ({
    id: 'g',
    title: 'Mrs',
    firstName: 'Ada',
    lastName: 'Chizea',
    phone: '08031234567',
    altPhone: null,
    ...over,
  });

  it('addresses the first guardian and opens straight to their number', () => {
    const first = guardian();
    expect(chooseRecipient([first, guardian({ id: 'h', phone: '08099999999' })])).toEqual({
      guardian: first,
      greeting: 'Mrs Chizea',
      phone: '2348031234567',
      notice: null,
    });
  });

  it('skips a guardian with no usable number for one who has', () => {
    const payer = guardian({ id: 'payer', phone: '+23480123456' });
    const other = guardian({ id: 'other', title: 'Mr', lastName: 'Okafor', phone: '+2348021234567' });

    const recipient = chooseRecipient([payer, other]);

    expect(recipient.guardian).toBe(other);
    expect(recipient.greeting).toBe('Mr Okafor');
    expect(recipient.phone).toBe('2348021234567');
    expect(recipient.notice).toBeNull();
  });

  it('falls back to the alternate number before moving on', () => {
    const recipient = chooseRecipient([guardian({ phone: '+23480123456', altPhone: '0803 123 4567' })]);
    expect(recipient.phone).toBe('2348031234567');
    expect(recipient.notice).toBeNull();
  });

  it('says so when the only number on file is incomplete, without repeating it', () => {
    // `+234` and eight digits: two short of a Nigerian number.
    const first = guardian({ phone: '+23480123456' });
    const recipient = chooseRecipient([first]);

    expect(recipient.guardian).toBe(first);
    expect(recipient.greeting).toBe('Mrs Chizea');
    expect(recipient.phone).toBeNull();
    expect(recipient.notice).toContain("Ada Chizea's number is not a complete phone number");
    expect(recipient.notice).not.toContain('23480123456');
  });

  it('says so when there is no number at all', () => {
    const recipient = chooseRecipient([guardian({ phone: '' })]);
    expect(recipient.phone).toBeNull();
    expect(recipient.notice).toContain('has no phone number on file');
  });

  it('says so when the child has no guardian', () => {
    expect(chooseRecipient([])).toEqual({
      guardian: null,
      greeting: 'Parent/Guardian',
      phone: null,
      notice: expect.stringContaining('no guardian on file'),
    });
  });
});

describe('formatMessageDate', () => {
  it('writes the day the way the message template shows it', () => {
    expect(formatMessageDate(new Date('2026-08-22T09:00:00Z'))).toBe('Sat Aug 22 2026');
  });

  it('reads the day in Lagos, not UTC', () => {
    // 23:30 UTC on the 21st is already half past midnight on the 22nd in Lagos.
    expect(formatMessageDate(new Date('2026-08-21T23:30:00Z'))).toBe('Sat Aug 22 2026');
  });
});

describe('buildShareMessage', () => {
  const base = {
    greeting: 'Mrs Chizea',
    subject: "Ada Chizea's invoice for First Term (2026/2027)",
    fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/scholaris/finance/invoice/x.pdf',
    confidential: true,
    schoolName: 'AB.10 Schools',
    contactEmail: 'bursar@ab10.example',
    now: new Date('2026-08-22T09:00:00Z'),
  };

  it('carries the link, the date, and the school’s details', () => {
    expect(buildShareMessage(base)).toBe(
      [
        "Dear Mrs Chizea, Ada Chizea's invoice for First Term (2026/2027) is ready. You can view it by clicking the secure link below:",
        '',
        'File: https://res.cloudinary.com/demo/raw/upload/v1/scholaris/finance/invoice/x.pdf',
        'Date: Sat Aug 22 2026',
        '',
        'Please note that this document contains confidential financial information intended only for you. Let us know if you have any questions.',
        '',
        'Best regards,',
        '',
        'Accounts Office',
        'AB.10 Schools',
        'bursar@ab10.example',
      ].join('\n'),
    );
  });

  it('leaves the confidentiality line off a document meant for anyone', () => {
    const message = buildShareMessage({ ...base, confidential: false });
    expect(message).not.toContain('confidential');
    expect(message).toContain('Let us know if you have any questions.');
  });

  it('leaves the email line off when the school has none', () => {
    const message = buildShareMessage({ ...base, contactEmail: undefined });
    expect(message.endsWith('AB.10 Schools')).toBe(true);
  });
});
