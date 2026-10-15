/** The columns that make up a person's name in one table. `middle` is optional: staff have none. */
export interface PersonNameColumns {
  first: string;
  middle?: string;
  last: string;
}

/**
 * The `ORDER BY` columns for a list of people, ending in their name.
 *
 * Whatever a list is sorted by, ties fall to the name — a class, a status or a
 * date of birth used to leave everyone who tied in whatever order the id
 * happened to give, which reads as random.
 *
 * The name is ordered the way the screen *prints* it: first name, then middle,
 * then surname. That is how it is read, so sorted by surname a list of
 * "Chizzy Ohanyere, Tehillah Akintoye, …" looks shuffled even though it is not.
 * Sorting by the surname column itself is still supported, for a register that
 * wants it.
 *
 * Sorting *by* a name column runs all of that name's columns in the requested
 * direction, so a descending list is the exact reverse of an ascending one.
 * The caller appends its own id as the final tie-break.
 */
export function orderByPersonName(
  primary: string,
  direction: 'ASC' | 'DESC',
  names: PersonNameColumns,
): string {
  const asPrinted = [names.first, names.middle, names.last].filter((c): c is string => Boolean(c));
  const bySurname = [names.last, names.first, names.middle].filter((c): c is string => Boolean(c));

  const byName =
    primary === names.first ? asPrinted : primary === names.last ? bySurname : null;
  const columns = byName
    ? byName.map((column) => `${column} ${direction}`)
    : [`${primary} ${direction}`, ...asPrinted.map((column) => `${column} ASC`)];
  return columns.join(', ');
}

/** More words than this is a pasted sentence, not a name; the rest are ignored. */
const MAX_SEARCH_WORDS = 6;

/**
 * The `WHERE` condition for a free-text search box over people.
 *
 * The term is split into words and every word must match *some* column, in
 * any order — so "Christiana Idowu" finds Anuoluwapo Christiana Idowu even
 * though no single column holds that phrase, and a search by middle name or
 * surname works the same as one by first name. Matching the whole phrase
 * against each column on its own, as this used to, could only ever find
 * somebody whose one column contained all of it.
 *
 * Each word gets its own parameter, numbered from `firstParam`; the caller
 * pushes `params` onto its list in order. Returns `null` for a blank term, so
 * the caller can leave the condition out rather than match everyone twice.
 * `%`, `_` and `\` in what was typed are matched literally.
 */
export function searchWordsClause(
  term: string,
  columns: string[],
  firstParam: number,
): { sql: string; params: string[] } | null {
  const words = term.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_WORDS);
  if (words.length === 0 || columns.length === 0) return null;

  const perWord = words.map(
    (_, index) =>
      `(${columns.map((column) => `${column} ILIKE $${firstParam + index}`).join(' OR ')})`,
  );

  return {
    sql: `(${perWord.join(' AND ')})`,
    params: words.map((word) => `%${word.replace(/[\\%_]/g, '\\$&')}%`),
  };
}
