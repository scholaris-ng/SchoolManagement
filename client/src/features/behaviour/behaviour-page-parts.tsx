/**
 * Pieces used by `behaviour-page`, split one per component so none outgrows
 * the limit in section 17 of the frontend guide.
 */
export { ObservationDialog } from './observation-dialog';
export { TraitDialog } from './trait-dialog';

import { cn } from '@/lib/utils';

/**
 * Pieces used by `behaviour-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function RatingDots({ rating, max }: { rating: number; max: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-0.5"
      role="img"
      aria-label={`Rated ${rating} out of ${max}`}
    >
      {Array.from({ length: max }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'size-2.5 rounded-full',
            index < rating ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
      <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
        {rating}/{max}
      </span>
    </span>
  );
}
