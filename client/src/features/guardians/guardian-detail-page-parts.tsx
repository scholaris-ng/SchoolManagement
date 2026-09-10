
/**
 * Pieces used by `guardian-detail-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function Detail({
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
        <p className="min-w-0">{children}</p>
      </div>
    </div>
  );
}
