import { orderByPersonName } from '../pagination/personName';

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
