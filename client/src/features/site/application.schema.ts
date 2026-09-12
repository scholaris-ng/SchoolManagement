import { z } from 'zod';
import {
  applicantSchema,
  applicationContactSchema,
  requireOwnContactDetails,
} from '@/features/admissions/schema';

/**
 * The application a family fills in on the school's own website.
 *
 * It is the office form's schema with two differences, and they are the two
 * things a public form has to handle that a desk does not. A parent moving
 * three children should type their own details once, so the applicant is an
 * array. And whoever is filling it in has to say which of them they are,
 * because that decides what the rest of the form asks for and who the school
 * writes back to.
 */

export const siteApplicantSchema = applicantSchema.extend({
  classId: z.string().min(1, 'Choose the class being applied for'),
});

export const siteApplicationSchema = z
  .object({
    applicantType: z.enum(['GUARDIAN', 'SELF'], {
      errorMap: () => ({ message: 'Choose who is filling in this form' }),
    }),
    sessionId: z.string().min(1, 'Choose the session you are applying for'),
    applicants: z
      .array(siteApplicantSchema)
      .min(1, 'Add the details of at least one applicant')
      .max(6, 'Six is the most one submission can carry. Please send the rest separately.'),
    contacts: z
      .array(applicationContactSchema)
      .min(1, 'Add at least one parent or guardian')
      .max(4, 'Four contacts is the most an application can carry'),
    consentGiven: z.literal(true, {
      errorMap: () => ({ message: 'Please confirm the details are correct before submitting' }),
    }),
  })
  .superRefine((values, context) => {
    if (values.applicantType !== 'SELF') return;

    // Somebody applying for themselves is one person, and the school will be
    // writing to them rather than to a parent.
    if (values.applicants.length > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['applicants'],
        message: 'An application you are making for yourself covers one person.',
      });
    }
    if (values.applicants[0]) {
      requireOwnContactDetails(values.applicants[0], context, ['applicants', 0]);
    }
  });

export type SiteApplicationValues = z.infer<typeof siteApplicationSchema>;
export type SiteApplicantValues = z.infer<typeof siteApplicantSchema>;

export const emptySiteApplicant: SiteApplicantValues = {
  firstName: '',
  middleName: '',
  lastName: '',
  gender: 'MALE',
  dateOfBirth: '',
  classId: '',
  nationality: '',
  stateOfOrigin: '',
  address: '',
  city: '',
  state: '',
  previousSchool: '',
  previousClass: '',
  bloodGroup: '',
  medicalNotes: '',
  email: '',
  phone: '',
};

export const emptySiteContact = {
  title: '',
  firstName: '',
  lastName: '',
  relationship: 'MOTHER' as const,
  email: '',
  phone: '',
  occupation: '',
  address: '',
  city: '',
  state: '',
  isPrimaryContact: false,
};

/**
 * Which steps this application walks through.
 *
 * Derived from the answer to the first question rather than fixed, because the
 * two paths genuinely differ: a parent describes themselves and then their
 * children, while an applicant describes themselves, their schooling, and then
 * the adult the school should call.
 */
export interface ApplicationStep {
  id: 'who' | 'contacts' | 'applicants' | 'schooling' | 'review';
  legend: string;
  /** Shown under the heading of the step itself. */
  hint: string;
}

export function stepsFor(applicantType: 'GUARDIAN' | 'SELF' | null): ApplicationStep[] {
  const who: ApplicationStep = {
    id: 'who',
    legend: 'You',
    hint: 'Tell us who is filling in this form.',
  };
  const review: ApplicationStep = {
    id: 'review',
    legend: 'Review',
    hint: 'Check everything reads correctly, then send it to the school.',
  };

  if (applicantType === 'SELF') {
    return [
      who,
      {
        id: 'applicants',
        legend: 'About you',
        hint: 'Your names as they appear on your documents.',
      },
      {
        id: 'schooling',
        legend: 'Schooling',
        hint: 'Where you are applying to, and where you are coming from.',
      },
      {
        id: 'contacts',
        legend: 'Next of kin',
        hint: 'A parent, guardian or next of kin the school can reach.',
      },
      review,
    ];
  }

  return [
    who,
    {
      id: 'contacts',
      legend: 'Your details',
      hint: 'The school writes to you about this application.',
    },
    {
      id: 'applicants',
      legend: 'Your child',
      hint: 'Add each child you are applying for.',
    },
    {
      id: 'schooling',
      legend: 'Schooling',
      hint: 'Which class each child is applying into.',
    },
    review,
  ];
}

/**
 * The exact leaf paths a step owns, so "Next" checks what is on screen and
 * nothing else.
 *
 * Enumerated rather than given as a prefix: react-hook-form validates by exact
 * field name, and asking it about `applicants.0` would mark the whole object
 * as one error with no message to show. It would also refuse to move on from
 * the step that collects a child's name because a field two steps later is
 * still empty, which is the single most infuriating thing a wizard can do.
 */
export function fieldsForStep(
  step: ApplicationStep['id'],
  applicantType: 'GUARDIAN' | 'SELF' | null,
  counts: { applicants: number; contacts: number },
): string[] {
  const perApplicant = (fields: string[]) =>
    Array.from({ length: counts.applicants }, (_, index) =>
      fields.map((field) => `applicants.${index}.${field}`),
    ).flat();

  switch (step) {
    case 'who':
      return ['applicantType'];

    case 'applicants':
      return perApplicant([
        'firstName',
        'middleName',
        'lastName',
        'gender',
        'dateOfBirth',
        'address',
        'city',
        'state',
        'nationality',
        'stateOfOrigin',
        // Only somebody applying for themselves is written to directly — see
        // `ApplicantsStep`.
        ...(applicantType === 'SELF' ? ['email', 'phone'] : []),
      ]);

    case 'schooling':
      return [
        'sessionId',
        ...perApplicant([
          'classId',
          'previousSchool',
          'previousClass',
          'bloodGroup',
          'medicalNotes',
        ]),
      ];

    case 'contacts':
      return Array.from({ length: counts.contacts }, (_, index) =>
        [
          'title',
          'firstName',
          'lastName',
          'relationship',
          'email',
          'phone',
          'occupation',
          'address',
          'city',
          'state',
        ].map((field) => `contacts.${index}.${field}`),
      ).flat();

    default:
      return [];
  }
}
