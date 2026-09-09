import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { groupBy } from '@/lib/utils';
import { useTerms } from '@/features/academics/api';
import { useStudentBehaviour } from '../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from '@/components/ui/primitives';
import { NativeSelect } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { chartTheme } from '@/components/charts/chart-theme';

/**
 * Behaviour built from continuous observations rather than a single end-of-term
 * sitting (research feature 23), so the termly rating reflects what actually
 * happened across the weeks.
 */
export function StudentBehaviourTab({ studentId }: { studentId: string }) {
  const terms = useTerms();
  const [termId, setTermId] = useState('');
  const effectiveTermId = termId || terms.data?.find((term) => term.isCurrent)?.id || '';
  const behaviour = useStudentBehaviour(studentId, effectiveTermId || undefined);

  if (behaviour.isPending) return <LoadingState label="Loading behaviour records…" />;
  if (behaviour.isError) {
    return <ErrorState error={behaviour.error} onRetry={() => void behaviour.refetch()} />;
  }

  const ratings = behaviour.data ?? [];

  if (ratings.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Sparkles />}
          title="No behaviour records this term"
          description="Teachers record observations as the term goes on; they are summarised here and on the report card."
        />
      </Card>
    );
  }

  const byCategory = groupBy(ratings, (rating) => rating.category);
  const radarData = ratings.map((rating) => ({
    trait: rating.traitName,
    rating: rating.averageRating,
    max: rating.scaleMax,
  }));

  // Merge each trait's observation history into one series per date so the
  // trend chart shows the term as it unfolded.
  const trendDates = Array.from(
    new Set(ratings.flatMap((rating) => rating.trend.map((point) => point.date))),
  ).sort();
  const trendData = trendDates.map((date) => {
    const row: Record<string, string | number> = { date: formatDate(date, 'd MMM') };
    for (const rating of ratings.slice(0, 4)) {
      const point = rating.trend.find((entry) => entry.date === date);
      if (point) row[rating.traitName] = point.rating;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <NativeSelect
          data-cy="tabs-behaviour-effective-term-id"
          value={effectiveTermId}
          onChange={(event) => setTermId(event.target.value)}
          aria-label="Term"
          className="w-auto min-w-[12rem]"
        >
          {(terms.data ?? []).map((term) => (
            <option key={term.id} value={term.id}>
              {term.sessionName} · {term.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Behaviour profile</CardTitle>
            <CardDescription>Average of every observation recorded this term.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke={chartTheme.grid} />
                  <PolarAngleAxis dataKey="trait" tick={{ fontSize: 11 }} />
                  <Radar
                    dataKey="rating"
                    stroke={chartTheme.colors[0]}
                    fill={chartTheme.colors[0]}
                    fillOpacity={0.25}
                    name="Rating"
                  />
                  <ChartTooltip {...chartTheme.tooltip} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ratings by trait</CardTitle>
            <CardDescription>
              Based on {ratings.reduce((total, rating) => total + rating.observationCount, 0)}{' '}
              observations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {Object.entries(byCategory).map(([category, items]) => (
              <div key={category} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </p>
                {items.map((rating) => (
                  <div key={rating.traitId} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate">{rating.traitName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {rating.label} ({rating.averageRating.toFixed(1)}/{rating.scaleMax})
                      </span>
                    </div>
                    <Progress
                      value={rating.averageRating}
                      max={rating.scaleMax}
                      tone={
                        rating.averageRating / rating.scaleMax >= 0.7
                          ? 'success'
                          : rating.averageRating / rating.scaleMax >= 0.45
                            ? 'warning'
                            : 'danger'
                      }
                    />
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {trendData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>How ratings moved through the term</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                  <XAxis dataKey="date" {...chartTheme.axis} />
                  <YAxis domain={[0, ratings[0]?.scaleMax ?? 5]} {...chartTheme.axis} />
                  <ChartTooltip {...chartTheme.tooltip} />
                  {ratings.slice(0, 4).map((rating, index) => (
                    <Line
                      key={rating.traitId}
                      type="monotone"
                      dataKey={rating.traitName}
                      stroke={chartTheme.colors[index % chartTheme.colors.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
