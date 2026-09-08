/**
 * Excel (.xlsx) helpers.
 *
 * Bulk import is a first-class workflow here, so workbooks are read in the
 * browser for the preview/mapping step, and written for error reports and
 * selection downloads. Schools work in Excel, so we meet them there rather
 * than asking for a "Save as CSV" detour.
 */

import type ExcelJS from 'exceljs';

export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * The workbook engine is close to a megabyte, and most sessions never export
 * anything, so it is pulled in on first use rather than at page load.
 */
async function loadExcelJs(): Promise<typeof ExcelJS> {
  const module = await import('exceljs');
  // The browser build is UMD, so the namespace arrives under `default`.
  return ((module as unknown as { default?: typeof ExcelJS }).default ??
    module) as typeof ExcelJS;
}

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

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
  /** Name of the worksheet the rows came from, for the upload summary. */
  sheetName: string;
}

/** ISO date, which is what the import validators expect from a date column. */
function formatDate(value: Date): string {
  const iso = value.toISOString();
  return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
}

/**
 * Flattens whatever ExcelJS hands back for a cell — rich text, hyperlinks,
 * formula results, errors — into the plain string the mapping step works with.
 */
export function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'object') {
    const candidate = value as unknown as Record<string, unknown>;
    if ('richText' in candidate && Array.isArray(candidate.richText)) {
      return candidate.richText.map((part) => String((part as { text?: string }).text ?? '')).join('');
    }
    if ('text' in candidate) return String(candidate.text ?? '').trim();
    // A formula cell carries its last calculated value; the formula itself is
    // useless to an import, so we take the result.
    if ('result' in candidate) return cellToText(candidate.result as ExcelJS.CellValue);
    if ('error' in candidate) return '';
    if ('hyperlink' in candidate) return String(candidate.hyperlink ?? '').trim();
    return '';
  }
  return String(value).trim();
}

/**
 * Reads the first non-empty worksheet: row one is the header, everything below
 * it is data. Blank rows are skipped and short rows padded, because the files
 * schools actually send have both.
 */
export async function parseXlsx(
  source: Blob | ArrayBuffer | Uint8Array,
): Promise<ParsedSheet> {
  const Excel = await loadExcelJs();
  const workbook = new Excel.Workbook();
  const blob = source as Blob;
  const buffer = typeof blob.arrayBuffer === 'function' ? await blob.arrayBuffer() : source;
  await workbook.xlsx.load(buffer as ArrayBuffer);

  const sheet =
    workbook.worksheets.find((candidate) => candidate.actualRowCount > 0) ??
    workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [], sheetName: '' };

  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // `values` is 1-based, with index 0 unused.
    const values = (row.values as ExcelJS.CellValue[]) ?? [];
    for (let index = 1; index < values.length; index += 1) {
      cells.push(cellToText(values[index]));
    }
    if (cells.some((cell) => cell !== '')) table.push(cells);
  });

  if (table.length === 0) return { headers: [], rows: [], sheetName: sheet.name };

  const headers = table[0].map((header, index) => header.trim() || `Column ${index + 1}`);
  const rows = table.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });

  return { headers, rows, sheetName: sheet.name };
}

/**
 * Suggests a source column for each target field by fuzzy-matching headers,
 * which removes most of the tedium from the mapping step.
 */
export function suggestColumnMapping(
  headers: string[],
  targets: { key: string; label: string; aliases?: string[] }[],
): Record<string, string | null> {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalisedHeaders = headers.map((header) => ({ header, key: normalise(header) }));
  const mapping: Record<string, string | null> = {};

  for (const target of targets) {
    const candidates = [target.key, target.label, ...(target.aliases ?? [])].map(normalise);
    const exact = normalisedHeaders.find((entry) => candidates.includes(entry.key));
    if (exact) {
      mapping[target.key] = exact.header;
      continue;
    }
    const partial = normalisedHeaders.find((entry) =>
      candidates.some(
        (candidate) =>
          candidate.length > 3 &&
          (entry.key.includes(candidate) || candidate.includes(entry.key)),
      ),
    );
    mapping[target.key] = partial?.header ?? null;
  }

  return mapping;
}
