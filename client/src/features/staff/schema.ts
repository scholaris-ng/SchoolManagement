import { z } from 'zod';
import { ROLES } from '@/types/rbac';

const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number');

export const staffFormSchema = z.object({
  staffNo: z.string().trim().min(1, 'Staff number is required').max(40),
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Surname is required').max(60),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address').toLowerCase(),
  phone,
  gender: z.enum(['MALE', 'FEMALE']),
  designation: z.string().trim().min(1, 'Designation is required').max(120),
  department: z.string().trim().max(120).optional().or(z.literal('')),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']),
  employmentDate: z.string().min(1, 'Employment date is required'),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'EXITED']),
  photoUrl: z.string().url().nullable().optional(),
  photoStoragePath: z.string().nullable().optional(),
  /**
   * Roles are what the server turns into permissions. Sending role *names*
   * rather than a permission list keeps the client out of the authorisation
   * decision entirely (spec section 5).
   */
  roleNames: z.array(z.enum(ROLES)).min(1, 'Give this member of staff at least one role'),
  subjectIds: z.array(z.string()).default([]),
  classIds: z.array(z.string()).default([]),
  isFormTeacher: z.boolean().default(false),
});

export type StaffFormValues = z.infer<typeof staffFormSchema>;
