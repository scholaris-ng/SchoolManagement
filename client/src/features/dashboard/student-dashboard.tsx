import { Link } from 'react-router-dom';
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
import { BookOpen, CalendarClock, ClipboardCheck, Megaphone, ScrollText, Trophy } from 'lucide-react';
import { formatDate, formatDateTime, formatPercent, formatTime, ordinal } from '@/lib/format';
import { useStudentDashboard } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { chartTheme } from '@/components/charts/chart-theme';

export function StudentDashboard() {
  const dashboard = useStudentDashboard();
  const data = dashboard.data;

  if (dashboard.isError) {
    return (
      <PageContainer>
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </PageContainer>
    );
  }

  const firstName = data?.fullName?.split(' ')[0] ?? 'there';

  return (
    <PageContainer>
      <PageHeader
        title={`Hello, ${firstName}`}
        description={data?.className ? `${data.className} · today's lessons and your progress.` : undefined}
        actions={
          <Button variant="outline" asChild>
            <Link to="/cbt">
              <BookOpen />
              Practice &amp; tests
            </Link>
          </Button>
        }
      />

      {dashboard.isPending ? (
        <LoadingState label="Loading your dashboard…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Attendance"
              value={formatPercent(data?.attendanceRate ?? 0)}
              icon={<ClipboardCheck />}
              tone={(data?.attendanceRate ?? 0) >= 90 ? 'success' : 'warning'}
            />
            <StatCard
              label="Term average"
              value={
                data?.currentTermAverage !== null && data?.currentTermAverage !== undefined
                  ? formatPercent(data.currentTermAverage)
                  : 'Not published'
              }
              icon={<ScrollText />}
            />
            <StatCard
              label="Position in class"
              value={
                data?.position && data?.classSize
                  ? `${ordinal(data.position)} of ${data.classSize}`
                  : '—'
              }
              icon={<Trophy />}
            />
            <StatCard
              label="House points"
              value={data?.housePoints ?? 0}
              hint={data?.houseName ?? undefined}
              icon={<Trophy />}
              to="/houses"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Today&rsquo;s timetable</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(data?.todayTimetable.length ?? 0) === 0 ? (
                  <EmptyState compact icon={<CalendarClock />} title="No lessons today" />
                ) : (
                  <ul className="divide-y divide-border">
                    {data?.todayTimetable.map((lesson) => (
                      <li key={lesson.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                        <span className="w-16 shrink-0 tabular-nums text-muted-foreground">
                          {formatTime(lesson.startTime)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{lesson.subjectName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {lesson.teacherName}
                            {lesson.roomName ? ` · ${lesson.roomName}` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>How you are doing by subject</CardTitle>
                <CardDescription>Your score next to the class average.</CardDescription>
              </CardHeader>
              <CardContent>
                {(data?.subjectPerformance.length ?? 0) === 0 ? (
                  <EmptyState
                    compact
                    icon={<ScrollText />}
                    title="No results published yet"
                    description="Your scores appear here once your teachers publish them."
                  />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data?.subjectPerformance}
                        margin={{ top: 4, right: 8, left: -20, bottom: 4 }}
                      >
                        <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                        <XAxis
                          dataKey="subjectName"
                          interval={0}
                          angle={-30}
                          textAnchor="end"
                          height={64}
                          {...chartTheme.axis}
                        />
                        <YAxis domain={[0, 100]} {...chartTheme.axis} />
                        <ChartTooltip {...chartTheme.tooltip} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="score"
                          name="You"
                          fill={chartTheme.colors[0]}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                        <Bar
                          dataKey="classAverage"
                          name="Class average"
                          fill={chartTheme.colors[1]}
                          fillOpacity={0.45}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Open tests and practice</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(data?.openAssessments.length ?? 0) === 0 ? (
                  <EmptyState compact icon={<BookOpen />} title="Nothing open right now" />
                ) : (
                  <ul className="divide-y divide-border">
                    {data?.openAssessments.map((assessment) => (
                      <li
                        key={assessment.id}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{assessment.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {assessment.subjectName}
                            {assessment.endsAt ? ` · closes ${formatDateTime(assessment.endsAt)}` : ''}
                          </p>
                        </div>
                        <Button size="sm" asChild>
                          <Link to={`/cbt/${assessment.id}`}>Start</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Announcements</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(data?.announcements.length ?? 0) === 0 ? (
                  <EmptyState compact icon={<Megaphone />} title="No announcements" />
                ) : (
                  <ul className="divide-y divide-border">
                    {data?.announcements.map((announcement) => (
                      <li key={announcement.id} className="px-5 py-2.5 text-sm">
                        <p className="truncate font-medium">{announcement.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(announcement.publishAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}
