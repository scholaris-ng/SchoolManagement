import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCheck, ClipboardCheck, CloudOff, Lock, Save, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime, formatPercent, toDateInputValue } from '@/lib/format';
import { localStore, storageKeys } from '@/lib/storage';
import { useOnlineStatus } from '@/hooks/use-outbox';
import { useAuth } from '@/app/providers/auth-provider';
import { useClasses } from '@/features/academics/api';
import { useAttendanceRegister, useAttendanceSummary, useAttendanceTrend, useSaveRegister } from './api';
import type { AbsenceReason, AttendanceStatus } from '@/types/attendance';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/primitives';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { chartTheme } from '@/components/charts/chart-theme';

interface DraftMark {
  status: AttendanceStatus;
  reason: AbsenceReason | null;
  note: string | null;
}

type Draft = Record<string, DraftMark>;

const STATUS_ORDER: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: 'data-[active=true]:bg-success data-[active=true]:text-success-foreground',
  LATE: 'data-[active=true]:bg-warning data-[active=true]:text-warning-foreground',
  ABSENT: 'data-[active=true]:bg-danger data-[active=true]:text-danger-foreground',
  EXCUSED: 'data-[active=true]:bg-info data-[active=true]:text-info-foreground',
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  EXCUSED: 'Excused',
};

