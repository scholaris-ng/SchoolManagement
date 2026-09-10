import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { humanizeEnum } from '@/lib/utils';
import { useClasses } from '@/features/academics/api';
import { useDeleteCalendarEvent, useSaveCalendarEvent } from './api';
import type { CalendarEvent } from '@/types/curriculum';
import { Label } from '@/components/ui/primitives';
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
import { Alert } from '@/components/ui/feedback';
import { CATEGORIES, AUDIENCES } from './calendar-page-constants';

/**
 * Pieces used by `calendar-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function EventDialog({
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
              data-cy="event-title"
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
                data-cy="event-start"
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
                data-cy="event-end"
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
                data-cy="event-category"
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
                data-cy="event-audience"
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
                      data-cy="calendar-id"
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
              data-cy="event-location"
              id="event-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              data-cy="event-description"
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
              data-cy="calendar-delete"
              variant="danger"
              className="mr-auto"
              loading={remove.isPending}
              onClick={() => void remove.mutateAsync(state.event!.id).then(onClose)}
            >
              <Trash2 />
              Delete
            </Button>
          )}
          <Button data-cy="calendar-cancel" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-cy="calendar-save-event"
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
