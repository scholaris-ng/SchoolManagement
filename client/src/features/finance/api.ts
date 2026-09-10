/**
 * Public surface of the finance module.
 *
 * The hooks live in sibling files split by sub-feature — fee definitions,
 * invoices and payments — so no one file outgrows the limit in section 17 of
 * the frontend guide. This barrel keeps a single import path for callers.
 */
export type {
  CreateInvoiceInput,
  FinanceOverviewQuery,
  RecordPaymentInput,
} from './finance.endpoints';
export { FinanceEndpoints } from './finance.endpoints';
export * from './use-fees';
export * from './use-invoices';
export * from './use-payments';
