import { useState } from 'react';
import { Award, Plus, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime, ordinal } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useAuth } from '@/app/providers/auth-provider';
import { useStudentSearch } from '@/features/students/api';
import { useAwardHousePoints, useHouseLeaderboard, useHousePoints } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, SearchInput, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState, LoadingState } from '@/components/ui/feedback';

const REASONS = [
  'ACADEMIC',
  'BEHAVIOUR',
  'READING',
  'SPORTS',
  'PUNCTUALITY',
  'SERVICE',
  'PENALTY',
  'OTHER',
];

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
            <Button onClick={() => setAwardOpen(true)}>
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

function AwardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const award = useAwardHousePoints();
  const [query, setQuery] = useState('');
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const results = useStudentSearch(query, { enabled: query.length >= 2 });

  const [points, setPoints] = useState('5');
  const [reason, setReason] = useState('ACADEMIC');
  const [note, setNote] = useState('');

  const valid = Boolean(student) && Number(points) !== 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Award house points</DialogTitle>
          <DialogDescription>
            Points count for the student and their house together. Use a negative number to deduct.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="award-student" required>
              Student
            </Label>
            {student ? (
              <div className="flex items-center gap-3 rounded-md border border-border p-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{student.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setStudent(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <SearchInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search by name or admission number…"
                />
                {results.data && results.data.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
                    {results.data.map((match) => (
                      <li key={match.id}>
                        <button
                          type="button"
                          onClick={() => setStudent({ id: match.id, name: match.fullName })}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          {match.fullName}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {match.admissionNo}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="award-points" required>
                Points
              </Label>
              <Input
                id="award-points"
                type="number"
                value={points}
                onChange={(event) => setPoints(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="award-reason">Reason</Label>
              <NativeSelect
                id="award-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                {REASONS.map((option) => (
                  <option key={option} value={option}>
                    {humanizeEnum(option)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="award-note">Note</Label>
            <Textarea
              id="award-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What earned this?"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={award.isPending}
            disabled={!valid}
            onClick={() =>
              student &&
              void award
                .mutateAsync({
                  studentId: student.id,
                  points: Number(points),
                  reason,
                  note: note.trim() || undefined,
                })
                .then(() => {
                  onOpenChange(false);
                  setStudent(null);
                  setNote('');
                })
            }
          >
            Award
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
