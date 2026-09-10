import { buildDelta } from '../services/dashboard.service';

/**
 * The direction drives an arrow and a colour on the admin's first screen, so a
 * flipped sign is a wrong story about the school rather than a cosmetic bug.
 */
describe('buildDelta', () => {
  it('reads a rise as up', () => {
    expect(buildDelta(12)).toMatchObject({ value: 12, direction: 'up' });
  });

  it('reads a fall as down', () => {
    expect(buildDelta(-3)).toMatchObject({ value: -3, direction: 'down' });
  });

  it('reads no change as flat rather than as a fall', () => {
    expect(buildDelta(0)).toMatchObject({ value: 0, direction: 'flat' });
  });

  it('names the window it compared against', () => {
    expect(buildDelta(1).periodLabel).toBe('vs last 30 days');
  });
});
