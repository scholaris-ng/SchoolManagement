import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';

/**
 * Mirrors `CreateInvoiceInput` in `client/src/features/finance/finance.endpoints.ts`
 * and the query the invoices list sends.
 *
 * `UNPAID` and `OVERDUE` are in the status enum even though neither is a
 * stored state: they are what the screen's filter offers, and the repository
 * translates them. `DRAFT` is not, because this server never writes one.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form');

export const fetchInvoicesSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
      search: z.string().trim().max(120).optional(),
      sortBy: z.enum(['invoiceNo', 'dueDate', 'issueDate', 'total', 'balance']).optional(),
      sortDir: z.enum(['asc', 'desc']).default('desc'),
      status: z
        .enum(['UNPAID', 'OVERDUE', 'ISSUED', 'PART_PAID', 'PAID', 'CANCELLED'])
        .optional(),
      termId: z.string().uuid().optional(),
      classId: z.string().uuid().optional(),
      studentId: z.string().uuid().optional(),
    })
    .strict(),
});

export const invoiceParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

/**
 * One invoice, raised by hand.
 *
 * The unit amount is *not* accepted from the request: it is read from the fee
 * item server-side. A bursar chooses what to charge for and how much to waive;
 * letting the browser name the price would make an invoice a claim about the
 * school's fees that the school never made.
 */
const invoiceLine = z
  .object({
    feeItemId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(100).default(1),
    discountAmount: z.coerce.number().min(0, 'A discount cannot be negative').default(0),
  })
  .strict();

const invoiceLines = z
  .array(invoiceLine)
  .min(1, 'An invoice needs at least one charge')
  .max(50, 'That is more charges than one invoice should carry')
  .refine(
    (lines) => new Set(lines.map((line) => line.feeItemId)).size === lines.length,
    'The same fee item appears twice — change the quantity instead',
  );

export const createInvoiceSchema = z.object({
  body: z
    .object({
      studentId: z.string().uuid('Choose the student this is for'),
      termId: z.string().uuid('Choose the term this bill covers'),
      dueDate: isoDate,
      lines: invoiceLines,
      note: z.string().trim().max(2000).optional().or(z.literal('')),
    })
    .strict(),
});

/**
 * Editing an issued invoice. The student and term never change here — those
 * are what the bill is *for*, not what it says; a mistake there is undone by
 * deleting the invoice and raising a fresh one, not by editing this one into
 * a different family's bill.
 *
 * `lines`, when present, is refused server-side once any money has landed on
 * the invoice (`InvoicesService.updateInvoice`) — the amount an issued,
 * paid-against bill claims has to stay put.
 */
export const updateInvoiceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      dueDate: isoDate.optional(),
      note: z.string().trim().max(2000).optional().or(z.literal('')),
      lines: invoiceLines.optional(),
    })
    .strict(),
});

/** One id or a hundred — a single "Delete" button posts an array of one. */
export const bulkDeleteInvoicesSchema = z.object({
  body: z
    .object({
      ids: z.array(z.string().uuid()).min(1, 'Choose at least one invoice').max(200),
    })
    .strict(),
});

/**
 * Cancelling is not deleting, so the reason is required: the row survives, and
 * the parent who was sent the bill is owed an explanation of why it went away.
 */
export const cancelInvoiceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      reason: z
        .string()
        .trim()
        .min(3, 'Say briefly why this invoice is being cancelled')
        .max(500),
    })
    .strict(),
});

export const studentLedgerParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const fetchDebtorsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
      search: z.string().trim().max(120).optional(),
      sortBy: z.enum(['balance', 'studentName', 'className', 'overdueInvoices']).optional(),
      sortDir: z.enum(['asc', 'desc']).default('desc'),
      classId: z.string().uuid().optional(),
      // A query string has no booleans. The client's filter bar sends the word.
      overdueOnly: z.enum(['true', 'false']).optional(),
    })
    .strict(),
});

export type FetchInvoicesQuery = z.infer<typeof fetchInvoicesSchema>['query'];
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>['body'];
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>['body'];
export type BulkDeleteInvoicesInput = z.infer<typeof bulkDeleteInvoicesSchema>['body'];
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>['body'];
export type FetchDebtorsQuery = z.infer<typeof fetchDebtorsSchema>['query'];
