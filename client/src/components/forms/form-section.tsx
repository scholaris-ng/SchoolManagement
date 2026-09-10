import { cn } from '@/lib/utils';

/** Groups related fields with a heading, used across the long setup forms. */
export function FormSection({
  title,
  description,
  children,
  className,
  columns = 2,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3;
}) {
  const gridClass = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }[columns];
  return (
    <section className={cn('space-y-4', className)}>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className={cn('grid gap-4', gridClass)}>{children}</div>
    </section>
  );
}
