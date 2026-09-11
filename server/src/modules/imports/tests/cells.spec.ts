import {
  isIsoDate,
  normaliseSpacing,
  parseBooleanCell,
  splitList,
  splitPersonName,
} from '../utils/cells';

describe('parseBooleanCell', () => {
  it.each(['TRUE', 'true', 'True', 'YES', 'yes', 'Y', '1', ' true '])(
    'reads %p as yes',
    (input) => {
      expect(parseBooleanCell(input, false)).toEqual({ value: true });
    },
  );

  it.each(['FALSE', 'false', 'NO', 'no', 'N', '0'])('reads %p as no', (input) => {
    expect(parseBooleanCell(input, true)).toEqual({ value: false });
  });

  it('falls back silently when the cell is empty, because blank means unspecified', () => {
    expect(parseBooleanCell('', true)).toEqual({ value: true });
    expect(parseBooleanCell(undefined, false)).toEqual({ value: false });
    expect(parseBooleanCell('   ', true)).toEqual({ value: true });
  });

  it('warns when the cell holds something it cannot read, rather than guessing quietly', () => {
    const result = parseBooleanCell('maybe', false);
    expect(result.value).toBe(false);
    expect(result.warning).toContain('maybe');
  });
});

describe('isIsoDate', () => {
  it.each(['2014-05-12', '2000-01-01', '2024-02-29'])('accepts %p', (input) => {
    expect(isIsoDate(input)).toBe(true);
  });

  it.each(['12/05/2014', '2014-5-12', '', 'yesterday', '2014-13-01', '2025-02-30'])(
    'rejects %p',
    (input) => {
      expect(isIsoDate(input)).toBe(false);
    },
  );
});

describe('splitList', () => {
  it('splits a semicolon-separated cell and drops the gaps', () => {
    expect(splitList('TEACHER;FORM_TEACHER')).toEqual(['TEACHER', 'FORM_TEACHER']);
    expect(splitList(' JSS 1 ; ; JSS 2 ')).toEqual(['JSS 1', 'JSS 2']);
  });

  it('returns nothing for an empty cell', () => {
    expect(splitList('')).toEqual([]);
    expect(splitList(undefined)).toEqual([]);
  });
});

describe('normaliseSpacing', () => {
  it('collapses the stray spaces a spreadsheet collects', () => {
    expect(normaliseSpacing('  JSS  1   Gold ')).toBe('JSS 1 Gold');
  });
});

describe('splitPersonName', () => {
  it('splits an ordinary name at the space', () => {
    expect(splitPersonName('Ngozi Eze')).toEqual({ firstName: 'Ngozi', lastName: 'Eze' });
  });

  it('keeps the surname whole when a title or middle name is present', () => {
    expect(splitPersonName('Mrs. Ngozi Amaka Eze')).toEqual({
      firstName: 'Mrs. Ngozi Amaka',
      lastName: 'Eze',
    });
  });

  it('uses a single word for both halves, since a guardian needs each', () => {
    expect(splitPersonName('Ngozi')).toEqual({ firstName: 'Ngozi', lastName: 'Ngozi' });
  });
});
