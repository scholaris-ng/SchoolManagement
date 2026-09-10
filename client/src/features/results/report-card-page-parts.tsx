import { Textarea, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';

/**
 * Pieces used by `report-card-page`, kept beside it so neither file outgrows
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

export function CommentBlock({
  label,
  value,
  editable,
  templates,
  onChange,
}: {
  label: string;
  value: string;
  editable: boolean;
  templates: string[];
  onChange: (value: string) => void;
}) {
  if (!editable) {
    return (
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 min-h-[2.5rem] text-sm">{value || '—'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={`comment-${label}`}>{label}</Label>
        {templates.length > 0 && (
          <NativeSelect
            data-cy={`report-card-comment-template-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            aria-label={`Insert a template for ${label}`}
            value=""
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value);
            }}
            className="no-print h-8 w-auto max-w-[16rem] text-xs"
          >
            <option value="">Use a template…</option>
            {templates.map((text, index) => (
              <option key={index} value={text}>
                {text.length > 60 ? `${text.slice(0, 57)}…` : text}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>
      <Textarea
        data-cy="results-report-card-value"
        id={`comment-${label}`}
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write a comment, or pick a template above."
      />
    </div>
  );
}
