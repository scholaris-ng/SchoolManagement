import { describe, expect, it } from 'vitest';
import { parseCsv, rowsToCsv, suggestColumnMapping } from './csv';

/**
 * Bulk import is a first-class workflow (spec section 9), and the files schools
 * actually send are messy: quoted fields, commas inside names, Windows line
 * endings, a BOM from Excel, and headers that never match ours exactly.
 */
describe('parseCsv', () => {
  it('reads a simple file', () => {
    const { headers, rows } = parseCsv('firstName,lastName\nChioma,Eze\nTobenna,Eze');
    expect(headers).toEqual(['firstName', 'lastName']);
    expect(rows).toEqual([
      { firstName: 'Chioma', lastName: 'Eze' },
      { firstName: 'Tobenna', lastName: 'Eze' },
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const { rows } = parseCsv('name,address\n"Eze, Chioma","12 Awolowo Road, Ikoyi"');
    expect(rows[0]).toEqual({ name: 'Eze, Chioma', address: '12 Awolowo Road, Ikoyi' });
  });

  it('handles escaped quotes inside a quoted field', () => {
    const { rows } = parseCsv('name\n"Ada ""Baby"" Okonkwo"');
    expect(rows[0].name).toBe('Ada "Baby" Okonkwo');
  });

  it('accepts Windows line endings', () => {
    const { rows } = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('strips the BOM Excel writes, so the first header is not corrupted', () => {
    const { headers } = parseCsv('﻿admissionNo,firstName\nBRF/001,Ada');
    expect(headers[0]).toBe('admissionNo');
  });

  it('skips blank lines rather than emitting empty records', () => {
    const { rows } = parseCsv('a,b\n1,2\n\n\n3,4\n');
    expect(rows).toHaveLength(2);
  });

  it('pads rows that are short of columns instead of throwing', () => {
    const { rows } = parseCsv('a,b,c\n1,2');
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '' });
  });

  it('returns nothing for an empty file', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });

  it('reads the final row when the file has no trailing newline', () => {
    const { rows } = parseCsv('a\n1');
    expect(rows).toHaveLength(1);
  });
});

describe('rowsToCsv', () => {
  it('writes a header row and quotes what needs quoting', () => {
    const csv = rowsToCsv([{ name: 'Eze, Chioma', note: 'said "hello"' }]);
    expect(csv).toBe('name,note\r\n"Eze, Chioma","said ""hello"""');
  });

  it('neutralises values a spreadsheet would execute as a formula', () => {
    // A name or note beginning =, +, - or @ is a formula-injection vector in
    // Excel; prefixing with an apostrophe keeps the export inert.
    const csv = rowsToCsv([{ note: '=SUM(A1:A9)' }]);
    expect(csv).toBe("note\r\n'=SUM(A1:A9)");
  });

  it('renders empty and missing values as blanks', () => {
    const csv = rowsToCsv([{ a: null, b: undefined, c: '' }]);
    expect(csv).toBe('a,b,c\r\n,,');
  });

  it('honours an explicit column order', () => {
    const csv = rowsToCsv([{ b: '2', a: '1' }], ['a', 'b']);
    expect(csv).toBe('a,b\r\n1,2');
  });

  it('emits just the headers when there are no rows', () => {
    expect(rowsToCsv([], ['a', 'b'])).toBe('a,b');
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
