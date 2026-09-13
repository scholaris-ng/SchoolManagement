import { z } from 'zod';

/** Mirrors `assessmentBody` in `server/src/modules/cbt/validators/cbt.schema.ts`. */
export const assessmentFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the paper a title').max(160),
    mode: z.enum(['PRACTICE', 'EXAM']),
    subjectId: z.string().trim().min(1, 'Choose a subject'),
    classIds: z.array(z.string()).min(1, 'Choose at least one class'),
    termId: z.string().trim().min(1, 'Choose a term'),
    questionIds: z.array(z.string()).min(1, 'Add at least one question'),
    durationMinutes: z.number().int().min(1).max(600),
    attemptsAllowed: z.number().int().min(1).max(20),
    /** `datetime-local` input values, or `''` for no boundary. */
    startsAt: z.string().optional().or(z.literal('')),
    endsAt: z.string().optional().or(z.literal('')),
    shuffleQuestions: z.boolean().default(true),
    shuffleOptions: z.boolean().default(true),
    showResultImmediately: z.boolean().default(true),
    passScore: z.number().int().min(0).max(100),
  })
  .refine((value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt, {
    message: 'A paper cannot close before it opens.',
    path: ['endsAt'],
  });

export type AssessmentFormValues = z.infer<typeof assessmentFormSchema>;
