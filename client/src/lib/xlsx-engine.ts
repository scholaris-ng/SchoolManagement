import type ExcelJS from 'exceljs';

/**
 * Shared plumbing for the Excel helpers.
 *
 * Bulk import is a first-class workflow here, so workbooks are read in the
 * browser for the preview/mapping step, and written for error reports and
 * selection downloads. Schools work in Excel, so we meet them there rather
 * than asking for a "Save as CSV" detour.
 */

export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * The workbook engine is close to a megabyte, and most sessions never export
 * anything, so it is pulled in on first use rather than at page load.
 */
export async function loadExcelJs(): Promise<typeof ExcelJS> {
  const module = await import('exceljs');
  // The browser build is UMD, so the namespace arrives under `default`.
  return ((module as unknown as { default?: typeof ExcelJS }).default ??
    module) as typeof ExcelJS;
}
