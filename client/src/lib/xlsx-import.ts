import type ExcelJS from 'exceljs';
import { loadExcelJs } from './xlsx-engine';

/** Reading workbooks: the preview and column-mapping step of a bulk import. */

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
