import { GraduationCap } from 'lucide-react';
import type { Subject } from '@/types/academics';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import type { UseQueryResult } from '@tanstack/react-query';

export function SubjectsPanel({
  subjects,
  onEdit,
  onDelete,
  selectedIds,
  onSelectionChange,
}: {
  subjects: UseQueryResult<Subject[]>;
  onEdit: (subject: Subject) => void;
  onDelete: (subject: Subject) => void;
  /** Present together — bulk delete is a settings-page concern, this panel only renders it. */
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  const rows = subjects.data ?? [];
  const allSelected = rows.length > 0 && rows.every((subject) => selectedIds.includes(subject.id));
  const someSelected = rows.some((subject) => selectedIds.includes(subject.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      const rowIds = rows.map((subject) => subject.id);
      onSelectionChange(selectedIds.filter((id) => !rowIds.includes(id)));
    } else {
      onSelectionChange(Array.from(new Set([...selectedIds, ...rows.map((subject) => subject.id)])));
    }
  };

  const toggleOne = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id],
    );
  };

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
        ) : rows.length === 0 ? (
          <EmptyState compact icon={<GraduationCap />} title="No subjects defined" />
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-5 py-2.5">
              <Checkbox
                data-cy="settings-academics-subjects-select-all"
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Select all subjects"
              />
              <span className="text-xs text-muted-foreground">Select all</span>
            </div>
            <ul className="scrollbar-thin max-h-[28rem] divide-y divide-border overflow-y-auto">
              {rows.map((subject) => (
                <li key={subject.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Checkbox
                    data-cy={`settings-academics-subjects-select-${subject.id}`}
                    checked={selectedIds.includes(subject.id)}
                    onCheckedChange={() => toggleOne(subject.id)}
                    aria-label={`Select ${subject.name}`}
                  />
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
                    <p className="truncate text-xs text-muted-foreground">
                      {subject.teacherNames.length > 0
                        ? subject.teacherNames.join(', ')
                        : 'No teacher assigned yet'}
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
                  <Button
                    data-cy="settings-academics-settings-delete-subject"
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:text-danger"
                    onClick={() => onDelete(subject)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
