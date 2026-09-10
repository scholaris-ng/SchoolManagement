import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { guarded } from './guarded';

/**
 * Fees, invoices, payments and debtors.
 *
 * Every page is code-split: a parent on a phone downloads the dashboard and
 * their children's results, not the bursar's invoicing screens. `AppShell`
 * already provides the Suspense boundary these lazy chunks need.
 */

/* -- Finance --------------------------------------------------------------- */
const FinanceOverviewPage = lazy(() =>
  import('@/features/finance/finance-overview-page').then((m) => ({
    default: m.FinanceOverviewPage,
  })),
);
const FeesPage = lazy(() =>
  import('@/features/finance/fees-page').then((m) => ({ default: m.FeesPage })),
);
const InvoicesPage = lazy(() =>
  import('@/features/finance/invoices-page').then((m) => ({ default: m.InvoicesPage })),
);
const InvoiceFormPage = lazy(() =>
  import('@/features/finance/invoice-form-page').then((m) => ({ default: m.InvoiceFormPage })),
);
const InvoiceDetailPage = lazy(() =>
  import('@/features/finance/invoice-detail-page').then((m) => ({ default: m.InvoiceDetailPage })),
);
const PaymentsPage = lazy(() =>
  import('@/features/finance/payments-page').then((m) => ({ default: m.PaymentsPage })),
);
const PaymentFormPage = lazy(() =>
  import('@/features/finance/payment-form-page').then((m) => ({ default: m.PaymentFormPage })),
);
const ReceiptPage = lazy(() =>
  import('@/features/finance/receipt-page').then((m) => ({ default: m.ReceiptPage })),
);
const DebtorsPage = lazy(() =>
  import('@/features/finance/debtors-page').then((m) => ({ default: m.DebtorsPage })),
);

/* -- Behaviour & safety ---------------------------------------------------- */

export const financeRoutes: RouteObject[] = [
  {
    element: guarded('fee.manage'),
    children: [{ path: 'finance/fees', element: <FeesPage /> }],
  },
  {
    element: guarded('invoice.manage'),
    children: [
      { path: 'finance/invoices/new', element: <InvoiceFormPage /> },
      { path: 'finance/invoices', element: <InvoicesPage /> },
      { path: 'finance/invoices/:id', element: <InvoiceDetailPage /> },
    ],
  },
  {
    element: guarded('payment.manage'),
    children: [
      { path: 'finance/payments/new', element: <PaymentFormPage /> },
      { path: 'finance/payments', element: <PaymentsPage /> },
    ],
  },
  {
    element: guarded('finance.read'),
    children: [
      { path: 'finance', element: <FinanceOverviewPage /> },
      { path: 'finance/debtors', element: <DebtorsPage /> },
      { path: 'finance/receipts/:paymentId', element: <ReceiptPage /> },
    ],
  },
];
