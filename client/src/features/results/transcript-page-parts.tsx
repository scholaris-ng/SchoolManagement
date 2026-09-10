
/**
 * Pieces used by `transcript-page`, kept beside it so neither file outgrows
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
