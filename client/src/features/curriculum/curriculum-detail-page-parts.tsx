/**
 * Pieces used by `curriculum-detail-page`, split one per component so none outgrows
 * the limit in section 17 of the frontend guide.
 */
export { TopicDialog } from './topic-dialog';
export { ObjectiveDialog } from './objective-dialog';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  bloomBreakdown,
} from './bloom';
import type { LearningObjective } from '@/types/curriculum';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';

/**
 * How the objectives are spread across the six Bloom levels.
 *
 * Coverage answers "did we teach it?". This answers the question a coverage
 * percentage cannot: "what were we asking them to do?" A syllabus fully taught
 * but written entirely at Remember and Understand looks finished and is not,
 * and the exam is the wrong place to discover that.
 */
export function ThinkingDemandCard({ objectives }: { objectives: LearningObjective[] }) {
  const breakdown = useMemo(() => bloomBreakdown(objectives), [objectives]);
  if (breakdown.total === 0) return null;

  const busiest = Math.max(...breakdown.counts.map((entry) => entry.count), 1);
  const everythingUntagged = breakdown.tagged === 0;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Thinking demand</CardTitle>
          <CardDescription>
            What these objectives ask a child to do, from recalling a fact to building
            something new.
          </CardDescription>
        </div>
        {!everythingUntagged && (
          <Badge
            tone={
              breakdown.higherOrderShare >= 30
                ? 'success'
                : breakdown.higherOrderShare > 0
                  ? 'warning'
                  : 'danger'
            }
          >
            {Math.round(breakdown.higherOrderShare)}% higher order
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {everythingUntagged ? (
          <p className="text-sm text-muted-foreground">
            None of the {breakdown.total} objectives carry a thinking level yet. Set one while
            editing an objective and this fills in.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {breakdown.counts.map(({ definition, count, share }) => (
              <li key={definition.value} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 truncate" title={definition.hint}>
                  {definition.label}
                </span>
                {/* A bar against the busiest level rather than the total, so
                    the smaller levels stay visible instead of vanishing. */}
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      definition.higherOrder ? 'bg-primary' : 'bg-muted-foreground/40',
                    )}
                    style={{ width: `${(count / busiest) * 100}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
                  {count} · {Math.round(share)}%
                </span>
              </li>
            ))}
          </ul>
        )}

        {!everythingUntagged && breakdown.higherOrder === 0 && (
          <p className="text-sm text-warning">
            Every tagged objective sits at Remember, Understand or Apply. Nothing here asks a
            child to compare, judge or design, which is what the harder exam questions want.
          </p>
        )}

        {breakdown.untagged > 0 && (
          <p className="text-xs text-muted-foreground">
            {breakdown.untagged} of {breakdown.total} objectives are not tagged yet, so the
            shares above are of the {breakdown.tagged} that are.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