const REASON_OPTIONS: { value: AbsenceReason; label: string }[] = [
  { value: 'SICK', label: 'Unwell' },
  { value: 'PERMITTED', label: 'Permission given' },
  { value: 'FAMILY', label: 'Family reason' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'UNEXPLAINED', label: 'No reason given' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Taking the register.
 *
 * Designed around the reality of the job: a teacher with a phone, a class of
 * forty, and an internet connection that may vanish mid-way. Everything
 * defaults to present, each change is one tap, the draft is written to this
 * device on every keystroke, and the save path degrades to a durable queue
 * rather than an error message (spec sections 11 and 39).
 */
export function AttendancePage() {
  const { can } = useAuth();
  const isOnline = useOnlineStatus();
  const [searchParams, setSearchParams] = useSearchParams();

  const classes = useClasses();
  const today = toDateInputValue(new Date());

  const classId = searchParams.get('classId') ?? '';
  const date = searchParams.get('date') ?? today;

  const register = useAttendanceRegister(classId || undefined, date);
  const summary = useAttendanceSummary();
  const trend = useAttendanceTrend({ classId: classId || undefined, days: 14 });
  const saveRegister = useSaveRegister();

  const [draft, setDraft] = useState<Draft>({});
  const [dirty, setDirty] = useState(false);

  const draftKey = classId ? storageKeys.attendanceDraft(classId, date) : null;

  // Restore this device's unsaved draft first, then fall back to whatever the
  // server has. A draft that survived a closed tab is more current than the
  // server copy, so it wins.
  useEffect(() => {
    if (!register.data || !draftKey) return;
    const stored = localStore.get<Draft | null>(draftKey, null);
    if (stored && Object.keys(stored).length > 0) {
      setDraft(stored);
      setDirty(true);
      return;
    }
    const initial: Draft = {};
    register.data.records.forEach((record) => {
      initial[record.studentId] = {
        status: record.status,
        reason: record.reason ?? null,
        note: record.note ?? null,
      };
    });
    setDraft(initial);
    setDirty(false);
  }, [register.data, draftKey]);

  const setParam = (key: string, value: string) => {
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

  const updateMark = useCallback(
    (studentId: string, patch: Partial<DraftMark>) => {
      setDraft((current) => {
        const existing = current[studentId] ?? { status: 'PRESENT', reason: null, note: null };
        const next = { ...current, [studentId]: { ...existing, ...patch } };
        if (draftKey) localStore.set(draftKey, next);
        return next;
      });
      setDirty(true);
    },
    [draftKey],
  );

  const markAll = (status: AttendanceStatus) => {
    if (!register.data) return;
    const next: Draft = {};
    register.data.records.forEach((record) => {
      next[record.studentId] = {
        status,
        reason: status === 'ABSENT' ? (draft[record.studentId]?.reason ?? null) : null,
        note: draft[record.studentId]?.note ?? null,
      };
    });
    setDraft(next);
    if (draftKey) localStore.set(draftKey, next);
    setDirty(true);
  };

  const counts = useMemo(() => {
    const tally: Record<AttendanceStatus, number> = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 };
    Object.values(draft).forEach((mark) => {
      tally[mark.status] += 1;
    });
    return tally;
  }, [draft]);

  const total = register.data?.records.length ?? 0;
  const presentRate = total === 0 ? 0 : ((counts.PRESENT + counts.LATE) / total) * 100;

  const save = async () => {
    if (!register.data || !classId) return;
    await saveRegister.mutateAsync({
      classId,
      className: register.data.className,
      date,
      marks: register.data.records.map((record) => ({
        studentId: record.studentId,
        status: draft[record.studentId]?.status ?? 'PRESENT',
        reason: draft[record.studentId]?.reason ?? null,
        note: draft[record.studentId]?.note ?? null,
      })),
    });
    // The draft has served its purpose once the write is queued or accepted.
    if (draftKey) localStore.remove(draftKey);
    setDirty(false);
  };

  const canMark = can('attendance.manage');
  const locked = register.data?.isLocked ?? false;

  return (
    <PageContainer>
      <PageHeader
        title="Attendance"
        description="Take the register, correct a past day, and see which classes are falling behind."
        breadcrumbs={[{ label: 'Teaching' }, { label: 'Attendance' }]}
        actions={
          classId &&
          canMark &&
          !locked && (
            <Button
              onClick={() => void save()}
              loading={saveRegister.isPending}
              loadingLabel="Saving…"
              disabled={!dirty}
            >
              <Save />
              Save register
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="attendance-class">Class</Label>
            <NativeSelect
              id="attendance-class"
              value={classId}
              onChange={(event) => setParam('classId', event.target.value)}
            >
              <option value="">Choose a class…</option>
              {(classes.data ?? []).map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name} ({schoolClass.enrolledCount})
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="attendance-date">Date</Label>
            <Input
              id="attendance-date"
              type="date"
              value={date}
              max={today}
              onChange={(event) => setParam('date', event.target.value)}
              className="w-auto"
            />
          </div>

          {classId && register.data && (
            <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
              {!isOnline && (
                <Badge tone="warning">
                  <CloudOff />
                  Offline — saves to this device
                </Badge>
              )}
              {register.data.takenAt ? (
                <Badge tone="success">
                  <CheckCheck />
                  Taken by {register.data.takenByName} · {formatDateTime(register.data.takenAt)}
                </Badge>
              ) : (
                <Badge tone="neutral">Not taken yet</Badge>
              )}
              {dirty && <Badge tone="warning">Unsaved changes</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {!classId ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck />}
            title="Choose a class to take the register"
            description="Pick a class above. Everyone starts as present, so you only mark the exceptions."
          />
        </Card>
      ) : register.isPending ? (
        <LoadingState label="Loading the register…" />
      ) : register.isError ? (
        <ErrorState error={register.error} onRetry={() => void register.refetch()} />
      ) : (
        <>
          {locked && (
            <Alert tone="warning" title="This date is outside the current term" icon={<Lock />}>
              The register can be viewed but not changed.
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-4">
            <Card className="lg:col-span-3">
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>
                      {register.data.className} · {formatDate(date)}
                    </CardTitle>
                    <CardDescription>
                      {total} student{total === 1 ? '' : 's'} on the register
                    </CardDescription>
                  </div>
                  {canMark && !locked && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => markAll('PRESENT')}>
                        Mark all present
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => markAll('ABSENT')}>
                        Mark all absent
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {total === 0 ? (
                  <EmptyState
                    compact
                    icon={<Users />}
                    title="No students in this class"
                    description="Assign students to the class before taking a register."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {register.data.records.map((record) => {
                      const mark = draft[record.studentId] ?? {
                        status: 'PRESENT' as AttendanceStatus,
                        reason: null,
                        note: null,
                      };
                      return (
                        <li key={record.studentId} className="space-y-2 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <Avatar name={record.studentName} src={record.photoUrl} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{record.studentName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {record.admissionNo}
                                {record.guardianNotifiedAt
                                  ? ' · guardian already notified today'
                                  : ''}
                              </p>
                            </div>

                            <div
                              role="radiogroup"
                              aria-label={`Attendance for ${record.studentName}`}
                              className="flex shrink-0 overflow-hidden rounded-md border border-border"
                            >
                              {STATUS_ORDER.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  role="radio"
                                  aria-checked={mark.status === status}
                                  disabled={!canMark || locked}
                                  data-active={mark.status === status}
                                  onClick={() =>
                                    updateMark(record.studentId, {
                                      status,
                                      reason: status === 'ABSENT' ? mark.reason : null,
                                    })
                                  }
                                  className={cn(
                                    'px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60',
                                    'border-r border-border last:border-r-0 hover:bg-accent',
                                    STATUS_STYLE[status],
                                  )}
                                >
                                  {STATUS_LABEL[status]}
                                </button>
                              ))}
                            </div>
                          </div>

                          {mark.status === 'ABSENT' && (
                            <div className="flex flex-wrap gap-2 pl-11">
                              <NativeSelect
                                aria-label={`Reason ${record.studentName} was absent`}
                                value={mark.reason ?? ''}
                                disabled={!canMark || locked}
                                onChange={(event) =>
                                  updateMark(record.studentId, {
                                    reason: (event.target.value || null) as AbsenceReason | null,
                                  })
                                }
                                className="h-8 w-auto text-xs"
                              >
                                <option value="">Reason not given</option>
                                {REASON_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </NativeSelect>
                              <Input
                                aria-label={`Note about ${record.studentName}`}
                                value={mark.note ?? ''}
                                disabled={!canMark || locked}
                                onChange={(event) =>
                                  updateMark(record.studentId, {
                                    note: event.target.value || null,
                                  })
                                }
                                placeholder="Optional note"
                                className="h-8 max-w-xs text-xs"
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>This register</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Present or late</span>
                      <span className="font-medium tabular-nums">
                        {formatPercent(presentRate, 0)}
                      </span>
                    </div>
                    <Progress
                      className="mt-1"
                      value={presentRate}
                      tone={presentRate >= 90 ? 'success' : presentRate >= 75 ? 'warning' : 'danger'}
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    {STATUS_ORDER.map((status) => (
                      <div key={status} className="rounded-md border border-border p-2">
                        <dt className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</dt>
                        <dd className="text-lg font-semibold tabular-nums">{counts[status]}</dd>
                      </div>
                    ))}
                  </dl>
                  {counts.ABSENT > 0 && date === today && (
                    <p className="text-xs text-muted-foreground">
                      Guardians of absent children are notified once, when you save. Correcting the
                      register later will not send a second message.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {(trend.data?.length ?? 0) === 0 ? (
                    <EmptyState compact title="Not enough history yet" />
                  ) : (
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={trend.data}
                          margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
                        >
                          <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                          <XAxis dataKey="label" {...chartTheme.axis} />
                          <YAxis domain={[0, 100]} {...chartTheme.axis} />
                          <ChartTooltip
                            {...chartTheme.tooltip}
                            formatter={(value: number) => [`${value}%`, 'Attendance']}
                          />
                          <Area
                            type="monotone"
                            dataKey="rate"
                            stroke={chartTheme.colors[0]}
                            fill={chartTheme.colors[0]}
                            fillOpacity={0.15}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Attendance by class</CardTitle>
          <CardDescription>
            Lowest first — these are the classes worth a conversation this week.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {summary.isPending ? (
            <LoadingState label="Loading…" />
          ) : (summary.data?.length ?? 0) === 0 ? (
            <EmptyState compact icon={<ClipboardCheck />} title="No attendance recorded yet" />
          ) : (
            <ul className="divide-y divide-border">
              {summary.data?.map((row) => (
                <li key={row.classId} className="flex items-center gap-4 px-5 py-2.5 text-sm">
                  <button
                    type="button"
                    onClick={() => setParam('classId', row.classId)}
                    className="min-w-0 flex-1 truncate text-left font-medium hover:text-primary hover:underline"
                  >
                    {row.className}
                  </button>
                  <div className="w-32 shrink-0">
                    <Progress
                      value={row.attendanceRate}
                      tone={
                        row.attendanceRate >= 90
                          ? 'success'
                          : row.attendanceRate >= 75
                            ? 'warning'
                            : 'danger'
                      }
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right font-medium tabular-nums">
                    {formatPercent(row.attendanceRate, 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
