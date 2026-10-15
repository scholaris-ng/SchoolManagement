import { orderByPersonName, searchWordsClause } from '../pagination/personName';

const student = { first: 's.first_name', middle: 's.middle_name', last: 's.last_name' };
const staff = { first: 's.first_name', last: 's.last_name' };

describe('orderByPersonName', () => {
  it('sorts a name the way it is printed: first name, middle name, then surname', () => {
    expect(orderByPersonName('s.first_name', 'ASC', student)).toBe(
      's.first_name ASC, s.middle_name ASC, s.last_name ASC',
    );
  });

  it('still sorts by surname first when asked to', () => {
    expect(orderByPersonName('s.last_name', 'ASC', student)).toBe(
      's.last_name ASC, s.first_name ASC, s.middle_name ASC',
    );
  });

  it('reverses every name column together when sorting a name descending', () => {
    expect(orderByPersonName('s.first_name', 'DESC', student)).toBe(
      's.first_name DESC, s.middle_name DESC, s.last_name DESC',
    );
  });

  it('breaks ties in any other sort alphabetically, whichever direction it runs', () => {
    expect(orderByPersonName('c.name', 'DESC', student)).toBe(
      'c.name DESC, s.first_name ASC, s.middle_name ASC, s.last_name ASC',
    );
  });

  it('leaves out a middle name for people who have none', () => {
    expect(orderByPersonName('s.first_name', 'ASC', staff)).toBe('s.first_name ASC, s.last_name ASC');
    expect(orderByPersonName('s.designation', 'ASC', staff)).toBe(
      's.designation ASC, s.first_name ASC, s.last_name ASC',
    );
  });
});

describe('searchWordsClause', () => {
  const columns = ['s.first_name', 's.middle_name', 's.last_name'];

  it('matches a single word against every name column, so a middle name or surname is found', () => {
    expect(searchWordsClause('idowu', columns, 2)).toEqual({
      sql: '((s.first_name ILIKE $2 OR s.middle_name ILIKE $2 OR s.last_name ILIKE $2))',
      params: ['%idowu%'],
    });
  });

  it('requires every word to match some column, so a phrase can span the name parts', () => {
    expect(searchWordsClause('Christiana  Idowu', columns, 3)).toEqual({
      sql:
        '((s.first_name ILIKE $3 OR s.middle_name ILIKE $3 OR s.last_name ILIKE $3) AND ' +
        '(s.first_name ILIKE $4 OR s.middle_name ILIKE $4 OR s.last_name ILIKE $4))',
      params: ['%Christiana%', '%Idowu%'],
    });
  });

  it('numbers its parameters from where the caller left off', () => {
    const match = searchWordsClause('a b', ['x'], 5);
    expect(match?.sql).toBe('((x ILIKE $5) AND (x ILIKE $6))');
    expect(match?.params).toHaveLength(2);
  });

  it('returns nothing for a blank term, so the caller adds no condition', () => {
    expect(searchWordsClause('', columns, 1)).toBeNull();
    expect(searchWordsClause('   ', columns, 1)).toBeNull();
  });

  it('matches wildcard characters literally', () => {
    expect(searchWordsClause('50%_off\\', ['x'], 1)?.params).toEqual(['%50\\%\\_off\\\\%']);
  });

  it('ignores words past the sixth', () => {
    expect(searchWordsClause('a b c d e f g h', ['x'], 1)?.params).toHaveLength(6);
  });
});
