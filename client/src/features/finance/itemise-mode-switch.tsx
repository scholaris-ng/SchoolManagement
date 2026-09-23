import { cn } from '@/lib/utils';

/**
 * The two ways to say which charges a payment covered: let the split be
 * worked out, or type it in.
 *
 * A segmented pair rather than a checkbox, because neither side is the
 * "off" state — both produce a real answer, and the one showing is the one
 * in force.
 */
export function ItemiseModeSwitch<T extends string>({
  value,
  onChange,
  options,
  dataCy,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  dataCy?: string;
}) {
  return (
    <div
      data-cy={dataCy}
      className="no-print inline-flex rounded-md border border-border p-0.5 text-xs"
      role="group"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-cy={dataCy ? `${dataCy}-${option.value}` : undefined}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded px-2 py-1 transition-colors',
            value === option.value
              ? 'bg-primary font-medium text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
