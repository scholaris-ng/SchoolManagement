import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  ClipboardCheck,
  Coins,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react';
import { formatCurrency, formatDate, formatPercent, formatRelative } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
import { useAdminDashboard } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/feedback';
import { chartTheme } from '@/components/charts/chart-theme';

export function AdminDashboard() {
  const { user, membership } = useAuth();
  const dashboard = useAdminDashboard();
  const data = dashboard.data;

  const currency = data?.currency ?? 'NGN';
  const firstName = user?.displayName?.split(' ')[0] ?? 'there';

  const header = (
    <PageHeader
      title={`Good day, ${firstName}`}
      description={`How ${membership?.schoolShortName ?? 'the school'} is running today.`}
      actions={
        <Button data-cy="admin-dashboard-view-full-analytics" variant="outline" asChild>
          <Link to="/analytics">View full analytics</Link>
        </Button>
      }
    />
  );

  if (dashboard.isError) {
    return (
      <PageContainer>
        {header}
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </PageContainer>
    );
  }

  const registerProgress =
    data && data.totalClasses > 0 ? (data.attendanceMarkedClasses / data.totalClasses) * 100 : 0;

  return (
    <PageContainer>
      {header}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Students enrolled"
          value={data?.studentCount ?? 0}
          icon={<Users />}
          loading={dashboard.isPending}
          delta={data?.studentDelta}
          to="/students"
        />
        <StatCard
          label="Attendance today"
          value={data ? formatPercent(data.attendanceRateToday) : '—'}
          hint={
            data ? `${data.attendanceMarkedClasses} of ${data.totalClasses} registers taken` : undefined
          }
          icon={<ClipboardCheck />}
          tone={data && data.attendanceRateToday < 85 ? 'warning' : 'success'}
          loading={dashboard.isPending}
          to="/attendance"
        />
        <StatCard
          label="Fees collected"
          value={data ? formatCurrency(data.feesCollected, currency) : '—'}
          hint={data ? `${formatPercent(data.collectionRate)} of everything billed` : undefined}
          icon={<Coins />}
          loading={dashboard.isPending}
          to="/finance"
        />
        <StatCard
          label="Outstanding fees"
          value={data ? formatCurrency(data.feesOutstanding, currency) : '—'}
          icon={<Wallet />}
          tone={data && data.feesOutstanding > 0 ? 'warning' : 'neutral'}
          loading={dashboard.isPending}
          to="/finance/debtors"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attendance over the last fortnight</CardTitle>
            <CardDescription>
              Daily attendance rate across the whole school. A sustained dip is usually a fee or
              transport problem before it is an academic one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.isPending ? (
              <CardSkeleton className="h-64 border-0 p-0" />
            ) : (data?.attendanceTrend.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={<ClipboardCheck />}
                title="No attendance recorded yet"
                description="Registers taken by teachers will appear here."
              />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data?.attendanceTrend}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartTheme.colors[0]} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={chartTheme.colors[0]} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="label" {...chartTheme.axis} />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value: number) => `${value}%`}
                      {...chartTheme.axis}
                    />
                    <ChartTooltip
                      {...chartTheme.tooltip}
                      formatter={(value: number) => [`${value}%`, 'Attendance']}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke={chartTheme.colors[0]}
                      strokeWidth={2}
                      fill="url(#attendanceFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today at a glance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Registers taken</span>
                <span className="font-medium tabular-nums">
                  {data?.attendanceMarkedClasses ?? 0} / {data?.totalClasses ?? 0}
                </span>
              </div>
              <Progress
                className="mt-1.5"
                value={registerProgress}
                tone={registerProgress > 90 ? 'success' : registerProgress > 60 ? 'warning' : 'danger'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                icon={<BadgeCheck />}
                label="Applications open"
                value={data?.admissionsInProgress ?? 0}
                to="/admissions"
              />
              <MiniStat
                icon={<BadgeCheck />}
                label="Offers accepted"
                value={data?.admissionsAccepted ?? 0}
                to="/admissions"
              />
              <MiniStat
                icon={<Coins />}
                label="Billed"
                value={formatCurrency(data?.feesBilled ?? 0, currency, { compact: true })}
                to="/finance"
              />
              <MiniStat
                icon={<TriangleAlert />}
                label="At-risk families"
                value={data?.atRiskCount ?? 0}
                to="/analytics/retention"
                tone={(data?.atRiskCount ?? 0) > 0 ? 'danger' : 'neutral'}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Enrolment by level</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.enrolmentByLevel.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Users />} title="No classes configured yet" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data?.enrolmentByLevel}
                    margin={{ top: 4, right: 8, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="levelName" {...chartTheme.axis} />
                    <YAxis allowDecimals={false} {...chartTheme.axis} />
                    <ChartTooltip {...chartTheme.tooltip} />
                    <Bar
                      dataKey="students"
                      name="Students"
                      fill={chartTheme.colors[0]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Sensitive changes, as recorded in the audit trail.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.recentActivity.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Activity />} title="Nothing recorded yet" />
            ) : (
              <ul className="divide-y divide-border">
                {data?.recentActivity.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="px-5 py-2.5 text-sm">
                    <p className="truncate">
                      <span className="font-medium">{entry.actorName}</span>{' '}
                      <span className="text-muted-foreground">{entry.action}</span>{' '}
                      <span className="truncate">{entry.entityLabel}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelative(entry.occurredAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.upcomingEvents.length ?? 0) === 0 ? (
              <EmptyState compact icon={<CalendarDays />} title="Nothing scheduled" />
            ) : (
              <ul className="divide-y divide-border">
                {data?.upcomingEvents.slice(0, 6).map((event) => (
                  <li key={event.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <CalendarDays
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(event.startDate)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function MiniStat({
  icon,
  label,
  value,
  to,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  to: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <Link
      to={to}
      className="rounded-md border border-border p-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <p
        className={`mt-0.5 text-lg font-semibold tabular-nums ${
          tone === 'danger' ? 'text-danger' : ''
        }`}
      >
        {value}
      </p>
    </Link>
  );
}
