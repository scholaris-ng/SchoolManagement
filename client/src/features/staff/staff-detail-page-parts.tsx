import { formatPercent } from '@/lib/format';
import {
  Progress,
} from '@/components/ui/primitives';

/**
 * Pieces used by `staff-detail-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{formatPercent(value, 0)}</span>
      </div>
      <Progress
        className="mt-1"
        value={value}
        tone={value >= 85 ? 'success' : value >= 60 ? 'warning' : 'danger'}
      />
    </div>
  );
}
