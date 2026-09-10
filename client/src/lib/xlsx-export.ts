import type ExcelJS from 'exceljs';
import { loadExcelJs, XLSX_MIME_TYPE } from './xlsx-engine';

/** Writing workbooks: error reports and selection downloads. */

/**
 * Values a worksheet cell can hold. Numbers and dates stay typed so totals and
 * date filters work in Excel — the thing a CSV could never give us.
 */
type CellValue = string | number | boolean | Date | null;

function toCellValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (value instanceof Date) return value;
  const text = String(value);
  return text === '' ? null : text;
}

export interface SheetOptions {
  /** Worksheet name; Excel caps this at 31 characters and forbids []:*?/\ */
  sheetName?: string;
  /** Explicit column order. Defaults to the keys of the first row. */
  headers?: string[];
}

/** Excel rejects []:*?/\ in sheet names and truncates past 31 characters. */
function safeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, ' ').trim();
  return cleaned.slice(0, 31) || 'Sheet1';
}

/** Builds a single-sheet workbook with a frozen, filterable header row. */
export async function rowsToWorkbook(
  rows: Record<string, unknown>[],
  options: SheetOptions = {},
): Promise<ExcelJS.Workbook> {
  const Excel = await loadExcelJs();
  const workbook = new Excel.Workbook();
  workbook.creator = 'Scholaris';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(safeSheetName(options.sheetName ?? 'Sheet1'), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const columns = options.headers ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
  if (columns.length === 0) return workbook;

  sheet.columns = columns.map((header) => ({ header, key: header }));
  for (const row of rows) {
    sheet.addRow(columns.map((column) => toCellValue(row[column])));
  }

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  // Size each column to its widest cell so nothing opens as ####.
  sheet.columns.forEach((column, index) => {
    const widest = rows.reduce((longest, row) => {
      const cell = toCellValue(row[columns[index]]);
      const length = cell instanceof Date ? 10 : String(cell ?? '').length;
      return Math.max(longest, length);
    }, columns[index].length);
    column.width = Math.min(Math.max(widest + 2, 10), 60);
  });

  return workbook;
}

/** Triggers a browser download for an already-built blob. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Serialises a workbook to the bytes of an .xlsx file. */
export async function workbookToBlob(workbook: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME_TYPE });
}

export async function downloadWorkbook(
  fileName: string,
  workbook: ExcelJS.Workbook,
): Promise<void> {
  downloadBlob(withXlsxExtension(fileName), await workbookToBlob(workbook));
}

/** Exports rows as a downloadable .xlsx file. */
export async function exportRowsToXlsx(
  fileName: string,
  rows: Record<string, unknown>[],
  options: SheetOptions = {},
): Promise<void> {
  const workbook = await rowsToWorkbook(rows, options);
  await downloadWorkbook(fileName, workbook);
}

/** Accepts a bare or legacy name and returns one ending in .xlsx. */
export function withXlsxExtension(fileName: string): string {
  return fileName.replace(/\.(csv|xls|xlsx)$/i, '') + '.xlsx';
}
