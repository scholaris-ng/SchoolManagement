import { describe, expect, it } from 'vitest';
import { colorFromString, contrastingTextColor } from './utils';

/**
 * Text sitting directly on a colour swatch — an avatar initial, a school's
 * own brand mark — can't rely on the light/dark theme to guarantee contrast;
 * the swatch itself might be pale. "The St Christopher" is the regression
 * case: it hashes to a gold hue where hardcoded white text measured under
 * 2.6:1 against it, well below WCAG's 4.5:1 floor.
 */
describe('contrastingTextColor', () => {
  it('picks dark text for the exact pale swatch that was illegible in white', () => {
    const background = colorFromString('The St Christopher');
    expect(background).toBe('hsl(55 62% 45%)');
    expect(contrastingTextColor(background)).toBe('#0b111e');
  });

  it('still picks white for a swatch dark enough to need it', () => {
    // The default brand indigo used when a school has set no colour of its own.
    expect(contrastingTextColor('#4f46e5')).toBe('#ffffff');
  });

  it('picks white on true black and dark text on true white', () => {
    expect(contrastingTextColor('#000000')).toBe('#ffffff');
    expect(contrastingTextColor('#ffffff')).toBe('#0b111e');
  });

  it('reads the hsl() shape colorFromString emits, not just hex', () => {
    // The same colour, expressed the two ways this function has to accept.
    expect(contrastingTextColor('hsl(0 72% 60%)')).toBe(contrastingTextColor('#e25050'));
  });

  it('is deterministic for the same swatch', () => {
    const a = contrastingTextColor('#facc15');
    const b = contrastingTextColor('#facc15');
    expect(a).toBe(b);
  });

  it('falls back to a real colour rather than throwing on something unrecognised', () => {
    expect(() => contrastingTextColor('not-a-colour')).not.toThrow();
    expect(contrastingTextColor('not-a-colour')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
