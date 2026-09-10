
/**
 * Pieces used by `invoice-form-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between ${emphasis ? 'font-semibold' : ''}`}>
      <dt className={emphasis ? '' : 'text-muted-foreground'}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
