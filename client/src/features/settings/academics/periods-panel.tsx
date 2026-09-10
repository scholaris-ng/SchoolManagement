import { Clock } from 'lucide-react';
import { formatTime } from '@/lib/format';
import type { TimetablePeriod } from '@/types/curriculum';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import type { UseQueryResult } from '@tanstack/react-query';

export function PeriodsPanel({
  periods,
  onEdit,
  onDelete,
}: {
  periods: UseQueryResult<TimetablePeriod[]>;
  onEdit: (period: TimetablePeriod) => void;
  onDelete: (period: TimetablePeriod) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The school day</CardTitle>
        <CardDescription>
          Period names and times, in order. This is the grid the timetable is built on — a class
          or teacher can only be scheduled into a period defined here.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {periods.isPending ? (
          <LoadingState label="Loading periods…" />
        ) : (periods.data?.length ?? 0) === 0 ? (
          <EmptyState
            compact
            icon={<Clock />}
            title="No periods defined"
            description="Add the first period below — the timetable has nowhere to place a lesson until the school day is laid out."
          />
        ) : (
          <ol className="divide-y divide-border">
            {periods.data?.map((period) => (
              <li key={period.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                  {period.sequence}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{period.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatTime(period.startTime)} – {formatTime(period.endTime)}
                  </p>
                </div>
                {period.isBreak && <Badge tone="warning">Break</Badge>}
                <Button
                  data-cy="settings-academics-settings-edit-2"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(period)}
                >
                  Edit
                </Button>
                <Button
                  data-cy="settings-academics-settings-delete-2"
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => onDelete(period)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
