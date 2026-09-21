import { describe, expect, it } from 'vitest';
import type { AuditReference } from '@/types/engagement';
import { buildRows, partsOf, plainText, routeForRecord, summarise } from './audit-values';

const STUDENT = '0797ab32-364a-43fd-a3c5-13b62aaaaaaa';
const CLASS = 'dab3303b-15db-4463-afbf-3bf9671bbbbb';
const OTHER_CLASS = 'eab3303b-15db-4463-afbf-3bf9671ccccc';

const references: Record<string, AuditReference> = {
  [STUDENT]: { type: 'Student', label: 'Lotanna Ohanyere (A1S/2026/0046)', removed: false },
  [CLASS]: { type: 'SchoolClass', label: 'JSS 1 A', removed: false },
  [OTHER_CLASS]: { type: 'SchoolClass', label: 'JSS 2 B', removed: true },
};

const text = (row: { after: unknown } | undefined) => plainText((row?.after as never) ?? null);

describe('buildRows — the admission.converted entry from the audit trail', () => {
  const rows = buildRows(
    null,
    { classId: CLASS, studentId: STUDENT, admissionNo: 'A1S/2026/0046', guardiansAttached: 1 },
    { references },
  );

  it('names the class and the student instead of showing their ids', () => {
    expect(rows.map((row) => row.label)).toEqual([
      'Class',
      'Student',
      'Admission number',
      'Guardians attached',
    ]);
    expect(text(rows[0])).toBe('JSS 1 A');
    expect(text(rows[1])).toBe('Lotanna Ohanyere (A1S/2026/0046)');
  });

  it('carries the record itself, so it can be linked to', () => {
    expect(rows[1].after).toEqual([
      {
        kind: 'record',
        id: STUDENT,
        type: 'Student',
        label: 'Lotanna Ohanyere (A1S/2026/0046)',
        removed: false,
      },
    ]);
  });

  it('shows plain values as they are', () => {
    expect(text(rows[2])).toBe('A1S/2026/0046');
    expect(text(rows[3])).toBe('1');
  });

  it('has nothing to compare against, so nothing is marked as changed', () => {
    expect(rows.every((row) => row.before === null && !row.changed)).toBe(true);
  });

  it('shows no id anywhere in what it says', () => {
    const everything = summarise(rows);
    expect(everything).not.toContain(STUDENT);
    expect(everything).not.toContain(CLASS);
  });
});

describe('buildRows — a change', () => {
  it('marks what differs and keeps what did not as context', () => {
    const rows = buildRows(
      { classId: CLASS, status: 'ACTIVE' },
      { classId: OTHER_CLASS, status: 'ACTIVE' },
      { references },
    );

    const cls = rows.find((row) => row.label === 'Class');
    const status = rows.find((row) => row.label === 'Status');
    expect(cls?.changed).toBe(true);
    expect(plainText(cls?.before ?? null)).toBe('JSS 1 A');
    expect(plainText(cls?.after ?? null)).toBe('JSS 2 B (deleted)');
    expect(status?.changed).toBe(false);
  });

  it('compares references by id, not by how they read', () => {
    const rows = buildRows({ classId: CLASS }, { classId: CLASS }, { references });
    expect(rows[0].changed).toBe(false);
  });

  it('shows a value that was cleared as empty rather than dropping the row', () => {
    const [row] = buildRows({ note: 'Late fee waived' }, { note: null });

    expect(row.changed).toBe(true);
    expect(plainText(row.before)).toBe('Late fee waived');
    expect(plainText(row.after)).toBe('—');
  });

  it('shows a value that only appears afterwards as new', () => {
    const [row] = buildRows({ status: 'ACTIVE' }, { status: 'ACTIVE', reason: 'Family moved' });
    const reason = buildRows({ status: 'ACTIVE' }, { status: 'ACTIVE', reason: 'Family moved' }).find(
      (r) => r.label === 'Reason',
    );

    expect(row.changed).toBe(false);
    expect(reason?.changed).toBe(true);
    expect(plainText(reason?.before ?? null)).toBe('—');
  });
});

