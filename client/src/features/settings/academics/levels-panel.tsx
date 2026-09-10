import { Layers } from 'lucide-react';
import type { SchoolLevel } from '@/types/academics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import type { UseQueryResult } from '@tanstack/react-query';

export function LevelsPanel({
  levels,
  onEdit,
}: {
  levels: UseQueryResult<SchoolLevel[]>;
  onEdit: (level: SchoolLevel) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>School levels</CardTitle>
        <CardDescription>
          Your own ladder — Creche to SS3, Reception to Year 11, or whatever your school uses.
          Order decides how promotion works.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {levels.isPending ? (
          <LoadingState label="Loading levels…" />
        ) : (levels.data?.length ?? 0) === 0 ? (
          <EmptyState
            compact
            icon={<Layers />}
            title="No levels defined"
            description="Start here — classes, subjects and grading all hang off levels."
          />
        ) : (
          <ol className="divide-y divide-border">
            {levels.data?.map((level) => (
              <li key={level.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                  {level.sequence}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{level.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {level.code} · {level.classCount}{' '}
                    {level.classCount === 1 ? 'class' : 'classes'}
                    {level.gradingSchemeName ? ` · ${level.gradingSchemeName}` : ''}
                  </p>
                </div>
                <Button
                  data-cy="settings-academics-settings-edit-3"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(level)}
                >
                  Edit
                </Button>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
