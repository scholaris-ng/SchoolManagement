import {
  Label,
  Switch,
} from '@/components/ui/primitives';

/**
 * Pieces used by `school-settings-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label required={required}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch
        data-cy={`toggle-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}
