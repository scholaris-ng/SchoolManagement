import { Badge } from '@/components/ui/primitives';
import { Users } from 'lucide-react';
import type { SchoolClass } from '@/types/academics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import type { UseQueryResult } from '@tanstack/react-query';

export function ClassesPanel({
  classes,
  onEdit,
}: {
  classes: UseQueryResult<SchoolClass[]>;
  onEdit: (schoolClass: SchoolClass) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Classes</CardTitle>
        <CardDescription>
          Each class belongs to a level and has form teachers who take its register.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {classes.isPending ? (
          <LoadingState label="Loading classes…" />
        ) : (classes.data?.length ?? 0) === 0 ? (
          <EmptyState compact icon={<Users />} title="No classes defined" />
        ) : (
          <ul className="divide-y divide-border">
            {classes.data?.map((schoolClass) => (
              <li key={schoolClass.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{schoolClass.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {schoolClass.levelName} ·{' '}
                    {schoolClass.formTeacherNames.length > 0
                      ? schoolClass.formTeacherNames.join(', ')
                      : 'No form teacher'}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {schoolClass.enrolledCount} / {schoolClass.capacity}
                </span>
                {!schoolClass.isActive && <Badge tone="warning">Inactive</Badge>}
                <Button
                  data-cy="settings-academics-settings-edit-4"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(schoolClass)}
                >
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
