import { amountInWords, numberToWords } from '../utils/numberToWords';

describe('numberToWords', () => {
  it('spells the small numbers that have their own names', () => {
    expect(numberToWords(0)).toBe('zero');
    expect(numberToWords(7)).toBe('seven');
    expect(numberToWords(13)).toBe('thirteen');
    expect(numberToWords(19)).toBe('nineteen');
  });

  it('hyphenates the compound tens', () => {
    expect(numberToWords(21)).toBe('twenty-one');
    expect(numberToWords(85)).toBe('eighty-five');
    expect(numberToWords(90)).toBe('ninety');
  });

  it('uses the British "and" before a tail under a hundred', () => {
    expect(numberToWords(105)).toBe('one hundred and five');
    expect(numberToWords(2_005)).toBe('two thousand and five');
  });

  it('drops the "and" when the tail is itself a hundred or more', () => {
    expect(numberToWords(2_100)).toBe('two thousand one hundred');
    expect(numberToWords(185_000)).toBe('one hundred and eighty-five thousand');
  });

  it('climbs the short scale', () => {
    expect(numberToWords(1_000_000)).toBe('one million');
    expect(numberToWords(3_450_000)).toBe('three million four hundred and fifty thousand');
  });

  it('spells a negative rather than refusing it — a reversal is real', () => {
    expect(numberToWords(-12)).toBe('minus twelve');
  });
});

describe('amountInWords', () => {
  it('writes a round amount the way a receipt does', () => {
    expect(amountInWords(185_000)).toBe('One hundred and eighty-five thousand naira only');
  });

  it('names both units when there is change, and drops "only"', () => {
    expect(amountInWords(185_000.5)).toBe('One hundred and eighty-five thousand naira, fifty kobo');
  });

  it('rounds to the kobo before spelling, so float noise never reaches the page', () => {
    expect(amountInWords(0.1 + 0.2)).toBe('Zero naira, thirty kobo');
  });

  it('honours another currency', () => {
    expect(amountInWords(42, 'USD')).toBe('Forty-two dollars only');
  });

  it('falls back to the code rather than inventing a unit name', () => {
    expect(amountInWords(1_000, 'XOF')).toBe('One thousand XOF only');
  });
});
