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
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, toDateInputValue } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useClasses } from '@/features/academics/api';
import { useCalendarEvents, useDeleteCalendarEvent, useSaveCalendarEvent } from './api';
import type { CalendarEvent } from '@/types/curriculum';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge, Card, CardContent, CardHeader, CardTitle, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';

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

const CATEGORIES: CalendarEvent['category'][] = [
  'HOLIDAY',
  'EXAM',
  'TEST',
  'PTA',
  'EVENT',
  'FEE_DEADLINE',
  'ADMISSION',
  'STAFF',
];

const AUDIENCES: CalendarEvent['audience'][] = [
  'EVERYONE',
  'STAFF',
  'PARENTS',
  'STUDENTS',
  'CLASSES',
];

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
            <Button onClick={() => setEditing({ open: true })}>
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
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous month"
                  onClick={() => setMonth((current) => addMonths(current, -1))}
                >
                  <ChevronLeft />
                </Button>
                <Button
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

function EventDialog({
  state,
  defaultDate,
  onClose,
}: {
  state: { open: boolean; event?: CalendarEvent };
  defaultDate: string;
  onClose: () => void;
}) {
  const save = useSaveCalendarEvent(state.event?.id);
  const remove = useDeleteCalendarEvent();
  const classes = useClasses();

  const [title, setTitle] = useState(state.event?.title ?? '');
  const [description, setDescription] = useState(state.event?.description ?? '');
  const [category, setCategory] = useState<CalendarEvent['category']>(
    state.event?.category ?? 'EVENT',
  );
  const [startDate, setStartDate] = useState(state.event?.startDate ?? defaultDate);
  const [endDate, setEndDate] = useState(state.event?.endDate ?? defaultDate);
  const [location, setLocation] = useState(state.event?.location ?? '');
  const [audience, setAudience] = useState<CalendarEvent['audience']>(
    state.event?.audience ?? 'EVERYONE',
  );
  const [classIds, setClassIds] = useState<string[]>(state.event?.classIds ?? []);

  const valid = title.trim() && startDate && endDate && endDate >= startDate;

  const submit = async () => {
    await save.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      category,
      startDate,
      endDate,
      allDay: true,
      location: location.trim() || null,
      audience,
      classIds: audience === 'CLASSES' ? classIds : [],
      roleNames: [],
    });
    onClose();
  };

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{state.event ? 'Edit event' : 'Add a calendar event'}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-title" required>
              Title
            </Label>
            <Input
              id="event-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. First term examinations begin"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-start" required>
                Starts
              </Label>
              <Input
                id="event-start"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  if (endDate < event.target.value) setEndDate(event.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end" required>
                Ends
              </Label>
              <Input
                id="event-end"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-category">Category</Label>
              <NativeSelect
                id="event-category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as CalendarEvent['category'])
                }
              >
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {humanizeEnum(option)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-audience">Who sees it</Label>
              <NativeSelect
                id="event-audience"
                value={audience}
                onChange={(event) =>
                  setAudience(event.target.value as CalendarEvent['audience'])
                }
              >
                {AUDIENCES.map((option) => (
                  <option key={option} value={option}>
                    {humanizeEnum(option)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {audience === 'CLASSES' && (
            <div className="space-y-1.5">
              <Label>Classes</Label>
              <div className="scrollbar-thin grid max-h-40 gap-2 overflow-y-auto rounded-md border border-input p-3 sm:grid-cols-2">
                {(classes.data ?? []).map((schoolClass) => (
                  <label key={schoolClass.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={classIds.includes(schoolClass.id)}
                      onChange={() =>
                        setClassIds((current) =>
                          current.includes(schoolClass.id)
                            ? current.filter((id) => id !== schoolClass.id)
                            : [...current, schoolClass.id],
                        )
                      }
                      className="size-4 rounded border-input"
                    />
                    {schoolClass.name}
                  </label>
                ))}
              </div>
              {classIds.length === 0 && (
                <Alert tone="warning">Choose at least one class, or change the audience.</Alert>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          {state.event && (
            <Button
              variant="danger"
              className="mr-auto"
              loading={remove.isPending}
              onClick={() => void remove.mutateAsync(state.event!.id).then(onClose)}
            >
              <Trash2 />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={!valid || (audience === 'CLASSES' && classIds.length === 0)}
            onClick={() => void submit()}
          >
            Save event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
