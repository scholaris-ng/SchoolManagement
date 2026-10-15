import { describe, expect, it } from 'vitest';
import type { InvoiceChange } from '@/types/finance';
import { describeChange, staleCopyNotice } from './invoice-history';

const change = (over: Partial<InvoiceChange> & Pick<InvoiceChange, 'kind'>): InvoiceChange => ({
  label: null,
  from: null,
  to: null,
  detail: null,
  ...over,
});

describe('describeChange', () => {
  it('says which charge was removed and what it was worth', () => {
    expect(
      describeChange(change({ kind: 'LINE_REMOVED', label: 'Uniform', from: 85_000 })),
    ).toBe('Removed Uniform (₦85,000)');
  });

  it('says which charge was added', () => {
    expect(describeChange(change({ kind: 'LINE_ADDED', label: 'Textbooks', to: 50_000 }))).toBe(
      'Added Textbooks (₦50,000)',
    );
  });

  it('shows a repriced charge from and to, with what about it moved', () => {
    expect(
      describeChange(
        change({
          kind: 'LINE_CHANGED',
          label: 'Uniform',
          from: 85_000,
          to: 75_000,
          detail: 'Price changed',
        }),
      ),
    ).toBe('Uniform: ₦85,000 → ₦75,000 (Price changed)');
  });

  it('shows the total moving', () => {
    expect(describeChange(change({ kind: 'TOTAL', from: 455_000, to: 370_000 }))).toBe(
      'Total: ₦455,000 → ₦370,000',
    );
  });

  it('distinguishes a note added, removed and edited', () => {
    expect(describeChange(change({ kind: 'NOTE', from: null, to: 'Pay by Friday' }))).toBe(
      'Note added',
    );
    expect(describeChange(change({ kind: 'NOTE', from: 'Pay by Friday', to: null }))).toBe(
      'Note removed',
    );
    expect(describeChange(change({ kind: 'NOTE', from: 'Pay by Friday', to: 'Pay by Monday' }))).toBe(
      'Note edited',
    );
  });

  it('shows the due date moving', () => {
    expect(
      describeChange(change({ kind: 'DUE_DATE', from: '2026-11-13', to: '2026-11-20' })),
    ).toBe('Due date: 13 Nov 2026 → 20 Nov 2026');
  });
});

describe('staleCopyNotice', () => {
  const edited = [
    { revisionNo: 2, createdAt: '2026-10-15T10:00:00.000Z' },
    { revisionNo: 1, createdAt: '2026-10-14T09:00:00.000Z' },
  ];

  it('warns when the invoice changed after the family was last sent a copy', () => {
    expect(staleCopyNotice(edited, 1, '2026-10-14T12:00:00.000Z')).toEqual({
      since: '2026-10-15T10:00:00.000Z',
    });
  });

  it('says nothing when a copy went out after the latest change', () => {
    expect(staleCopyNotice(edited, 2, '2026-10-15T11:00:00.000Z')).toBeNull();
  });

  it('says nothing when the family was never sent one', () => {
    expect(staleCopyNotice(edited, 0, null)).toBeNull();
  });

  it('says nothing for an invoice that was never edited', () => {
    expect(staleCopyNotice([], 1, '2026-10-14T12:00:00.000Z')).toBeNull();
  });

  it('does not count the original version as a change', () => {
    expect(
      staleCopyNotice([{ revisionNo: 1, createdAt: '2026-10-14T09:00:00.000Z' }], 1, '2026-10-13T00:00:00.000Z'),
    ).toBeNull();
  });
});
