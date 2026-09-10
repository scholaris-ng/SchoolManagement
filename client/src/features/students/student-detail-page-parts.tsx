import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/format';

/**
 * Pieces used by `student-detail-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 py-2', className)}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export { formatPercent };
