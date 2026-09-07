/**
 * CSV helpers.
 *
 * Bulk import is a first-class workflow here, so parsing happens in the browser
 * for the preview/mapping step, and export is used for error reports and
 * selection downloads.
 */

/** Escapes a value for CSV, guarding against formula injection in Excel. */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // A leading =, +, - or @ is executed as a formula by spreadsheet software.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function rowsToCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0) return headers ? headers.join(',') : '';
  const columns = headers ?? Object.keys(rows[0]);
  const lines = [columns.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(row[column])).join(','));
  }
  return lines.join('\r\n');
}

export function downloadTextFile(fileName: string, content: string, mimeType = 'text/csv'): void {
  // A BOM makes Excel open UTF-8 correctly, which matters for names with
  // diacritics — a routine occurrence in Nigerian school registers.
  const blob = new Blob([`\uFEFF${content}`], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRowsToCsv(fileName: string, rows: Record<string, unknown>[]): void {
  downloadTextFile(fileName, rowsToCsv(rows));
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * A small RFC-4180-tolerant parser: quoted fields, embedded commas, escaped
 * quotes and either line ending. Sufficient for the spreadsheets schools
 * actually export, and it avoids shipping a parser dependency.
 */
export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];

    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      // Skip blank lines rather than emitting an empty record.
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map((header) => header.trim());
  const dataRows = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });

  return { headers, rows: dataRows };
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
