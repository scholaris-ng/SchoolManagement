import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  NotebookPen,
  Table2,
  Target,
} from 'lucide-react';
import { formatDate, formatDateTime, formatPercent, formatTime } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
import { useTeacherDashboard } from './api';
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
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/data/status-badge';

/**
 * A teacher's dashboard is a to-do list, not a report.
 *
 * Everything here is something they owe the school today: a register not yet
 * taken, a score sheet half entered, a lesson note due. Each row links straight
 * into the screen that clears it.
 */
export function TeacherDashboard() {
  const { user } = useAuth();
  const dashboard = useTeacherDashboard();
  const data = dashboard.data;

  const firstName = user?.displayName?.split(' ')[0] ?? 'there';

  if (dashboard.isError) {
    return (
      <PageContainer>
        <PageHeader
          title={`Good day, ${firstName}`}
          actions={
            <Button data-cy="teacher-dashboard-take-attendance" asChild>
              <Link to="/attendance">
                <ClipboardCheck />
                Take attendance
              </Link>
            </Button>
          }
        />
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </PageContainer>
    );
  }

  const outstanding =
    (data?.pendingAttendance.length ?? 0) +
    (data?.pendingScoreEntry.length ?? 0) +
    (data?.lessonNotesDue.length ?? 0);

  return (
    <PageContainer>
      <PageHeader
        title={`Good day, ${firstName}`}
        description={
          outstanding === 0
            ? 'You are all caught up. Nothing is waiting on you.'
            : `${outstanding} ${outstanding === 1 ? 'task is' : 'tasks are'} waiting on you.`
        }
        actions={
          <Button data-cy="teacher-dashboard-take-attendance" asChild>
            <Link to="/attendance">
              <ClipboardCheck />
              Take attendance
            </Link>
          </Button>
        }
      />

      {dashboard.isPending ? (
        <LoadingState label="Loading your day…" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Today&rsquo;s lessons</CardTitle>
                <CardDescription>
                  Your timetable for today, with the register status of each class.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {(data?.todayClasses.length ?? 0) === 0 ? (
                  <EmptyState
                    compact
                    icon={<CalendarClock />}
                    title="No lessons scheduled today"
                    description="Enjoy the quiet — or use the time to catch up on lesson notes."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {data?.todayClasses.map((lesson) => (
                      <li key={lesson.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">
                          {formatTime(lesson.startTime)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {lesson.subjectName}
                            <span className="font-normal text-muted-foreground">
                              {' '}
                              · {lesson.className}
                            </span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatTime(lesson.startTime)}–{formatTime(lesson.endTime)}
                            {lesson.roomName ? ` · ${lesson.roomName}` : ''}
                          </p>
                        </div>
                        {lesson.attendanceTaken ? (
                          <Badge tone="success">
                            <CheckCircle2 />
                            Register taken
                          </Badge>
                        ) : (
                          <Button data-cy="teacher-dashboard-take-register" size="sm" variant="outline" asChild>
                            <Link to={`/attendance?classId=${lesson.id}`}>Take register</Link>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Curriculum coverage</CardTitle>
                <CardDescription>
                  How much of each syllabus you have taught this term.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.curriculumCoverage.length ?? 0) === 0 ? (
                  <EmptyState compact icon={<Target />} title="No curriculum linked yet" />
                ) : (
                  data?.curriculumCoverage.map((row) => (
                    <div key={`${row.subjectName}-${row.className}`}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate">
                          {row.subjectName}
                          <span className="text-muted-foreground"> · {row.className}</span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatPercent(row.coverageRate, 0)}
                        </span>
                      </div>
                      <Progress
                        className="mt-1"
                        value={row.coverageRate}
                        tone={
                          row.coverageRate >= 75
                            ? 'success'
                            : row.coverageRate >= 45
                              ? 'warning'
                              : 'danger'
                        }
                      />
                    </div>
                  ))
                )}
                <Button data-cy="teacher-dashboard-open-curriculum" variant="outline" size="sm" block asChild>
                  <Link to="/curriculum">Open curriculum</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Registers to take</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(data?.pendingAttendance.length ?? 0) === 0 ? (
                  <EmptyState compact icon={<CheckCircle2 />} title="All registers are up to date" />
                ) : (
                  <ul className="divide-y divide-border">
                    {data?.pendingAttendance.map((task) => (
                      <li
                        key={`${task.classId}-${task.date}`}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{task.className}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(task.date)}</p>
                        </div>
                        <Button data-cy="teacher-dashboard-take" size="sm" variant="ghost" asChild>
                          <Link to={`/attendance?classId=${task.classId}&date=${task.date}`}>
                            Take
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Scores to enter</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(data?.pendingScoreEntry.length ?? 0) === 0 ? (
                  <EmptyState compact icon={<Table2 />} title="No score sheets waiting" />
                ) : (
                  <ul className="divide-y divide-border">
                    {data?.pendingScoreEntry.map((sheet) => (
                      <li key={sheet.scoreSheetId} className="px-5 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {sheet.subjectName}
                              <span className="font-normal text-muted-foreground">
                                {' '}
                                · {sheet.className}
                              </span>
                            </p>
                            <p className="text-xs tabular-nums text-muted-foreground">
                              {sheet.enteredCount} of {sheet.totalCount} entered
                            </p>
                          </div>
                          <StatusBadge status={sheet.status} />
                        </div>
                        <Progress
                          className="mt-1.5"
                          value={sheet.totalCount === 0 ? 0 : (sheet.enteredCount / sheet.totalCount) * 100}
                        />
                        <Button data-cy="teacher-dashboard-continue-entry" size="sm" variant="ghost" className="mt-1 h-7 px-0" asChild>
                          <Link to={`/results/entry/${sheet.scoreSheetId}`}>Continue entry</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Lesson notes due</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {(data?.lessonNotesDue.length ?? 0) === 0 ? (
                    <EmptyState compact icon={<NotebookPen />} title="Nothing due" />
                  ) : (
                    <ul className="divide-y divide-border">
                      {data?.lessonNotesDue.map((note) => (
                        <li key={note.id} className="flex items-center gap-2 px-5 py-2.5 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{note.subjectName}</p>
                            <p className="text-xs text-muted-foreground">
                              {note.className} · week {note.weekNumber}
                            </p>
                          </div>
                          <Button data-cy="teacher-dashboard-write" size="sm" variant="ghost" asChild>
                            <Link to="/lesson-notes/new">Write</Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Coming up</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-5 pt-0 text-sm">
                  {(data?.upcomingAssessments.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground">No assessments scheduled.</p>
                  ) : (
                    data?.upcomingAssessments.map((assessment) => (
                      <div key={assessment.id} className="flex items-start gap-2">
                        <BookOpen
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{assessment.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {assessment.className} · {formatDateTime(assessment.startsAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <Link
                    to="/messages"
                    className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <MessageSquare className="size-4" aria-hidden="true" />
                    {data?.unreadMessages ?? 0} unread{' '}
                    {(data?.unreadMessages ?? 0) === 1 ? 'message' : 'messages'}
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
