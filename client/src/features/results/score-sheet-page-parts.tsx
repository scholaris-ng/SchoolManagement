import { CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pieces used by `score-sheet-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function gradeFor(total: number, sheet: { components: { maxScore: number }[] }): string {
  const max = sheet.components.reduce((sum, component) => sum + component.maxScore, 0);
  const percent = max === 0 ? 0 : (total / max) * 100;
  if (percent >= 70) return 'A';
  if (percent >= 60) return 'B';
  if (percent >= 50) return 'C';
  if (percent >= 45) return 'D';
  if (percent >= 40) return 'E';
  return 'F';
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function Step({ label, done, detail }: { label: string; done: boolean; detail?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={cn(
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full',
          done ? 'bg-success text-success-foreground' : 'border border-border',
        )}
        aria-hidden="true"
      >
        {done && <CheckCheck className="size-2.5" />}
      </span>
      <div className="min-w-0">
        <p className={cn(done ? 'font-medium' : 'text-muted-foreground')}>{label}</p>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}
