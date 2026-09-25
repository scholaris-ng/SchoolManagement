import { describe, expect, it } from 'vitest';
import { searchEntries, splitOnMatches } from './command-palette-search';

const entry = (label: string, extra: { hint?: string; keywords?: string[] } = {}) => ({
  label,
  ...extra,
});

const labels = (matches: { entry: { label: string } }[]) => matches.map((match) => match.entry.label);

describe('searchEntries', () => {
  const entries = [
    entry('Inattentive pupils'),
    entry('Take attendance', { keywords: ['register', 'mark'] }),
    entry('Attendance'),
    entry('Add a student', { keywords: ['enrol', 'register'] }),
    entry('Import records', { keywords: ['excel', 'xlsx'] }),
    entry('Dashboard', { hint: 'Overview' }),
  ];

  it('keeps the order it was given when there is nothing to search for', () => {
    expect(labels(searchEntries(entries, ''))).toEqual(entries.map((e) => e.label));
    expect(labels(searchEntries(entries, '   '))).toEqual(entries.map((e) => e.label));
  });

  it('puts a label that starts with the query before a word that does, before one that merely contains it', () => {
    // "Attendance" starts with it, "Take attendance" has a word that does,
    // "Inattentive pupils" only contains it.
    expect(labels(searchEntries(entries, 'att'))).toEqual([
      'Attendance',
      'Take attendance',
      'Inattentive pupils',
    ]);
  });

  it('finds an entry whose words are typed in more than one place', () => {
    expect(labels(searchEntries(entries, 'add stu'))).toEqual(['Add a student']);
  });

  it('needs every word to match', () => {
    expect(searchEntries(entries, 'add zebra')).toEqual([]);
  });

  it('matches on keywords and says which one did the work', () => {
    const [match] = searchEntries(entries, 'excel');
    expect(match.entry.label).toBe('Import records');
    expect(match.via).toBe('excel');
  });

  it('does not credit a keyword when the label already matched', () => {
    const [match] = searchEntries(entries, 'register');
    // "register" is only a keyword here...
    expect(match.via).toBe('register');

    const [byLabel] = searchEntries(entries, 'import');
    expect(byLabel.entry.label).toBe('Import records');
    expect(byLabel.via).toBeUndefined();
  });

  it('ranks a label above a keyword for the same word', () => {
    const list = [entry('Mark a register', {}), entry('Take attendance', { keywords: ['register'] })];
    expect(labels(searchEntries(list, 'register'))).toEqual(['Mark a register', 'Take attendance']);
  });

  it('matches on the hint, last', () => {
    expect(labels(searchEntries(entries, 'overview'))).toEqual(['Dashboard']);
  });

  it('is not case sensitive', () => {
    expect(labels(searchEntries(entries, 'DASH'))).toEqual(['Dashboard']);
  });

  it('keeps equal matches in their original order', () => {
    const list = [entry('Fees a'), entry('Fees b'), entry('Fees c')];
    expect(labels(searchEntries(list, 'fees'))).toEqual(['Fees a', 'Fees b', 'Fees c']);
  });
});

describe('splitOnMatches', () => {
  it('returns the text whole when there is no query', () => {
    expect(splitOnMatches('Take attendance', '')).toEqual([{ text: 'Take attendance', match: false }]);
  });

  it('marks each matching run, whatever its case', () => {
    expect(splitOnMatches('Take Attendance', 'att')).toEqual([
      { text: 'Take ', match: false },
      { text: 'Att', match: true },
      { text: 'endance', match: false },
    ]);
  });

  it('marks every word of the query', () => {
    expect(splitOnMatches('Add a student', 'add stu')).toEqual([
      { text: 'Add', match: true },
      { text: ' a ', match: false },
      { text: 'stu', match: true },
      { text: 'dent', match: false },
    ]);
  });

  it('treats punctuation in the query as text, not as a pattern', () => {
    expect(() => splitOnMatches('Mr. (Ada) Obi', '(ada')).not.toThrow();
    expect(splitOnMatches('Mr. (Ada) Obi', '(ada')).toEqual([
      { text: 'Mr. ', match: false },
      { text: '(Ada', match: true },
      { text: ') Obi', match: false },
    ]);
  });
});
