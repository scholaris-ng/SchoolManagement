import { Link } from 'react-router-dom';
import { ArrowUpRight, Target } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useLevels, useSubjects } from '@/features/academics/api';
import { useCurricula } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { FilterBar } from '@/components/data/filter-bar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';

/**
 * Every curriculum the school has defined, one card each.
 *
 * The number that matters is coverage — how much of the syllabus has actually
 * been taught — so it is on the card rather than two clicks away.
 */
export function CurriculumListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const subjectId = searchParams.get('subjectId') ?? undefined;
  const levelId = searchParams.get('levelId') ?? undefined;

  const curricula = useCurricula({ subjectId, levelId });
  const subjects = useSubjects();
  const levels = useLevels();

  const setFilter = (key: string, value: string | undefined) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Curriculum"
        description="Subjects broken down into topics and the individual objectives a child is expected to master."
        breadcrumbs={[{ label: 'Teaching' }, { label: 'Curriculum' }]}
      />

      <FilterBar
        values={{ subjectId, levelId }}
        onFilterChange={setFilter}
        onReset={subjectId || levelId ? () => setSearchParams({}, { replace: true }) : undefined}
        filters={[
          {
            key: 'subjectId',
            label: 'Subject',
            options: (subjects.data ?? []).map((subject) => ({
              value: subject.id,
              label: subject.name,
            })),
          },
          {
            key: 'levelId',
            label: 'Level',
            options: (levels.data ?? []).map((level) => ({ value: level.id, label: level.name })),
          },
        ]}
      />

      {curricula.isPending ? (
        <LoadingState label="Loading curricula…" />
      ) : curricula.isError ? (
        <ErrorState error={curricula.error} onRetry={() => void curricula.refetch()} />
      ) : (curricula.data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Target />}
            title="No curriculum defined yet"
            description="A curriculum links a subject and a level to the topics and objectives it covers. It is what makes coverage reporting and scheme generation possible."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {curricula.data?.map((curriculum) => {
            // Coverage is reported per class; the card shows the shape of the
            // curriculum itself, and the detail page resolves it per class.
            const objectiveDensity =
              curriculum.topicCount === 0
                ? 0
                : curriculum.objectiveCount / curriculum.topicCount;
            return (
              <Card key={curriculum.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="truncate">{curriculum.subjectName}</CardTitle>
                  <CardDescription>
                    {curriculum.levelName}
                    {curriculum.name !== curriculum.subjectName ? ` · ${curriculum.name}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  {curriculum.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {curriculum.description}
                    </p>
                  )}

                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md border border-border p-2">
                      <dt className="text-xs text-muted-foreground">Topics</dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {curriculum.topicCount}
                      </dd>
                    </div>
                    <div className="rounded-md border border-border p-2">
                      <dt className="text-xs text-muted-foreground">Objectives</dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {curriculum.objectiveCount}
                      </dd>
                    </div>
                  </dl>

                  <p className="text-xs text-muted-foreground">
                    About {objectiveDensity.toFixed(1)} objectives per topic
                  </p>

                  <div className="mt-auto pt-2">
                    <Button variant="outline" block asChild>
                      <Link to={`/curriculum/${curriculum.id}`}>
                        Open curriculum
                        <ArrowUpRight />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
