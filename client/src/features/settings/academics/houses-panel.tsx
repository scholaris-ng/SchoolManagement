import { Trophy } from 'lucide-react';
import type { House } from '@/types/academics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import type { UseQueryResult } from '@tanstack/react-query';

export function HousesPanel({
  houses,
  onEdit,
}: {
  houses: UseQueryResult<House[]>;
  onEdit: (house: House) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Houses</CardTitle>
        <CardDescription>House points and leaderboards are built from these.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {houses.isPending ? (
          <LoadingState label="Loading houses…" />
        ) : (houses.data?.length ?? 0) === 0 ? (
          <EmptyState compact icon={<Trophy />} title="No houses defined" />
        ) : (
          <ul className="divide-y divide-border">
            {houses.data?.map((house) => (
              <li key={house.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span
                  className="size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: house.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{house.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {house.memberCount} students · {house.points} points
                    {house.captainName ? ` · captain ${house.captainName}` : ''}
                  </p>
                </div>
                <Button
                  data-cy="settings-academics-settings-edit-6"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(house)}
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
