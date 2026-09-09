import { CalendarRange } from 'lucide-react';
import { useCurrentTerm } from '@/features/academics/api';

/**
 * Which term and session the school is working in, in the top bar.
 *
 * Everything dated in this product — attendance, score entry, invoices, the
 * curriculum — is filed against the current term, and the commonest support
 * question is "why am I not seeing it?" when someone is looking at a different
 * one than they assume. Showing it on every page, for every role, answers that
 * before it gets asked. It is deliberately read-only: changing the term is an
 * administrator's decision, made in settings.
 */
export function CurrentTermBadge() {
  const { data: term } = useCurrentTerm();
  if (!term) return null;

  return (
    <span
      className="hidden items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground sm:inline-flex"
      title={`Current term: ${term.name}, ${term.sessionName}`}
    >
      <CalendarRange className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="font-medium text-foreground">{term.name}</span>
      {/* The session is the half people get wrong, so it stays visible where
          there is room rather than hiding behind the tooltip. */}
      <span className="hidden md:inline">· {term.sessionName}</span>
    </span>
  );
}
