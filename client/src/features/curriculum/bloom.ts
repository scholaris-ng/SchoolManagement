import type { LearningObjective } from '@/types/curriculum';

export type BloomLevel = NonNullable<LearningObjective['bloomLevel']>;

export interface BloomDefinition {
  value: BloomLevel;
  label: string;
  /** One line, short enough to sit under the option in a dropdown. */
  hint: string;
  /** The verbs that usually give a level away, for the teacher writing one. */
  verbs: string[];
  example: string;
  /**
   * Analyse and above are the "higher order" half. The split is what the
   * breakdown reports on: a syllabus that never crosses it trains recall.
   */
  higherOrder: boolean;
}

/**
 * Bloom's taxonomy, revised, lowest demand first.
 *
 * Tagging an objective by how hard it makes a child think is what turns a
 * covered syllabus into an honest one. A school can cover every topic and
 * still only ever ask children to remember, which the coverage percentage
 * alone will happily report as a job well done — and which a WAEC paper full
 * of "justify" and "compare" will then contradict.
 */
export const BLOOM_LEVELS: BloomDefinition[] = [
  {
    value: 'REMEMBER',
    label: 'Remember',
    hint: 'Recall a fact as it was given',
    verbs: ['define', 'list', 'state', 'name', 'recall'],
    example: 'State the three laws of motion.',
    higherOrder: false,
  },
  {
    value: 'UNDERSTAND',
    label: 'Understand',
    hint: 'Explain it in their own words',
    verbs: ['explain', 'describe', 'summarise', 'interpret'],
    example: 'Explain why leaves are green.',
    higherOrder: false,
  },
  {
    value: 'APPLY',
    label: 'Apply',
    hint: 'Use it in a new but familiar situation',
    verbs: ['calculate', 'solve', 'use', 'demonstrate'],
    example: 'Calculate the area of this triangle.',
    higherOrder: false,
  },
  {
    value: 'ANALYSE',
    label: 'Analyse',
    hint: 'Break it apart and see how the parts relate',
    verbs: ['compare', 'contrast', 'classify', 'distinguish'],
    example: 'Compare photosynthesis and respiration.',
    higherOrder: true,
  },
  {
    value: 'EVALUATE',
    label: 'Evaluate',
    hint: 'Judge it against criteria, and defend the judgment',
    verbs: ['justify', 'assess', 'argue', 'critique'],
    example: 'Argue whether the policy was justified.',
    higherOrder: true,
  },
  {
    value: 'CREATE',
    label: 'Create',
    hint: 'Put parts together into something new',
    verbs: ['design', 'compose', 'plan', 'propose'],
    example: 'Design an experiment to test this.',
    higherOrder: true,
  },
];

const BY_VALUE = new Map(BLOOM_LEVELS.map((level) => [level.value, level]));

export function bloom(level: BloomLevel | null | undefined): BloomDefinition | null {
  return level ? (BY_VALUE.get(level) ?? null) : null;
}

export function bloomLabel(level: BloomLevel | null | undefined): string {
  return bloom(level)?.label ?? 'Not set';
}

/** Radix Select cannot hold an empty value, so "not set" needs a name. */
export const BLOOM_UNSET = 'UNSET';

export interface BloomBreakdown {
  counts: { definition: BloomDefinition; count: number; share: number }[];
  untagged: number;
  total: number;
  /** Objectives carrying a level, which the shares are a percentage of. */
  tagged: number;
  higherOrder: number;
  higherOrderShare: number;
}

/**
 * How a curriculum's objectives are spread across the six levels.
 *
 * Shares are of the *tagged* objectives, not of everything: a curriculum that
 * is half untagged would otherwise read as though it had no higher-order work
 * in it, when the truth is that nobody has said yet.
 */
export function bloomBreakdown(
  objectives: { bloomLevel?: BloomLevel | null }[],
): BloomBreakdown {
  const tally = new Map<BloomLevel, number>();
  let untagged = 0;

  for (const objective of objectives) {
    if (!objective.bloomLevel || !BY_VALUE.has(objective.bloomLevel)) {
      untagged += 1;
      continue;
    }
    tally.set(objective.bloomLevel, (tally.get(objective.bloomLevel) ?? 0) + 1);
  }

  const tagged = objectives.length - untagged;
  const counts = BLOOM_LEVELS.map((definition) => {
    const count = tally.get(definition.value) ?? 0;
    return { definition, count, share: tagged ? (count / tagged) * 100 : 0 };
  });

  const higherOrder = counts
    .filter((entry) => entry.definition.higherOrder)
    .reduce((total, entry) => total + entry.count, 0);

  return {
    counts,
    untagged,
    total: objectives.length,
    tagged,
    higherOrder,
    higherOrderShare: tagged ? (higherOrder / tagged) * 100 : 0,
  };
}
