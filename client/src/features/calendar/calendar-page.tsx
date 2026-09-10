import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, toDateInputValue } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useCalendarEvents } from './api';
import type { CalendarEvent } from '@/types/curriculum';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { EventDialog } from './calendar-page-parts';

const CATEGORY_COLOR: Record<CalendarEvent['category'], string> = {
  HOLIDAY: 'bg-success',
  EXAM: 'bg-danger',
  TEST: 'bg-warning',
  PTA: 'bg-info',
  EVENT: 'bg-primary',
  FEE_DEADLINE: 'bg-warning',
  ADMISSION: 'bg-info',
  STAFF: 'bg-muted-foreground',
};





/**
 * The shared school calendar.
 *
 * One calendar, several audiences: a staff-only INSET day should not appear in
 * a parent's app, and an exam that affects two classes should not alarm the
 * rest of the school (spec section 17).
 */
export function CalendarPage() {
  const { can } = useAuth();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [editing, setEditing] = useState<{ open: boolean; event?: CalendarEvent }>({ open: false });

  const range = useMemo(
    () => ({
      from: toDateInputValue(startOfWeek(startOfMonth(month), { weekStartsOn: 1 })),
      to: toDateInputValue(endOfWeek(endOfMonth(month), { weekStartsOn: 1 })),
    }),
    [month],
  );

  const events = useCalendarEvents(range);
  const canManage = can('calendar.manage');

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    (events.data ?? []).forEach((event) => {
      const start = parseISO(event.startDate);
      const end = parseISO(event.endDate);
      eachDayOfInterval({ start, end: end < start ? start : end }).forEach((day) => {
        const key = format(day, 'yyyy-MM-dd');
        map.set(key, [...(map.get(key) ?? []), event]);
      });
    });
    return map;
  }, [events.data]);

  const selectedEvents = eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Calendar"
        description="Holidays, examinations, PTA meetings and fee deadlines, targeted at the people they affect."
        breadcrumbs={[{ label: 'Teaching' }, { label: 'Calendar' }]}
        actions={
          canManage && (
            <Button data-cy="calendar-add-an-event" onClick={() => setEditing({ open: true })}>
              <Plus />
              Add an event
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{format(month, 'MMMM yyyy')}</CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  data-cy="calendar-previous-month"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous month"
                  onClick={() => setMonth((current) => addMonths(current, -1))}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  data-cy="calendar-today"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMonth(startOfMonth(new Date()));
                    setSelectedDay(new Date());
                  }}
                >
                  Today
                </Button>
                <Button
                  data-cy="calendar-next-month"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Next month"
                  onClick={() => setMonth((current) => addMonths(current, 1))}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {events.isPending ? (
              <LoadingState label="Loading events…" />
            ) : events.isError ? (
              <ErrorState error={events.error} onRetry={() => void events.refetch()} compact />
            ) : (
              <div role="grid" aria-label={`Calendar for ${format(month, 'MMMM yyyy')}`}>
                <div className="grid grid-cols-7 gap-1 pb-1" role="row">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                    <div
                      key={label}
                      role="columnheader"
                      className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsByDay.get(key) ?? [];
                    const outside = !isSameMonth(day, month);
                    const selected = isSameDay(day, selectedDay);

                    return (
                      <button
                        data-cy="calendar-dayevents-length-3"
                        key={key}
                        type="button"
                        role="gridcell"
                        aria-selected={selected}
                        onClick={() => setSelectedDay(day)}
                        className={cn(
                          'flex min-h-[4.5rem] flex-col gap-1 rounded-md border p-1.5 text-left transition-colors',
                          selected
                            ? 'border-primary bg-primary-subtle'
                            : 'border-transparent hover:border-border hover:bg-accent/40',
                          outside && 'opacity-40',
                        )}
                      >
                        <span
                          className={cn(
                            'text-xs tabular-nums',
                            isToday(day)
                              ? 'grid size-5 place-items-center rounded-full bg-primary font-semibold text-primary-foreground'
                              : 'text-muted-foreground',
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                        <span className="flex flex-wrap gap-0.5">
                          {dayEvents.slice(0, 3).map((event) => (
                            <span
                              key={event.id}
                              className={cn('h-1.5 w-1.5 rounded-full', CATEGORY_COLOR[event.category])}
                              aria-hidden="true"
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{dayEvents.length - 3}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{formatDate(selectedDay)}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {selectedEvents.length === 0 ? (
              <EmptyState compact icon={<CalendarDays />} title="Nothing scheduled" />
            ) : (
              <ul className="divide-y divide-border">
                {selectedEvents.map((event) => (
                  <li key={event.id} className="space-y-1.5 px-5 py-3">
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          CATEGORY_COLOR[event.category],
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(event.startDate)}
                          {event.endDate !== event.startDate && ` – ${formatDate(event.endDate)}`}
                          {event.location ? ` · ${event.location}` : ''}
                        </p>
                      </div>
                      {canManage && (
                        <Button
                          data-cy="calendar-edit"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing({ open: true, event })}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                    {event.description && (
                      <p className="pl-4 text-sm text-muted-foreground">{event.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pl-4">
                      <Badge tone="neutral">{humanizeEnum(event.category)}</Badge>
                      <Badge tone="outline">{humanizeEnum(event.audience)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <EventDialog
        key={editing.event?.id ?? 'new'}
        state={editing}
        defaultDate={toDateInputValue(selectedDay)}
        onClose={() => setEditing({ open: false })}
      />
    </PageContainer>
  );
}
