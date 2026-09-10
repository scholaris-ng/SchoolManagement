import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BadgeCheck,
} from 'lucide-react';
import { formatNumber, formatPercent } from '@/lib/format';
import { useAdmissionFunnel } from '@/features/admissions/api';
import { StatCard } from '@/components/data/stat-card';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '@/components/ui/primitives';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { chartTheme } from '@/components/charts/chart-theme';

export function AdmissionsPanel() {
  const funnel = useAdmissionFunnel();
  const data = funnel.data;

  if (funnel.isError) {
    return <ErrorState error={funnel.error} onRetry={() => void funnel.refetch()} />;
  }

  const stages = data
    ? [
        { label: 'Received', value: data.received },
        { label: 'Screened', value: data.screened },
        { label: 'Shortlisted', value: data.shortlisted },
        { label: 'Offered', value: data.offered },
        { label: 'Accepted', value: data.accepted },
      ]
    : [];

  return (
    <div className="space-y-6 pt-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Applications"
          value={data?.received ?? 0}
          to="/admissions"
          icon={<BadgeCheck />}
          loading={funnel.isPending}
        />
        <StatCard
          label="Offers made"
          value={data?.offered ?? 0}
          icon={<BadgeCheck />}
          loading={funnel.isPending}
        />
        <StatCard
          label="Accepted"
          value={data?.accepted ?? 0}
          tone="success"
          icon={<BadgeCheck />}
          loading={funnel.isPending}
        />
        <StatCard
          label="Conversion rate"
          value={formatPercent(data?.conversionRate ?? 0)}
          hint="Offers that turned into enrolments"
          icon={<Activity />}
          loading={funnel.isPending}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Admissions funnel</CardTitle>
            <CardDescription>{data?.sessionName ?? 'Current session'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.isPending ? (
              <LoadingState label="Loading admissions…" />
            ) : stages.length === 0 || stages[0].value === 0 ? (
              <EmptyState compact icon={<BadgeCheck />} title="No applications received yet" />
            ) : (
              stages.map((stage) => (
                <div key={stage.label} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{stage.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatNumber(stage.value)}
                    </span>
                  </div>
                  <Progress
                    value={stages[0].value ? (stage.value / stages[0].value) * 100 : 0}
                    tone="primary"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Applications by level</CardTitle>
            <CardDescription>Where demand is, and where offers convert.</CardDescription>
          </CardHeader>
          <CardContent>
            {funnel.isPending ? (
              <LoadingState label="Loading levels…" />
            ) : (data?.byLevel.length ?? 0) === 0 ? (
              <EmptyState compact icon={<BadgeCheck />} title="No applications by level yet" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.byLevel} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="levelName" {...chartTheme.axis} />
                    <YAxis allowDecimals={false} {...chartTheme.axis} />
                    <ChartTooltip {...chartTheme.tooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="applications"
                      name="Applications"
                      fill={chartTheme.colors[0]}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="accepted"
                      name="Accepted"
                      fill={chartTheme.colors[2]}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                       */
/* -------------------------------------------------------------------------- */
