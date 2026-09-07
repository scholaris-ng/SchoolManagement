import { z } from 'zod';

const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number');

export const admissionGuardianSchema = z.object({
  title: z.string().trim().max(16).optional().or(z.literal('')),
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Surname is required').max(60),
  relationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'SPONSOR', 'OTHER']),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address').toLowerCase(),
  phone,
  occupation: z.string().trim().max(120).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  isPrimaryContact: z.boolean().default(false),
});

export const admissionFormSchema = z.object({
  sessionId: z.string().min(1, 'Choose the session being applied for'),
  levelId: z.string().min(1, 'Choose the level being applied for'),
  applicant: z.object({
    firstName: z.string().trim().min(1, 'First name is required').max(60),
    middleName: z.string().trim().max(60).optional().or(z.literal('')),
    lastName: z.string().trim().min(1, 'Surname is required').max(60),
    gender: z.enum(['MALE', 'FEMALE']),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    photoUrl: z.string().url().nullable().optional(),
    nationality: z.string().trim().max(60).optional().or(z.literal('')),
    stateOfOrigin: z.string().trim().max(60).optional().or(z.literal('')),
    address: z.string().trim().max(300).optional().or(z.literal('')),
    previousSchool: z.string().trim().max(160).optional().or(z.literal('')),
    bloodGroup: z.string().trim().max(8).optional().or(z.literal('')),
    medicalNotes: z.string().trim().max(2000).optional().or(z.literal('')),
  }),
  /** At least one guardian: an application with no adult attached is unusable. */
  guardians: z.array(admissionGuardianSchema).min(1, 'Add at least one parent or guardian'),
});

export type AdmissionFormValues = z.infer<typeof admissionFormSchema>;

export const conversionSchema = z.object({
  admissionNo: z.string().trim().min(1, 'Give the new student an admission number').max(40),
  classId: z.string().min(1, 'Choose the class they will join'),
});

export type ConversionValues = z.infer<typeof conversionSchema>;
