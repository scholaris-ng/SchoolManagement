import { useMutation } from '@tanstack/react-query';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { toast } from '@/lib/toast-bus';
import { exportRowsToXlsx } from '@/lib/xlsx';
import type { ListQuery, Paginated } from '@/types/api';
import type { Invoice, Payment } from '@/types/finance';
import { FinanceEndpoints } from './finance.endpoints';
import { exportFileName, invoiceExportRows, paymentExportRows } from './finance-export';

/**
 * Downloads everything a list's current filters match — the whole period, not
 * only the page on screen — as one workbook.
 *
 * These are mutations rather than plain async functions so a failed request
 * lands in the app's shared error toast, and so `isPending` is there for the
 * button to show while a long export is still fetching.
 */

interface ExportOutcome {
  count: number;
  total: number;
  truncated: boolean;
}

interface ExportConfig<T> {
  singular: string;
  plural: string;
  fileBase: string;
  sheetName: string;
  fetchPage: (query: ListQuery) => Promise<Paginated<T>>;
  toRows: (items: T[]) => Record<string, unknown>[];
}

function useExport<T>(config: ExportConfig<T>) {
  const { singular, plural, fileBase, sheetName, fetchPage, toRows } = config;

  return useMutation({
    mutationFn: async (query: ListQuery): Promise<ExportOutcome> => {
      const { items, total, truncated } = await fetchAllPages(fetchPage, query);
      // A workbook with no rows has no header row either, so there is nothing
      // worth handing over — the toast below says so instead.
      if (items.length > 0) {
        await exportRowsToXlsx(exportFileName(fileBase, query), toRows(items), { sheetName });
      }
      return { count: items.length, total, truncated };
    },
    onSuccess: ({ count, total, truncated }) => {
      if (count === 0) {
        toast.info('Nothing to export', {
          description: `No ${plural} match the current filters.`,
        });
      } else if (truncated) {
        toast.warning(`Exported the first ${count} of ${total} ${plural}`, {
          description: 'Narrow the date range to export the rest.',
        });
      } else {
        toast.success(`${count} ${count === 1 ? singular : plural} exported`);
      }
    },
  });
}

export function useExportPayments() {
  return useExport<Payment>({
    singular: 'payment',
    plural: 'payments',
    fileBase: 'payments',
    sheetName: 'Payments',
    fetchPage: FinanceEndpoints.fetchPayments,
    toRows: paymentExportRows,
  });
}

export function useExportInvoices() {
  return useExport<Invoice>({
    singular: 'invoice',
    plural: 'invoices',
    fileBase: 'invoices',
    sheetName: 'Invoices',
    fetchPage: FinanceEndpoints.fetchInvoices,
    toRows: invoiceExportRows,
  });
}
