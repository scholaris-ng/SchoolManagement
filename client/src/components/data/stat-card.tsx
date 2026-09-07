import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import { Card, Skeleton } from '@/components/ui/primitives';
import { Tooltip } from '@/components/ui/feedback';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  delta?: { value: number; direction: 'up' | 'down' | 'flat'; periodLabel: string };
  /** When set the whole tile becomes a link to the underlying list. */
  to?: string;
  loading?: boolean;
  className?: string;
  /** Reverses delta colouring where a rise is bad (e.g. outstanding fees). */
  invertDelta?: boolean;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  delta,
  to,
  loading,
  className,
  invertDelta,
}: StatCardProps) {
  const toneClasses = {
    neutral: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];

  const deltaGood = delta
    ? delta.direction === 'flat'
      ? null
      : invertDelta
        ? delta.direction === 'down'
        : delta.direction === 'up'
    : null;

  const DeltaIcon =
    delta?.direction === 'up' ? ArrowUpRight : delta?.direction === 'down' ? ArrowDownRight : ArrowRight;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && (
          <span className="shrink-0 text-muted-foreground [&_svg]:size-4" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums tracking-tight', toneClasses)}>
          {typeof value === 'number' ? formatNumber(value) : value}
        </p>
      )}

      <div className="mt-1.5 flex items-center gap-2">
        {delta && !loading && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
              deltaGood === null
                ? 'text-muted-foreground'
                : deltaGood
                  ? 'text-success'
                  : 'text-danger',
            )}
          >
            <DeltaIcon className="size-3" aria-hidden="true" />
            {Math.abs(delta.value)}%
            <span className="font-normal text-muted-foreground"> {delta.periodLabel}</span>
          </span>
        )}
        {hint && !delta && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </>
  );

  const shell = (
    <Card
      className={cn(
        'p-4',
        to && 'transition-colors hover:border-primary/40 hover:bg-accent/40',
        className,
      )}
    >
      {hint && delta ? <Tooltip content={hint}>{<div>{body}</div>}</Tooltip> : body}
    </Card>
  );

  return to ? (
    <Link to={to} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {shell}
    </Link>
  ) : (
    shell
  );
}
