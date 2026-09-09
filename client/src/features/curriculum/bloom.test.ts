import { describe, expect, it } from 'vitest';
import { BLOOM_LEVELS, bloom, bloomBreakdown, bloomLabel } from './bloom';

const at = (...levels: (string | null)[]) =>
  levels.map((bloomLevel) => ({ bloomLevel: bloomLevel as never }));

describe('bloom levels', () => {
  it('runs from least to most demanding, with the top three counted as higher order', () => {
    expect(BLOOM_LEVELS.map((level) => level.value)).toEqual([
      'REMEMBER',
      'UNDERSTAND',
      'APPLY',
      'ANALYSE',
      'EVALUATE',
      'CREATE',
    ]);
    expect(BLOOM_LEVELS.filter((level) => level.higherOrder).map((level) => level.value)).toEqual([
      'ANALYSE',
      'EVALUATE',
      'CREATE',
    ]);
  });

  it('names a level, and calls a missing one "not set"', () => {
    expect(bloomLabel('ANALYSE')).toBe('Analyse');
    expect(bloomLabel(null)).toBe('Not set');
    expect(bloom(null)).toBeNull();
    expect(bloom('APPLY')?.verbs).toContain('calculate');
  });
});

describe('bloomBreakdown', () => {
  it('counts each level and works out its share', () => {
    const result = bloomBreakdown(at('REMEMBER', 'REMEMBER', 'APPLY', 'CREATE'));

    expect(result.total).toBe(4);
    expect(result.tagged).toBe(4);
    expect(result.untagged).toBe(0);

    const byLevel = Object.fromEntries(
      result.counts.map((entry) => [entry.definition.value, entry.count]),
    );
    expect(byLevel.REMEMBER).toBe(2);
    expect(byLevel.APPLY).toBe(1);
    expect(byLevel.CREATE).toBe(1);
    expect(byLevel.EVALUATE).toBe(0);

    expect(result.counts.find((e) => e.definition.value === 'REMEMBER')?.share).toBe(50);
  });

  it('reports higher-order work as a share of what is tagged, not of everything', () => {
    // Half untagged. Of the two that are tagged, one is higher order.
    const result = bloomBreakdown(at('REMEMBER', 'ANALYSE', null, null));

    expect(result.untagged).toBe(2);
    expect(result.tagged).toBe(2);
    expect(result.higherOrder).toBe(1);
    expect(result.higherOrderShare).toBe(50);
  });

  it('sees a recall-only syllabus for what it is', () => {
    const result = bloomBreakdown(at('REMEMBER', 'UNDERSTAND', 'APPLY', 'REMEMBER'));
    expect(result.higherOrder).toBe(0);
    expect(result.higherOrderShare).toBe(0);
  });

  it('does not divide by zero when nothing is tagged', () => {
    const result = bloomBreakdown(at(null, null));
    expect(result.tagged).toBe(0);
    expect(result.higherOrderShare).toBe(0);
    expect(result.counts.every((entry) => entry.share === 0)).toBe(true);
  });

  it('handles an empty curriculum', () => {
    const result = bloomBreakdown([]);
    expect(result.total).toBe(0);
    expect(result.counts).toHaveLength(6);
  });

  it('treats an unrecognised level as untagged rather than counting it', () => {
    const result = bloomBreakdown(at('SYNTHESISE'));
    expect(result.untagged).toBe(1);
    expect(result.tagged).toBe(0);
  });
});
