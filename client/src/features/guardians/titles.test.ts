import { describe, expect, it } from 'vitest';
import { TITLE_OPTIONS, titleOptionsFor } from './titles';

describe('titleOptionsFor', () => {
  it('returns the plain list when there is no title, or it is already in the list', () => {
    expect(titleOptionsFor(undefined)).toBe(TITLE_OPTIONS);
    expect(titleOptionsFor('')).toBe(TITLE_OPTIONS);
    expect(titleOptionsFor('Dr')).toBe(TITLE_OPTIONS);
  });

  it('keeps a title from before the list existed, so editing does not clear it', () => {
    const options = titleOptionsFor('Lady');
    expect(options[0]).toEqual({ value: 'Lady', label: 'Lady' });
    expect(options.slice(1)).toEqual(TITLE_OPTIONS);
  });
});
