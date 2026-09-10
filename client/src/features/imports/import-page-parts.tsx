import {
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { STEPS } from './import-page-constants';

/**
 * Pieces used by `import-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Import progress">
      {STEPS.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1',
              index < current
                ? 'bg-success-subtle text-success'
                : index === current
                  ? 'bg-primary-subtle font-medium text-primary'
                  : 'text-muted-foreground',
            )}
            aria-current={index === current ? 'step' : undefined}
          >
            {index < current ? (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            ) : (
              <span className="tabular-nums">{index + 1}.</span>
            )}
            {label}
          </span>
          {index < STEPS.length - 1 && (
            <span className="text-muted-foreground" aria-hidden="true">
              ›
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function Tally({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    neutral: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];

  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', toneClass)}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
