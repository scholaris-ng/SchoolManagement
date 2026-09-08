import { describe, expect, it } from 'vitest';
import {
  cellToText,
  parseXlsx,
  rowsToWorkbook,
  suggestColumnMapping,
  withXlsxExtension,
  workbookToBlob,
} from './xlsx';

/**
 * Bulk import is a first-class workflow (spec section 9), and the workbooks
 * schools actually send are messy: blank rows, short rows, merged-looking
 * headers, formulas, and dates that Excel stores as real dates. These tests
 * round-trip real .xlsx bytes rather than mocking the engine.
 */
async function roundTrip(
  rows: Record<string, unknown>[],
  headers?: string[],
): Promise<ReturnType<typeof parseXlsx>> {
  const workbook = await rowsToWorkbook(rows, { headers, sheetName: 'Register' });
  // Real .xlsx bytes, not the in-memory workbook: jsdom's Blob cannot be read
  // back, so the round trip goes through the writer's buffer directly.
  return parseXlsx(new Uint8Array(await workbook.xlsx.writeBuffer()));
}

describe('parseXlsx', () => {
  it('reads a simple sheet', async () => {
    const { headers, rows, sheetName } = await roundTrip([
      { firstName: 'Chioma', lastName: 'Eze' },
      { firstName: 'Tobenna', lastName: 'Eze' },
    ]);
    expect(sheetName).toBe('Register');
    expect(headers).toEqual(['firstName', 'lastName']);
    expect(rows).toEqual([
      { firstName: 'Chioma', lastName: 'Eze' },
      { firstName: 'Tobenna', lastName: 'Eze' },
    ]);
  });

  it('keeps commas and quotes intact — no escaping to get wrong', async () => {
    const { rows } = await roundTrip([
      { name: 'Eze, Chioma', address: '12 Awolowo Road, Ikoyi', note: 'said "hello"' },
    ]);
    expect(rows[0]).toEqual({
      name: 'Eze, Chioma',
      address: '12 Awolowo Road, Ikoyi',
      note: 'said "hello"',
    });
  });

  it('reads numbers back without mangling them', async () => {
    const { rows } = await roundTrip([{ admissionNo: 'BRF/001', amount: 85000 }]);
    expect(rows[0]).toEqual({ admissionNo: 'BRF/001', amount: '85000' });
  });

  it('renders a date cell as an ISO date', async () => {
    const { rows } = await roundTrip([{ dateOfBirth: new Date('2014-05-12T00:00:00.000Z') }]);
    expect(rows[0].dateOfBirth).toBe('2014-05-12');
  });

  it('pads rows that are short of columns instead of throwing', async () => {
    const { rows } = await roundTrip([{ a: '1', b: '2', c: null }], ['a', 'b', 'c']);
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '' });
  });

  it('skips blank rows rather than emitting empty records', async () => {
    const { rows } = await roundTrip([
      { a: '1', b: '2' },
      { a: null, b: null },
      { a: '3', b: '4' },
    ]);
    expect(rows).toHaveLength(2);
  });

  it('returns nothing for a workbook with no rows', async () => {
    const { headers, rows } = await roundTrip([]);
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
  });

  it('names unlabelled header cells so the mapping UI still has something to show', async () => {
    const { headers } = await roundTrip([{ 'Admission number': 'BRF/001', ' ': 'x' }]);
    expect(headers[0]).toBe('Admission number');
    expect(headers[1]).toBe('Column 2');
  });
});

