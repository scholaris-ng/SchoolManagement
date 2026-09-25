/**
 * How the command palette decides what matches and in what order.
 *
 * Kept apart from the component so the rules can be read, and tested, without
 * rendering a dialog.
 */

export interface SearchableEntry {
  label: string;
  /** Shown beside the label. Also searched. */
  hint?: string;
  /** Searched, never shown — unless it is the only reason the entry matched. */
  keywords?: string[];
}

export interface Match<T extends SearchableEntry> {
  entry: T;
  /** The keyword that carried the match, when the label alone would not have. */
  via?: string;
}

const words = (text: string) => text.toLowerCase().split(/[\s\-/·]+/).filter(Boolean);

/**
 * How well one search term matches one entry, 0 for not at all. Where in the
 * label it lands matters most — "att" belongs next to "Attendance" before it
 * belongs next to "Inattentive" — then the keywords, then the hint.
 */
function termScore(term: string, entry: SearchableEntry): { score: number; via?: string } {
  const label = entry.label.toLowerCase();
  if (label.startsWith(term)) return { score: 80 };
  if (words(label).some((word) => word.startsWith(term))) return { score: 60 };
  if (label.includes(term)) return { score: 40 };

  const keywords = entry.keywords ?? [];
  const prefixed = keywords.find((keyword) => keyword.toLowerCase().startsWith(term));
  if (prefixed) return { score: 30, via: prefixed };
  const contained = keywords.find((keyword) => keyword.toLowerCase().includes(term));
  if (contained) return { score: 20, via: contained };

  if (entry.hint?.toLowerCase().includes(term)) return { score: 10 };
  return { score: 0 };
}

/**
 * The entries that match every word of `query`, best first. Words may land in
 * different places — "add stu" finds "Add a student" — and an empty query keeps
 * the order it was given.
 */
export function searchEntries<T extends SearchableEntry>(entries: T[], query: string): Match<T>[] {
  const terms = words(query);
  if (terms.length === 0) return entries.map((entry) => ({ entry }));

  const scored: { entry: T; score: number; via?: string; order: number }[] = [];
  entries.forEach((entry, order) => {
    const results = terms.map((term) => termScore(term, entry));
    if (results.some((result) => result.score === 0)) return;
    scored.push({
      entry,
      // Only as good as its weakest word.
      score: Math.min(...results.map((result) => result.score)),
      via: results.find((result) => result.via)?.via,
      order,
    });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ entry, via, score }) => ({ entry, via: score < 40 ? via : undefined }));
}

/** Splits `text` into alternating plain and matching runs, so the matches can be emphasised. */
export function splitOnMatches(text: string, query: string): { text: string; match: boolean }[] {
  const terms = words(query).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (terms.length === 0) return [{ text, match: false }];

  // Splitting on a capturing group puts every match at an odd index.
  return text
    .split(new RegExp(`(${terms.join('|')})`, 'gi'))
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((part) => part.text !== '');
}
