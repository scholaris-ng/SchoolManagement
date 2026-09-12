import {
  createAdmissionSchema,
  publicApplicationSchema,
  transitionAdmissionSchema,
} from '../validators/admissions.schema';

const SESSION_ID = '11111111-2222-4333-8444-555555555555';
const CLASS_ID = '22222222-3333-4444-8555-666666666666';
const APPLICATION_ID = '33333333-4444-4555-8666-777777777777';

const applicant = {
  firstName: 'Amara',
  lastName: 'Okafor',
  gender: 'FEMALE' as const,
  dateOfBirth: '2013-04-11',
};

const contact = {
  firstName: 'Ngozi',
  lastName: 'Okafor',
  relationship: 'MOTHER' as const,
  email: 'ngozi@example.com',
  phone: '+234 803 000 0000',
  isPrimaryContact: true,
};

const wrap = (body: unknown, params: unknown = {}) => ({ body, params, query: {} });

describe('createAdmissionSchema', () => {
  const valid = {
    applicantType: 'GUARDIAN' as const,
    sessionId: SESSION_ID,
    classId: CLASS_ID,
    applicant,
    contacts: [contact],
  };

  it('accepts an application taken at the office', () => {
    expect(createAdmissionSchema.safeParse(wrap(valid)).success).toBe(true);
  });

  it('refuses an application with nobody to contact', () => {
    // A child on the roll with no adult attached leaves the school with nobody
    // to ring, which is a safeguarding gap rather than an untidy record.
    expect(createAdmissionSchema.safeParse(wrap({ ...valid, contacts: [] })).success).toBe(false);
  });

  it('refuses a date of birth in the future', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const result = createAdmissionSchema.safeParse(
      wrap({ ...valid, applicant: { ...applicant, dateOfBirth: tomorrow } }),
    );
    expect(result.success).toBe(false);
  });

  it('lowercases a contact email so invitations later match one person', () => {
    const result = createAdmissionSchema.safeParse(
      wrap({ ...valid, contacts: [{ ...contact, email: 'Ngozi@Example.COM' }] }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body.contacts[0].email).toBe('ngozi@example.com');
  });
});

describe('publicApplicationSchema', () => {
  const params = { slug: 'brightfield' };
  const valid = {
    applicantType: 'GUARDIAN' as const,
    sessionId: SESSION_ID,
    applicants: [{ ...applicant, classId: CLASS_ID }],
    contacts: [contact],
    consentGiven: true,
  };

  it('accepts one parent applying for several children at once', () => {
    const result = publicApplicationSchema.safeParse(
      wrap(
        {
          ...valid,
          applicants: [
            { ...applicant, classId: CLASS_ID },
            { ...applicant, firstName: 'Chidi', classId: CLASS_ID },
          ],
        },
        params,
      ),
    );
    expect(result.success).toBe(true);
  });

  it('refuses a submission without the confirmation tick', () => {
    expect(
      publicApplicationSchema.safeParse(wrap({ ...valid, consentGiven: false }, params)).success,
    ).toBe(false);
  });

  it('caps how many applicants one submission may carry', () => {
    const many = Array.from({ length: 7 }, () => ({ ...applicant, classId: CLASS_ID }));
    expect(
      publicApplicationSchema.safeParse(wrap({ ...valid, applicants: many }, params)).success,
    ).toBe(false);
  });

  it('refuses a class that is not a real reference', () => {
    // The form sends the school's own class ids. Free text here would mean an
    // application nobody can screen, filed against a class that may not exist.
    const result = publicApplicationSchema.safeParse(
      wrap({ ...valid, applicants: [{ ...applicant, classId: 'JSS 1' }] }, params),
    );
    expect(result.success).toBe(false);
  });

  it('refuses a slug that is not a school address', () => {
    expect(
      publicApplicationSchema.safeParse(wrap(valid, { slug: '../../etc/passwd' })).success,
    ).toBe(false);
  });

  it('still requires an adult when the applicant applies for themselves', () => {
    const result = publicApplicationSchema.safeParse(
      wrap({ ...valid, applicantType: 'SELF', contacts: [] }, params),
    );
    expect(result.success).toBe(false);
  });
});

describe('transitionAdmissionSchema', () => {
  it('accepts a decision with a note and a score', () => {
    const result = transitionAdmissionSchema.safeParse(
      wrap({ status: 'SHORTLISTED', note: 'Strong entrance paper.', screeningScore: 78 }, {
        id: APPLICATION_ID,
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body.screeningScore).toBe(78);
  });

  it('refuses a screening score outside the mark range', () => {
    expect(
      transitionAdmissionSchema.safeParse(
        wrap({ status: 'SCREENING', screeningScore: 140 }, { id: APPLICATION_ID }),
      ).success,
    ).toBe(false);
  });

  it('refuses a status the workflow does not have', () => {
    expect(
      transitionAdmissionSchema.safeParse(
        wrap({ status: 'ENROLLED' }, { id: APPLICATION_ID }),
      ).success,
    ).toBe(false);
  });
});