describe('rowsToWorkbook', () => {
  it('writes a bold, frozen, filterable header row', async () => {
    const workbook = await rowsToWorkbook([{ a: '1', b: '2' }]);
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sheet.autoFilter).toMatchObject({ to: { row: 1, column: 2 } });
  });

  it('stores numbers as numbers so Excel can total a column', async () => {
    const workbook = await rowsToWorkbook([{ Amount: 85000 }]);
    expect(workbook.worksheets[0].getCell('A2').value).toBe(85000);
  });

  it('stores a value beginning with = as text, not a formula', async () => {
    // The CSV export had to neutralise this with a leading apostrophe; in a
    // workbook a string cell is never re-parsed, so the value stays inert.
    const workbook = await rowsToWorkbook([{ note: '=SUM(A1:A9)' }]);
    expect(workbook.worksheets[0].getCell('A2').value).toBe('=SUM(A1:A9)');
    expect(workbook.worksheets[0].getCell('A2').formula).toBeUndefined();
  });

  it('honours an explicit column order', async () => {
    const workbook = await rowsToWorkbook([{ b: '2', a: '1' }], { headers: ['a', 'b'] });
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).values).toEqual([undefined, 'a', 'b']);
    expect(sheet.getRow(2).values).toEqual([undefined, '1', '2']);
  });

  it('emits just the headers when there are no rows', async () => {
    const workbook = await rowsToWorkbook([], { headers: ['a', 'b'] });
    expect(workbook.worksheets[0].actualRowCount).toBe(1);
  });

  it('serialises to a blob the browser will download as a workbook', async () => {
    const blob = await workbookToBlob(await rowsToWorkbook([{ a: '1' }]));
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(blob.size).toBeGreaterThan(0);
  });

  it('trims a sheet name Excel would reject', async () => {
    const workbook = await rowsToWorkbook([{ a: '1' }], {
      sheetName: 'Fees [2026]: term one, second half of the year',
    });
    expect(workbook.worksheets[0].name).toBe('Fees  2026   term one, second h');
  });
});

describe('cellToText', () => {
  it('flattens rich text into its plain reading', () => {
    expect(cellToText({ richText: [{ text: 'Ada ' }, { text: 'Okonkwo' }] })).toBe('Ada Okonkwo');
  });

  it('takes the calculated value of a formula cell', () => {
    expect(cellToText({ formula: 'SUM(A1:A2)', result: 42 })).toBe('42');
  });

  it('treats a formula error as blank rather than importing #REF!', () => {
    expect(cellToText({ error: '#REF!' })).toBe('');
  });

  it('reads a hyperlink cell as its display text', () => {
    expect(cellToText({ text: 'ngozi@example.com', hyperlink: 'mailto:ngozi@example.com' })).toBe(
      'ngozi@example.com',
    );
  });

  it('renders empty cells as blanks', () => {
    expect(cellToText(null)).toBe('');
    expect(cellToText(undefined)).toBe('');
  });
});

describe('withXlsxExtension', () => {
  it('adds the extension when there is none', () => {
    expect(withXlsxExtension('students-2026-09-08')).toBe('students-2026-09-08.xlsx');
  });

  it('replaces a legacy spreadsheet extension', () => {
    expect(withXlsxExtension('students.csv')).toBe('students.xlsx');
  });

  it('leaves an already-correct name alone', () => {
    expect(withXlsxExtension('students.xlsx')).toBe('students.xlsx');
  });

  it('keeps dots that are part of the name', () => {
    expect(withXlsxExtension('jss1.gold.register')).toBe('jss1.gold.register.xlsx');
  });
});

describe('suggestColumnMapping', () => {
  const targets = [
    { key: 'admissionNo', label: 'Admission number', aliases: ['adm no'] },
    { key: 'firstName', label: 'First name' },
    { key: 'dateOfBirth', label: 'Date of birth', aliases: ['dob'] },
  ];

  it('matches headers regardless of spacing and case', () => {
    const mapping = suggestColumnMapping(['Admission Number', 'FIRST NAME'], targets);
    expect(mapping.admissionNo).toBe('Admission Number');
    expect(mapping.firstName).toBe('FIRST NAME');
  });

  it('matches on an alias', () => {
    const mapping = suggestColumnMapping(['DOB'], targets);
    expect(mapping.dateOfBirth).toBe('DOB');
  });

  it('leaves a target unmapped when nothing resembles it', () => {
    const mapping = suggestColumnMapping(['house', 'nickname'], targets);
    expect(mapping.admissionNo).toBeNull();
    expect(mapping.firstName).toBeNull();
  });

  it('returns an entry for every target so the mapping UI is complete', () => {
    const mapping = suggestColumnMapping(['Admission Number'], targets);
    expect(Object.keys(mapping).sort()).toEqual(['admissionNo', 'dateOfBirth', 'firstName']);
  });
});
