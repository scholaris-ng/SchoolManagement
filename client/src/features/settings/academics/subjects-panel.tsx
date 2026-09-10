import { GraduationCap } from 'lucide-react';
import type { Subject } from '@/types/academics';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import type { UseQueryResult } from '@tanstack/react-query';

export function SubjectsPanel({
  subjects,
  onEdit,
}: {
  subjects: UseQueryResult<Subject[]>;
  onEdit: (subject: Subject) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subjects</CardTitle>
        <CardDescription>
          Which levels take each subject decides where it appears on report cards.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {subjects.isPending ? (
          <LoadingState label="Loading subjects…" />
        ) : (subjects.data?.length ?? 0) === 0 ? (
          <EmptyState compact icon={<GraduationCap />} title="No subjects defined" />
        ) : (
          <ul className="divide-y divide-border">
            {subjects.data?.map((subject) => (
              <li key={subject.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {subject.name}
                    <span className="font-normal text-muted-foreground"> · {subject.code}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subject.levelNames.join(', ') || 'No levels assigned'}
                    {subject.schedule.length > 0 &&
                      ` · ${subject.schedule.length} period${subject.schedule.length === 1 ? '' : 's'}/week`}
                  </p>
                </div>
                {subject.isCore && <Badge tone="primary">Core</Badge>}
                {!subject.isActive && <Badge tone="warning">Inactive</Badge>}
                <Button
                  data-cy="settings-academics-settings-edit-5"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(subject)}
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
