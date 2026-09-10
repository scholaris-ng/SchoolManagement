import { useState } from 'react';
import { Award, Plus, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime, ordinal } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { useHouseLeaderboard, useHousePoints } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/feedback';
import { AwardDialog } from './houses-page-parts';



/**
 * Houses and points.
 *
 * A point earned by a child counts for them and for their house at the same
 * time, which is what makes the system work: individual recognition that also
 * builds a team (spec section 25).
 */
export function HousesPage() {
  const { can } = useAuth();
  const leaderboard = useHouseLeaderboard();
  const list = useListQuery({ defaultPageSize: 20 });
  const awards = useHousePoints(list.query);
  const [awardOpen, setAwardOpen] = useState(false);

  const topPoints = leaderboard.data?.houses[0]?.points ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Houses"
        description="House standings and the points behind them."
        breadcrumbs={[{ label: 'Behaviour & safety' }, { label: 'Houses' }]}
        actions={
          can('house.manage') && (
            <Button data-cy="behaviour-houses-award-points" onClick={() => setAwardOpen(true)}>
              <Plus />
              Award points
            </Button>
          )
        }
      />

      {leaderboard.isPending ? (
        <LoadingState label="Loading standings…" />
      ) : (leaderboard.data?.houses.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Trophy />}
            title="No houses defined yet"
            description="Set up houses under Academic setup, then assign students to them."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {leaderboard.data?.houses.map((house) => (
            <Card key={house.houseId} className="overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: house.color }} aria-hidden="true" />
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold">{house.houseName}</p>
                  <Badge tone={house.rank === 1 ? 'success' : 'neutral'}>
                    {ordinal(house.rank)}
                  </Badge>
                </div>
                <p className="text-2xl font-bold tabular-nums">{house.points}</p>
                <Progress
                  value={topPoints === 0 ? 0 : (house.points / topPoints) * 100}
                  tone={house.rank === 1 ? 'success' : 'primary'}
                />
                <p className="text-xs text-muted-foreground">
                  {house.memberCount} students · {house.averagePerStudent} per student
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top students</CardTitle>
            <CardDescription>Points earned this term.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(leaderboard.data?.students.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Award />} title="No points awarded yet" />
            ) : (
              <ol className="divide-y divide-border">
                {leaderboard.data?.students.map((student) => (
                  <li
                    key={student.studentId}
                    className="flex items-center gap-3 px-5 py-2.5 text-sm"
                  >
                    <span
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
                        student.rank <= 3
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {student.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{student.studentName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {student.className ?? '—'}
                        {student.houseName ? ` · ${student.houseName}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{student.points}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent awards</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {awards.isPending ? (
              <LoadingState label="Loading…" />
            ) : (awards.data?.items.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Award />} title="Nothing awarded yet" />
            ) : (
              <ul className="divide-y divide-border">
                {awards.data?.items.map((award) => (
                  <li key={award.id} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: award.houseColor }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{award.studentName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {humanizeEnum(award.reason)} · {award.awardedByName} ·{' '}
                        {formatDateTime(award.awardedAt)}
                      </p>
                      {award.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{award.note}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'shrink-0 font-semibold tabular-nums',
                        award.points < 0 ? 'text-danger' : 'text-success',
                      )}
                    >
                      {award.points > 0 ? '+' : ''}
                      {award.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AwardDialog open={awardOpen} onOpenChange={setAwardOpen} />
    </PageContainer>
  );
}
