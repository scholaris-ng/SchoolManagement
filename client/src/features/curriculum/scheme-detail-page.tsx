import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Printer, Save, Send, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/format';
import { useAuth } from '@/app/providers/auth-provider';
import { useSaveScheme, useScheme } from './api';
import type { SchemeWeek } from '@/types/curriculum';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge, Card, CardContent, CardHeader, CardTitle, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/data/status-badge';
import { Alert, ErrorState, LoadingState, Tooltip } from '@/components/ui/feedback';
import { RichTextEditor } from '@/components/forms/rich-text-editor';

/**
 * A generated scheme, made editable.
 *
 * The generator produces a plausible first draft; this screen exists because
 * the teacher, not the software, decides what is taught in week four. Weeks can
 * be reordered, rewritten and marked as breaks before the scheme is submitted.
 */
export function SchemeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const scheme = useScheme(id);
  const saveScheme = useSaveScheme(id ?? '');

  const [weeks, setWeeks] = useState<SchemeWeek[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!scheme.data) return;
    setWeeks(scheme.data.weeks);
    setDirty(false);
  }, [scheme.data]);

  if (scheme.isPending) {
    return (
      <PageContainer>
        <PageHeader loading title="" breadcrumbs={[{ label: 'Schemes of work', to: '/schemes' }]} />
        <LoadingState label="Loading scheme of work…" />
      </PageContainer>
    );
  }

  if (scheme.isError || !scheme.data) {
    return (
      <PageContainer>
        <PageHeader title="Scheme of work" breadcrumbs={[{ label: 'Schemes of work', to: '/schemes' }]} />
        <ErrorState error={scheme.error} onRetry={() => void scheme.refetch()} />
      </PageContainer>
    );
  }

  const record = scheme.data;
  const editable = record.status !== 'APPROVED' && can('scheme.manage');

  const updateWeek = (index: number, patch: Partial<SchemeWeek>) => {
    setWeeks((current) =>
      current.map((week, i) => (i === index ? { ...week, ...patch } : week)),
    );
    setDirty(true);
  };

  const moveWeek = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= weeks.length) return;
    setWeeks((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      // Week numbers and dates belong to the slot, not the content, so they
      // stay put while the topics move between them.
      return next.map((week, i) => ({
        ...week,
        weekNumber: current[i].weekNumber,
        startDate: current[i].startDate,
        endDate: current[i].endDate,
      }));
    });
    setDirty(true);
  };

  const save = async (status?: 'SUBMITTED' | 'APPROVED') => {
    await saveScheme.mutateAsync({
      values: status ? { weeks, status } : { weeks },
      version: record.version,
    });
    setDirty(false);
  };

  return (
    <PageContainer>
      <div className="no-print">
        <PageHeader
          title={`${record.subjectName} · ${record.className}`}
          description={`Scheme of work · ${record.termName} · ${record.sessionName}`}
          breadcrumbs={[
            { label: 'Schemes of work', to: '/schemes' },
            { label: `${record.subjectName} · ${record.className}` },
          ]}
          meta={
            <>
              <StatusBadge status={record.status} />
              <Badge tone="neutral">{weeks.length} weeks</Badge>
              <span className="text-xs text-muted-foreground">
                Written by {record.createdByName}
              </span>
              {record.approvedAt && (
                <span className="text-xs text-muted-foreground">
                  Approved by {record.approvedByName} · {formatDateTime(record.approvedAt)}
                </span>
              )}
              {dirty && <Badge tone="warning">Unsaved changes</Badge>}
            </>
          }
          actions={
            <>
              <Button data-cy="curriculum-scheme-detail-print" variant="outline" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
              {editable && (
                <>
                  <Button
                    data-cy="curriculum-scheme-detail-save"
                    variant="outline"
                    onClick={() => void save()}
                    loading={saveScheme.isPending}
                    disabled={!dirty}
                  >
                    <Save />
                    Save
                  </Button>
                  {record.status === 'DRAFT' && (
                    <Button data-cy="curriculum-scheme-detail-submit-for-approval" onClick={() => void save('SUBMITTED')} loading={saveScheme.isPending}>
                      <Send />
                      Submit for approval
                    </Button>
                  )}
                </>
              )}
              {record.status === 'SUBMITTED' && can('scheme.approve') && (
                <Button data-cy="curriculum-scheme-detail-approve" onClick={() => void save('APPROVED')} loading={saveScheme.isPending}>
                  <ShieldCheck />
                  Approve
                </Button>
              )}
            </>
          }
        />
      </div>

      {record.status === 'APPROVED' && (
        <Alert tone="success" title="This scheme has been approved" className="no-print">
          It is now the agreed plan for the term and can no longer be edited here.
        </Alert>
      )}

      <div className="space-y-3 print-page">
        {weeks.map((week, index) => (
          <Card key={week.id} className={cn(week.isBreak && 'border-dashed bg-muted/30')}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    Week {week.weekNumber}
                    {week.isBreak && <Badge tone="neutral">Break</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(week.startDate)} – {formatDate(week.endDate)}
                  </p>
                </div>
                {editable && (
                  <div className="flex items-center gap-1.5 no-print">
                    <span className="text-xs text-muted-foreground">Reorder</span>
                    <Tooltip content="Swap this week's topic with the one before it">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        data-cy={`scheme-week-up-${week.weekNumber}`}
                        aria-label={`Move week ${week.weekNumber} earlier`}
                        disabled={index === 0}
                        onClick={() => moveWeek(index, -1)}
                      >
                        <ArrowUp />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Swap this week's topic with the one after it">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        data-cy={`scheme-week-down-${week.weekNumber}`}
                        aria-label={`Move week ${week.weekNumber} later`}
                        disabled={index === weeks.length - 1}
                        onClick={() => moveWeek(index, 1)}
                      >
                        <ArrowDown />
                      </Button>
                    </Tooltip>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {editable ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`week-topic-${week.id}`}>Topic</Label>
                  <Input
                    data-cy="curriculum-scheme-detail-topic-title"
                    id={`week-topic-${week.id}`}
                    value={week.topicTitle}
                    onChange={(event) => updateWeek(index, { topicTitle: event.target.value })}
                  />
                </div>
              ) : (
                <p className="font-medium">{week.topicTitle}</p>
              )}

              {week.objectiveStatements.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Objectives
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                    {week.objectiveStatements.map((statement, i) => (
                      <li key={i}>{statement}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {editable ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor={`week-activities-${week.id}`}>Activities</Label>
                      <RichTextEditor
                        key={`week-activities-${week.id}`}
                        id={`week-activities-${week.id}`}
                        defaultValue={week.activities ?? ''}
                        onChange={(html) => updateWeek(index, { activities: html || null })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`week-resources-${week.id}`}>Resources</Label>
                      <RichTextEditor
                        key={`week-resources-${week.id}`}
                        id={`week-resources-${week.id}`}
                        defaultValue={week.resources ?? ''}
                        onChange={(html) => updateWeek(index, { resources: html || null })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {week.activities && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Activities
                        </p>
                        <RichTextEditor defaultValue={week.activities} onChange={() => {}} readOnly />
                      </div>
                    )}
                    {week.resources && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Resources
                        </p>
                        <RichTextEditor defaultValue={week.resources} onChange={() => {}} readOnly />
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
