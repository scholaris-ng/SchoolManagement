import { z } from 'zod';

export const studentScopedSchema = z.object({
  params: z.object({ studentId: z.string().uuid() }),
});

export const addDocumentSchema = z.object({
  params: z.object({ studentId: z.string().uuid() }),
  body: z
    .object({
      name: z.string().trim().min(1, 'Give the document a name.').max(200),
      category: z.enum([
        'BIRTH_CERTIFICATE',
        'PREVIOUS_RESULT',
        'MEDICAL',
        'PHOTO',
        'TRANSFER',
        'OTHER',
      ]),
      storagePath: z.string().trim().min(1).max(500),
      downloadUrl: z.string().url().max(1000).optional().or(z.literal('')),
      mimeType: z.string().trim().min(1).max(120),
      // 50 MB. Large enough for a scanned birth certificate, small enough that
      // a mistake does not fill the bucket.
      sizeBytes: z.coerce.number().int().min(0).max(50 * 1024 * 1024),
    })
    .strict(),
});

export const removeDocumentSchema = z.object({
  params: z.object({
    studentId: z.string().uuid(),
    documentId: z.string().uuid(),
  }),
});

export type AddDocumentInput = z.infer<typeof addDocumentSchema>['body'];
export type { PromoteStudentsInput } from './students.schema';
