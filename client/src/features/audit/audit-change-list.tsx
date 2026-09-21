import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { routeForRecord, type AuditPart, type AuditRow } from './audit-values';

/**
 * What an entry recorded, one plain line per field.
 *
 * A field that changed reads "old → new"; one that did not is shown once, so
 * the lines around a change stay as context. A record — a student, a class —
 * is its name, and a link to it where the app has a page for it.
 */
export function AuditChangeList({ rows }: { rows: AuditRow[] }) {
  return (
    <dl data-cy="audit-details" className="divide-y divide-border rounded-md border border-border">
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="grid gap-0.5 px-3 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4"
        >
          <dt className="text-sm text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 break-words text-sm">
            {row.changed ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="sr-only">Changed from </span>
                <span className="text-muted-foreground line-through decoration-muted-foreground/60">
                  <Parts parts={row.before} />
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only"> to </span>
                <span className="font-medium">
                  <Parts parts={row.after} />
                </span>
              </span>
            ) : (
              <Parts parts={row.after ?? row.before} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Parts({ parts }: { parts: AuditPart[] | null }) {
  return (
    <>
      {(parts ?? []).map((part, index) => (
        <Fragment key={index}>
          {index > 0 && ', '}
          <PartView part={part} />
        </Fragment>
      ))}
    </>
  );
}

export function PartView({ part }: { part: AuditPart }) {
  if (part.kind === 'text') return <>{part.text}</>;

  if (part.kind === 'unknown') {
    return <span className="italic text-muted-foreground">No longer available</span>;
  }

  // A deleted record has nowhere left to link to.
  const to = part.removed ? null : routeForRecord(part.type, part.id);
  return (
    <>
      {to ? (
        <Link to={to} className="text-primary hover:underline">
          {part.label}
        </Link>
      ) : (
        part.label
      )}
      {part.removed && <span className="ml-1 text-xs text-muted-foreground">(deleted)</span>}
    </>
  );
}
