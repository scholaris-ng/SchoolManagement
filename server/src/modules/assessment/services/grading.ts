import type { AssessmentComponentDTO, GradeBandDTO, GradingSchemeDTO } from '../dto/assessment.dto';

/**
 * The arithmetic every results screen shares (spec section 19). A mark is
 * the sum of its components; its grade is the band its percentage of the
 * obtainable total falls in. Pure functions, so the report card, broadsheet,
 * transcript and analytics cannot disagree about what a 69.5 is.
 */

export interface MarkSummary {
  /** Null when nothing has been entered — the pupil was absent, not scored zero. */
  total: number | null;
  obtainable: number;
  percentage: number | null;
  grade: string | null;
  remark: string | null;
  isPass: boolean | null;
}

export function obtainable(components: AssessmentComponentDTO[]): number {
  return components.reduce((sum, component) => sum + component.maxScore, 0);
}

export function bandFor(bands: GradeBandDTO[], percentage: number): GradeBandDTO | null {
  const rounded = Math.round(percentage);
  return bands.find((band) => rounded >= band.minScore && rounded <= band.maxScore) ?? null;
}

export function summarise(
  scheme: Pick<GradingSchemeDTO, 'components' | 'bands'>,
  scores: { componentId: string; score: number | null }[],
): MarkSummary {
  const max = obtainable(scheme.components);
  const entered = scores.filter((cell) => cell.score !== null);
  if (entered.length === 0) {
    return { total: null, obtainable: max, percentage: null, grade: null, remark: null, isPass: null };
  }
  const total = round2(entered.reduce((sum, cell) => sum + (cell.score ?? 0), 0));
  const percentage = max > 0 ? round1((total / max) * 100) : 0;
  const band = bandFor(scheme.bands, percentage);
  return {
    total,
    obtainable: max,
    percentage,
    grade: band?.label ?? null,
    remark: band?.remark ?? null,
    isPass: band ? band.isPass : null,
  };
}

/**
 * Competition ranking on a descending value: equal totals share a position
 * and the next one skips (1, 1, 3). Nulls are unranked.
 */
export function rank<T>(items: T[], valueOf: (item: T) => number | null): Map<T, number | null> {
  const ranked = items
    .filter((item) => valueOf(item) !== null)
    .sort((a, b) => (valueOf(b) as number) - (valueOf(a) as number));
  const positions = new Map<T, number | null>(items.map((item) => [item, null]));
  let position = 0;
  ranked.forEach((item, index) => {
    if (index === 0 || valueOf(item) !== valueOf(ranked[index - 1])) position = index + 1;
    positions.set(item, position);
  });
  return positions;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
