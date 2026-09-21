import { describe, expect, it } from 'vitest';
import { RECORD_TYPE_OPTIONS } from './audit-filters';

const values = RECORD_TYPE_OPTIONS.map((option) => option.value);
const labels = RECORD_TYPE_OPTIONS.map((option) => option.label);

describe('RECORD_TYPE_OPTIONS', () => {
  it('filters admissions by the name the server actually stores', () => {
    // The dropdown once sent `Admission`, which no entry has, so choosing it
    // always showed an empty trail.
    expect(RECORD_TYPE_OPTIONS).toContainEqual({
      value: 'AdmissionApplication',
      label: 'Admission application',
    });
  });

  it('does not offer names the server never writes, which could only ever match nothing', () => {
    expect(values).not.toContain('Admission');
    // Nothing in the discipline module is audited, so there is no such entry to find.
    expect(values).not.toContain('DisciplineIncident');
  });

  it('offers the kinds of record the earlier, shorter list left out', () => {
    expect(values).toEqual(
      expect.arrayContaining([
        'Guardian',
        'FeeStructure',
        'PaymentReceipt',
        'SchoolClass',
        'Staff',
        'Term',
        'TimetableEntry',
      ]),
    );
  });

  it('sends the stored name, which is PascalCase, never a label', () => {
    for (const value of values) expect(value).toMatch(/^[A-Z][A-Za-z]+$/);
  });

  it('never lists a record type twice', () => {
    expect(new Set(values).size).toBe(values.length);
  });

  it('never gives two record types the same label, which would be unchoosable', () => {
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('is in alphabetical order of what the person reads', () => {
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});