describe('buildRows — what it leaves out', () => {
  it('drops a field that is empty on every side', () => {
    const rows = buildRows(null, { name: 'JSS 1', note: null, code: '' });
    expect(rows.map((row) => row.label)).toEqual(['Name']);
  });

  it('returns nothing when there is nothing recorded', () => {
    expect(buildRows(null, null)).toEqual([]);
    expect(buildRows(undefined, {})).toEqual([]);
  });
});

describe('values, spoken plainly', () => {
  it('says yes and no', () => {
    expect(plainText(partsOf('portalAccess', true))).toBe('Yes');
    expect(plainText(partsOf('portalAccess', false))).toBe('No');
  });

  it('writes dates the way the rest of the app does', () => {
    expect(plainText(partsOf('startDate', '2026-09-01'))).toBe('1 Sep 2026');
    expect(plainText(partsOf('accessEndsAt', '2026-10-21T13:23:00.000Z'))).toMatch(/Oct 2026/);
  });

  it('turns a fixed word into a word, but only on keys that hold fixed words', () => {
    expect(plainText(partsOf('status', 'BANK_TRANSFER'))).toBe('Bank transfer');
    expect(plainText(partsOf('method', 'CASH'))).toBe('Cash');
    // A class code is capitals too, and is somebody\'s own text.
    expect(plainText(partsOf('code', 'JSS1'))).toBe('JSS1');
  });

  it('lists several records and says "None" for an empty list', () => {
    expect(plainText(partsOf('formTeacherIds', [CLASS, OTHER_CLASS], references))).toBe(
      'JSS 1 A, JSS 2 B (deleted)',
    );
    expect(plainText(partsOf('formTeacherIds', []))).toBe('None');
  });

  it('counts a list of objects instead of repeating a phrase', () => {
    expect(plainText(partsOf('lines', [{ a: 1 }, { a: 2 }, { a: 3 }]))).toBe('3 items');
    expect(plainText(partsOf('lines', [{ a: 1 }]))).toBe('1 item');
  });

  it('says so when an id cannot be named, and never prints the id', () => {
    const parts = partsOf('classId', CLASS, {});

    expect(parts).toEqual([{ kind: 'unknown' }]);
    expect(plainText(parts)).toBe('No longer available');
    expect(plainText(parts)).not.toContain(CLASS);
  });

  it('flattens nested settings and says where each one sits', () => {
    const rows = buildRows(
      null,
      { branding: { primaryColor: '#123456' }, settings: { timezone: 'Africa/Lagos' } },
    );

    expect(rows.map((row) => row.label)).toEqual([
      'Branding › Primary color',
      'Settings › Timezone',
    ]);
  });
});

describe('money', () => {
  it('is written as naira on a record that carries money', () => {
    const [row] = buildRows(null, { amount: 50000 }, { money: true });
    expect(plainText(row.after)).toContain('50,000');
    expect(plainText(row.after)).toContain('₦');
  });

  it('is left as a plain number elsewhere, where a total is a mark', () => {
    const [row] = buildRows({ total: 62 }, { total: 71 });
    expect(plainText(row.before)).toBe('62');
    expect(plainText(row.after)).toBe('71');
  });

  it('does not add commas to a number that is not money', () => {
    expect(plainText(partsOf('sequence', 2026))).toBe('2026');
  });
});

describe('summarise', () => {
  it('is one line, with the arrow on what changed', () => {
    const rows = buildRows({ classId: CLASS, status: 'ACTIVE' }, { classId: OTHER_CLASS, status: 'ACTIVE' }, {
      references,
    });

    expect(summarise(rows)).toBe('Class: JSS 1 A → JSS 2 B (deleted); Status: Active');
  });
});

describe('routeForRecord', () => {
  it('points at the page for a record the app has one for', () => {
    expect(routeForRecord('Student', 'abc')).toBe('/students/abc');
    expect(routeForRecord('Invoice', 'abc')).toBe('/finance/invoices/abc');
    expect(routeForRecord('Payment', 'abc')).toBe('/finance/receipts/abc');
    expect(routeForRecord('AdmissionApplication', 'abc')).toBe('/admissions/abc');
  });

  it('is null for a record with no page, rather than a link that goes nowhere', () => {
    expect(routeForRecord('SchoolClass', 'abc')).toBeNull();
    expect(routeForRecord('Term', 'abc')).toBeNull();
  });
});
