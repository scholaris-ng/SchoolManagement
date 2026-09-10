import { Pencil } from 'lucide-react';
import { CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import type { AcademicSession, Term } from '@/types/academics';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/status-badge';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import type { UseQueryResult } from '@tanstack/react-query';

export function SessionsPanel({
  sessions,
  termsBySession,
  onEditSession,
  onDeleteSession,
  onAddTerm,
  onEditTerm,
  onSetCurrentTerm,
  isSettingCurrentTerm,
}: {
  sessions: UseQueryResult<AcademicSession[]>;
  termsBySession: (sessionId: string) => Term[];
  onEditSession: (session: AcademicSession) => void;
  onDeleteSession: (session: AcademicSession) => void;
  onAddTerm: (session: AcademicSession) => void;
  onEditTerm: (term: Term, session: AcademicSession) => void;
  onSetCurrentTerm: (termId: string) => void;
  isSettingCurrentTerm: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Academic sessions and terms</CardTitle>
        <CardDescription>
          The current term drives attendance, score entry, invoicing and report cards. Only one
          term can be current at a time.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {sessions.isPending ? (
          <LoadingState label="Loading sessions…" />
        ) : (sessions.data?.length ?? 0) === 0 ? (
          <EmptyState compact icon={<CalendarRange />} title="No sessions defined" />
        ) : (
          <ul className="divide-y divide-border">
            {sessions.data?.map((session) => (
              <li key={session.id} className="space-y-2 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{session.name}</p>
                  {session.isCurrent && <Badge tone="success">Current session</Badge>}
                  <StatusBadge status={session.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(session.startDate)} – {formatDate(session.endDate)}
                  </span>
                  <Button
                    data-cy="settings-academics-settings-edit"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 px-2 text-xs"
                    onClick={() => onEditSession(session)}
                  >
                    Edit
                  </Button>
                  <Button
                    data-cy="settings-academics-settings-delete"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-danger hover:text-danger"
                    disabled={session.isCurrent}
                    title={
                      session.isCurrent
                        ? 'Make another session current before deleting this one'
                        : undefined
                    }
                    onClick={() => onDeleteSession(session)}
                  >
                    Delete
                  </Button>
                </div>
                <ul className="grid gap-2 sm:grid-cols-3">
                  {termsBySession(session.id).map((term) => (
                      <li
                        key={term.id}
                        className={cn(
                          'rounded-md border p-3 text-sm',
                          term.isCurrent ? 'border-primary bg-primary-subtle' : 'border-border',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{term.name}</p>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              data-cy={`academics-settings-term-edit-${term.id}`}
                              aria-label={`Edit ${term.name}`}
                              onClick={() =>
                                onEditTerm(term, session)
                              }
                              className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </button>
                            {term.isCurrent ? (
                              <Badge tone="primary">Current</Badge>
                            ) : (
                              <Button
                                data-cy="settings-academics-settings-make-current"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                loading={
                                  isSettingCurrentTerm
                                }
                                onClick={() => onSetCurrentTerm(term.id)}
                              >
                                Make current
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(term.startDate)} – {formatDate(term.endDate)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {term.teachingWeeks} teaching weeks
                        </p>
                      </li>
                    ))}
                  <li>
                    <button
                      data-cy="settings-academics-settings-add-term"
                      type="button"
                      onClick={() =>
                        onAddTerm(session)
                      }
                      className="grid h-full min-h-[4.5rem] w-full place-items-center rounded-md border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40"
                    >
                      + Add term
                    </button>
                  </li>
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
