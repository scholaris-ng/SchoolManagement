
/**
 * Pieces used by `invoice-detail-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

export function Row({
  label,
  value,
  emphasis,
  hint,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  hint?: string;
  tone?: 'danger' | 'success';
}) {
  const toneClass = tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : '';
  return (
    <div className={`flex items-baseline justify-between gap-4 ${emphasis ? 'font-semibold' : ''}`}>
      <dt className={emphasis ? '' : 'text-muted-foreground'}>
        {label}
        {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
      </dt>
      <dd className={`tabular-nums ${toneClass}`}>{value}</dd>
    </div>
  );
}
