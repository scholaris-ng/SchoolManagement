import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../config/constants';
import { PERIOD_ORDER_ISSUE, periodIsOrdered, periodQueryFields } from './period.schema';

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
      // The day the invoice was issued, not the day it falls due.
      ...periodQueryFields,
    })
    .strict()
    .refine(periodIsOrdered, PERIOD_ORDER_ISSUE),
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
    /**
     * Which of the fee item's own accounts (`fee-item-dialog.tsx`) this
     * charge is billed under. Omitted means every account the item has, the
     * same default `fee-structure-dialog.tsx` uses; an id that is not
     * actually one of the item's accounts is silently dropped rather than
     * rejected, the same leniency `feeItems.schema.ts` documents for that
     * screen.
     */
    accountIds: z.array(z.string().uuid()).max(10).optional(),
    /**
     * Which of the fee item's own named `priceOptions` (`fee-item-dialog.tsx`)
     * this charge is billed at, instead of the item's own `amount` — still
     * picked from a list the school already set up, not a figure the browser
     * names, same discipline as the unit amount itself. Omitted, or an id
     * that isn't actually one of the item's options, bills the item's `amount`.
     */
    priceOptionId: z.string().uuid().optional(),
  })
  .strict();

/**
 * A charge on an invoice being *edited*. The same as a new one, plus whether the
 * person left its price alone.
 *
 * An edit re-prices the bill from the fee list as it stands now, which is right
 * for a charge somebody just added and wrong for one they never touched: tuition
 * billed at ₦55,000 last term must not become ₦70,000 because removing a
 * different charge re-priced the whole invoice. `keepSavedPrice` says "this is
 * the charge already on the invoice, at the price it is already at" — and is
 * only ever honoured against a charge of that fee item that is really there, so
 * it can reuse an amount the invoice already carries but never name a new one.
 */
const editLine = invoiceLine.extend({
  keepSavedPrice: z.boolean().optional(),
  /**
   * The same, for the discount: nobody retyped it, so keep what this charge
   * already had taken off. Without it an edit would silently drop every discount
   * keyed by hand, because only the named ones can be worked out again.
   */
  keepSavedDiscount: z.boolean().optional(),
});

const editLines = z
  .array(editLine)
  .min(1, 'An invoice needs at least one charge')
  .max(50, 'That is more charges than one invoice should carry')
  .refine(
    (lines) => new Set(lines.map((line) => line.feeItemId)).size === lines.length,
    'The same fee item appears twice — change the quantity instead',
  );

/**
 * One discount the bursar ticked for this bill, and which of its lines it
 * should come off — on top of whatever the student has been granted
 * (`StudentDiscount`), which always applies to every line. The amount is
 * worked out server-side from the discount's own definition, never accepted
 * from the request, for the same reason a line's price never is; `feeItemIds`
 * only narrows which lines it reaches, and only within whatever the discount
 * was already defined to allow (`InvoicesService.discountsFor`) — empty means
 * every line the discount can otherwise reach.
 */
const invoiceDiscount = z
  .object({
    discountId: z.string().uuid(),
    feeItemIds: z.array(z.string().uuid()).max(50).default([]),
  })
  .strict();

const invoiceDiscounts = z
  .array(invoiceDiscount)
  .max(10, 'That is more discounts than one invoice needs')
  .refine(
    (entries) => new Set(entries.map((entry) => entry.discountId)).size === entries.length,
    'The same discount appears twice',
  );

/**
 * A follow-up bill: `carryInvoiceIds` names earlier invoices of this same
 * student and term whose unpaid balance moves onto the new one, closing them
 * (`InvoicesService.issueInvoices`). Same-term invoices are otherwise left
 * alone — a school raising tuition and boarding as two bills has not created
 * arrears — so this is an explicit choice, never inferred. A bill that carries
 * something needs no charges of its own.
 */
export const createInvoiceSchema = z.object({
  body: z
    .object({
      studentId: z.string().uuid('Choose the student this is for'),
      termId: z.string().uuid('Choose the term this bill covers'),
      dueDate: isoDate,
      lines: z
        .array(invoiceLine)
        .max(50, 'That is more charges than one invoice should carry')
        .refine(
          (lines) => new Set(lines.map((line) => line.feeItemId)).size === lines.length,
          'The same fee item appears twice — change the quantity instead',
        ),
      discounts: invoiceDiscounts.default([]),
      carryInvoiceIds: z
        .array(z.string().uuid())
        .max(20)
        .refine((ids) => new Set(ids).size === ids.length, 'The same invoice appears twice')
        .default([]),
      note: z.string().trim().max(2000).optional().or(z.literal('')),
    })
    .strict()
    .refine((body) => body.lines.length > 0 || body.carryInvoiceIds.length > 0, {
      message: 'An invoice needs at least one charge',
      path: ['lines'],
    }),
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
      lines: editLines.optional(),
      /** Only read alongside `lines`. Omitted, the invoice keeps the discounts it already carries. */
      discounts: invoiceDiscounts.optional(),
      /**
       * Why this edit was made, kept with the version it creates. Required by
       * the service whenever what the family is billed actually changes — it is
       * not required here, because a due-date edit sends none and an edit that
       * turns out to change nothing is not a version at all.
       */
      reason: z.string().trim().max(500).optional(),
      /**
       * Corrections to the charges this invoice took over from an earlier one —
       * the "brought forward" items. Each entry replaces that earlier invoice's
       * own charges wholesale, exactly as `lines` does for this one; the balance
       * carried here follows. An earlier invoice can only be named if this one
       * absorbed it.
       */
      carried: z
        .array(
          z
            .object({
              invoiceId: z.string().uuid(),
              lines: editLines,
              /** Omitted, the earlier invoice keeps the discounts it already carries. */
              discounts: invoiceDiscounts.optional(),
            })
            .strict(),
        )
        .max(10, 'That is more earlier invoices than one bill should carry')
        .refine(
          (entries) => new Set(entries.map((entry) => entry.invoiceId)).size === entries.length,
          'The same earlier invoice appears twice',
        )
        .optional(),
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

/**
 * Emailing one invoice to a guardian a bursar has picked by hand. The
 * guardian must already be linked to the invoice's own student — checked in
 * the service, not here — so this can never be used to email a bill to
 * someone with no relationship to the child it is for.
 */
export const sendInvoiceEmailSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ guardianId: z.string().uuid() }).strict(),
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
export type SendInvoiceEmailInput = z.infer<typeof sendInvoiceEmailSchema>['body'];
