import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CloudOff, Save, Send, ShieldCheck, Undo2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime, formatPercent } from '@/lib/format';
import { localStore, storageKeys } from '@/lib/storage';
import { useOnlineStatus } from '@/hooks/use-outbox';
import { useAuth } from '@/app/providers/auth-provider';
import { useSaveScores, useScoreSheet, useTransitionScoreSheet, type ScoreEntry } from './api';
import type { ResultStatus } from '@/types/results';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/data/status-badge';
import { Alert, ErrorState, LoadingState } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/dialog';
import { gradeFor, Stat, Step } from './score-sheet-page-parts';

/** Local edits keyed `studentId:componentId`, held until the server takes them. */
type Draft = Record<string, number | null>;

const cellKey = (studentId: string, componentId: string) => `${studentId}:${componentId}`;

export function ScoreSheetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const isOnline = useOnlineStatus();

  const sheet = useScoreSheet(id);
  const saveScores = useSaveScores(id ?? '');
  const transition = useTransitionScoreSheet(id ?? '');

  const [draft, setDraft] = useState<Draft>({});
  const [dirty, setDirty] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<ResultStatus | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);

  const draftKey = id ? storageKeys.scoreDraft(id) : null;

  useEffect(() => {
    if (!sheet.data || !draftKey) return;
    const stored = localStore.get<Draft | null>(draftKey, null);
    if (stored && Object.keys(stored).length > 0) {
      setDraft(stored);
      setDirty(true);
      return;
    }
    const initial: Draft = {};
    sheet.data.rows.forEach((row) => {
      row.scores.forEach((cell) => {
        initial[cellKey(row.studentId, cell.componentId)] = cell.score;
      });
    });
    setDraft(initial);
    setDirty(false);
  }, [sheet.data, draftKey]);

  const setCell = useCallback(
    (studentId: string, componentId: string, value: number | null) => {
      setDraft((current) => {
        const next = { ...current, [cellKey(studentId, componentId)]: value };
        if (draftKey) localStore.set(draftKey, next);
        return next;
      });
      setDirty(true);
    },
    [draftKey],
  );

  const data = sheet.data;

  const totals = useMemo(() => {
    if (!data) return {};
    const result: Record<string, number | null> = {};
    data.rows.forEach((row) => {
      const values = data.components.map((component) => draft[cellKey(row.studentId, component.id)]);
      result[row.studentId] = values.every((value) => value !== null && value !== undefined)
        ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
        : null;
    });
    return result;
  }, [data, draft]);

  const enteredCount = useMemo(
    () => Object.values(totals).filter((total) => total !== null).length,
    [totals],
  );

  /**
   * Arrow keys and Enter move down the column, which is how marks are actually
   * transcribed from a paper mark book — one component at a time, not one
   * student at a time.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const table = gridRef.current;
    if (!table) return;
    const inputs = Array.from(table.querySelectorAll<HTMLInputElement>('input[data-cell]'));
    const index = inputs.indexOf(event.currentTarget);
    if (index === -1) return;
    const columns = data?.components.length ?? 1;

    const move = (offset: number) => {
      event.preventDefault();
      inputs[index + offset]?.focus();
      inputs[index + offset]?.select();
    };

    if (event.key === 'ArrowDown' || event.key === 'Enter') move(columns);
    else if (event.key === 'ArrowUp') move(-columns);
    else if (event.key === 'ArrowRight' && event.currentTarget.selectionStart === event.currentTarget.value.length) move(1);
    else if (event.key === 'ArrowLeft' && event.currentTarget.selectionStart === 0) move(-1);
  };

  const save = async () => {
    if (!data) return;
    const entries: ScoreEntry[] = [];
    data.rows.forEach((row) => {
      data.components.forEach((component) => {
        const value = draft[cellKey(row.studentId, component.id)];
        const original =
          row.scores.find((cell) => cell.componentId === component.id)?.score ?? null;
        if (value !== original) {
          entries.push({ studentId: row.studentId, componentId: component.id, score: value ?? null });
        }
      });
    });

    if (entries.length === 0) {
      setDirty(false);
      return;
    }

    await saveScores.mutateAsync({
      entries,
      version: data.version,
      label: `${data.className} · ${data.subjectName}`,
    });
    if (draftKey) localStore.remove(draftKey);
    setDirty(false);
  };

  if (sheet.isPending) {
    return (
      <PageContainer>
        <LoadingState label="Loading score sheet…" />
      </PageContainer>
    );
  }

  if (sheet.isError || !data) {
    return (
      <PageContainer>
        <ErrorState error={sheet.error} onRetry={() => void sheet.refetch()} />
      </PageContainer>
    );
  }

  const maxTotal = data.components.reduce((sum, component) => sum + component.maxScore, 0);
  const editable =
    (data.status === 'DRAFT' && can('result.enter')) ||
    (data.status === 'PUBLISHED' && can('result.amend'));

  const transitions: { to: ResultStatus; label: string; icon: React.ReactNode; tone?: 'primary' }[] = [];
  if (data.status === 'DRAFT' && can('result.enter')) {
    transitions.push({ to: 'SUBMITTED', label: 'Submit for approval', icon: <Send /> });
  }
  if (data.status === 'SUBMITTED' && can('result.approve')) {
    transitions.push({ to: 'APPROVED', label: 'Approve', icon: <ShieldCheck /> });
    transitions.push({ to: 'DRAFT', label: 'Return to teacher', icon: <Undo2 /> });
  }
  if (data.status === 'APPROVED' && can('result.publish')) {
    transitions.push({ to: 'PUBLISHED', label: 'Publish to parents', icon: <Upload /> });
  }

  return (
    <PageContainer width="wide">
      <PageHeader
        title={`${data.subjectName} · ${data.className}`}
        description={`${data.termName} · ${data.sessionName}`}
        breadcrumbs={[
          { label: 'Score entry', to: '/results/entry' },
          { label: `${data.subjectName} · ${data.className}` },
        ]}
        meta={
          <>
            <StatusBadge status={data.status} />
            {!isOnline && (
              <Badge tone="warning">
                <CloudOff />
                Offline
              </Badge>
            )}
            {dirty && <Badge tone="warning">Unsaved changes</Badge>}
            {data.publishedAt && (
              <span className="text-xs text-muted-foreground">
                Published {formatDateTime(data.publishedAt)}
              </span>
            )}
          </>
        }
        actions={
          <>
            {editable && (
              <Button
                data-cy="results-score-sheet-save"
                onClick={() => void save()}
                loading={saveScores.isPending}
                loadingLabel="Saving…"
                disabled={!dirty}
              >
                <Save />
                Save
              </Button>
            )}
            {transitions.map((option) => (
              <Button
                key={option.to}
                data-cy={`score-sheet-transition-${option.to.toLowerCase()}`}
                variant={option.to === 'DRAFT' ? 'outline' : 'primary'}
                onClick={() => setPendingTransition(option.to)}
                disabled={dirty}
              >
                {option.icon}
                {option.label}
              </Button>
            ))}
          </>
        }
      />

      {data.status === 'PUBLISHED' && (
        <Alert
          tone={can('result.amend') ? 'warning' : 'info'}
          title="These results are published"
        >
          {can('result.amend')
            ? 'Parents can already see these marks. Any change you make now is recorded in the audit trail with your name.'
            : 'Parents can already see these marks. Changing them requires the amend-results permission.'}
        </Alert>
      )}

      {dirty && transitions.length > 0 && (
        <Alert tone="info">Save your changes before moving this sheet to the next stage.</Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Marks</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="scrollbar-thin overflow-x-auto">
              <table ref={gridRef} className="w-full text-sm">
                <caption className="sr-only">
                  Score entry grid: one row per student, one column per assessment component
                </caption>
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Student
                    </th>
                    {data.components.map((component) => (
                      <th
                        key={component.id}
                        scope="col"
                        className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {component.name}
                        <span className="block font-normal normal-case">/{component.maxScore}</span>
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Total /{maxTotal}
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.rows.map((row) => {
                    const total = totals[row.studentId];
                    return (
                      <tr key={row.studentId} className="hover:bg-muted/40">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-normal"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar name={row.studentName} src={row.photoUrl} size="xs" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{row.studentName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {row.admissionNo}
                              </p>
                            </div>
                          </div>
                        </th>

                        {data.components.map((component) => {
                          const value = draft[cellKey(row.studentId, component.id)];
                          const invalid =
                            value !== null && value !== undefined && value > component.maxScore;
                          return (
                            <td key={component.id} className="px-2 py-1.5 text-center">
                              <Input
                                data-cy="results-score-sheet-value"
                                data-cell
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={component.maxScore}
                                disabled={!editable}
                                invalid={invalid}
                                aria-label={`${component.name} for ${row.studentName}`}
                                value={value ?? ''}
                                onKeyDown={handleKeyDown}
                                onFocus={(event) => event.currentTarget.select()}
                                onChange={(event) => {
                                  const raw = event.target.value;
                                  setCell(
                                    row.studentId,
                                    component.id,
                                    raw === '' ? null : Number(raw),
                                  );
                                }}
                                className={cn('mx-auto h-8 w-16 text-center tabular-nums')}
                              />
                            </td>
                          );
                        })}

                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                          {total ?? '—'}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {total === null || total === undefined ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <Badge tone="neutral">{gradeFor(total, data)}</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Complete</span>
                  <span className="font-medium tabular-nums">
                    {enteredCount} / {data.rows.length}
                  </span>
                </div>
                <Progress
                  className="mt-1"
                  value={data.rows.length === 0 ? 0 : (enteredCount / data.rows.length) * 100}
                  tone={enteredCount === data.rows.length ? 'success' : 'warning'}
                />
              </div>

              <dl className="space-y-1.5 text-sm">
                <Stat label="Class average" value={data.classAverage?.toFixed(1) ?? '—'} />
                <Stat label="Highest" value={data.highest?.toString() ?? '—'} />
                <Stat label="Lowest" value={data.lowest?.toString() ?? '—'} />
                <Stat
                  label="Pass rate"
                  value={
                    data.classAverage === null
                      ? '—'
                      : formatPercent(
                          (data.rows.filter((row) => (totals[row.studentId] ?? 0) >= maxTotal * 0.4)
                            .length /
                            Math.max(1, data.rows.length)) *
                            100,
                          0,
                        )
                  }
                />
              </dl>

              <p className="text-xs text-muted-foreground">
                Tip: press Enter or the down arrow to move to the next student in the same column.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Step
                label="Entered by the teacher"
                done={data.status !== 'DRAFT'}
                detail={data.submittedByName ?? undefined}
              />
              <Step
                label="Submitted for approval"
                done={['SUBMITTED', 'APPROVED', 'PUBLISHED'].includes(data.status)}
                detail={data.submittedAt ? formatDateTime(data.submittedAt) : undefined}
              />
              <Step
                label="Approved"
                done={['APPROVED', 'PUBLISHED'].includes(data.status)}
                detail={data.approvedByName ?? undefined}
              />
              <Step
                label="Published to parents"
                done={data.status === 'PUBLISHED'}
                detail={data.publishedAt ? formatDateTime(data.publishedAt) : undefined}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={pendingTransition !== null}
        onOpenChange={(open) => !open && setPendingTransition(null)}
        title={
          pendingTransition === 'PUBLISHED'
            ? 'Publish these results to parents?'
            : pendingTransition === 'APPROVED'
              ? 'Approve these results?'
              : pendingTransition === 'DRAFT'
                ? 'Return this sheet to the teacher?'
                : 'Submit these results for approval?'
        }
        description={
          pendingTransition === 'PUBLISHED'
            ? 'Every parent in this class will be able to see these marks, and notified where the school has enabled it. Changing a published mark afterwards requires permission and is audited.'
            : pendingTransition === 'SUBMITTED'
              ? 'You will not be able to edit the marks while they are with the approver.'
              : pendingTransition === 'DRAFT'
                ? 'The teacher will be able to correct the marks and submit again.'
                : 'The results move on to publication.'
        }
        confirmLabel="Confirm"
        tone={pendingTransition === 'PUBLISHED' ? 'primary' : 'primary'}
        loading={transition.isPending}
        onConfirm={async () => {
          if (!pendingTransition) return;
          await transition.mutateAsync({ to: pendingTransition });
          setPendingTransition(null);
          if (pendingTransition === 'SUBMITTED') navigate('/results/entry');
        }}
      />
    </PageContainer>
  );
}
