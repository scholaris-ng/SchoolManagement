import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

export const IMPORT_ENTITIES = ['STUDENTS', 'GUARDIANS', 'STAFF', 'SUBJECTS', 'FEES'] as const;

/**
 * A whole file arrives as JSON in one request, and the rows are then held on
 * the job row until commit. A cap keeps that payload — and the jsonb column it
 * lands in — bounded; it is far above any real school's roll.
 */
export const MAX_IMPORT_ROWS = 5000;

const cellRow = z.record(z.string(), z.string());

export const validateImportSchema = z.object({
  body: z
    .object({
      entity: z.enum(IMPORT_ENTITIES),
      fileName: z.string().trim().min(1).max(255),
      mapping: z.record(z.string(), z.string().nullable()),
      rows: z
        .array(cellRow)
        .min(1, 'That file has no rows to import.')
        .max(
          MAX_IMPORT_ROWS,
          `A single import can hold up to ${MAX_IMPORT_ROWS.toLocaleString()} rows. Split the file and import it in parts.`,
        ),
    })
    .strict(),
});

export const commitImportSchema = z.object({
  body: z
    .object({
      importId: z.string().uuid(),
      skipInvalidRows: z.boolean(),
    })
    .strict(),
});

export const fetchImportJobsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  }),
});

export type ValidateImportInput = z.infer<typeof validateImportSchema>['body'];
export type CommitImportInput = z.infer<typeof commitImportSchema>['body'];
export type FetchImportJobsQuery = z.infer<typeof fetchImportJobsSchema>['query'];
