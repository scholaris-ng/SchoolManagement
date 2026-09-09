import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Clock, Play, Shuffle, Target } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { localStore, storageKeys } from '@/lib/storage';
import { useAssessment, useStartAttempt } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/status-badge';
import { Alert, ErrorState, LoadingState } from '@/components/ui/feedback';

/**
 * The cover sheet before a paper starts.
 *
 * Everything a student needs to decide whether now is the moment: how long it
 * takes, how many attempts they have left, and — importantly on an unreliable
 * connection — what happens if the network drops.
 */
export function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const assessment = useAssessment(id);
  const startAttempt = useStartAttempt(id ?? '');

  if (assessment.isPending) {
    return (
      <PageContainer width="narrow">
        <LoadingState label="Loading assessment…" />
      </PageContainer>
    );
  }

  if (assessment.isError || !assessment.data) {
    return (
      <PageContainer width="narrow">
        <ErrorState error={assessment.error} onRetry={() => void assessment.refetch()} />
      </PageContainer>
    );
  }

  const paper = assessment.data;
  const canTake = can('cbt.take') && paper.state === 'OPEN';

  const start = async () => {
    const attempt = await startAttempt.mutateAsync();
    // The attempt is written to this device immediately so a refresh, a flat
    // battery or a lost connection cannot wipe out a paper in progress.
    localStore.set(storageKeys.cbtAttempt(attempt.id), attempt);
    navigate(`/cbt/attempts/${attempt.id}`);
  };

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={paper.title}
        description={`${paper.subjectName} · ${paper.classNames.join(', ') || 'All classes'}`}
        breadcrumbs={[{ label: 'CBT', to: '/cbt' }, { label: paper.title }]}
        meta={
          <>
            <StatusBadge status={paper.state} />
            <Badge tone={paper.mode === 'EXAM' ? 'danger' : 'info'}>
              {humanizeEnum(paper.mode)}
            </Badge>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Before you begin</CardTitle>
          <CardDescription>Read this carefully — the timer starts when you press start.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact icon={<BookOpen />} label="Questions" value={`${paper.questionCount}`} />
            <Fact icon={<Target />} label="Total marks" value={`${paper.totalMarks}`} />
            <Fact icon={<Clock />} label="Time allowed" value={`${paper.durationMinutes} minutes`} />
            <Fact
              icon={<Play />}
              label="Attempts allowed"
              value={paper.attemptsAllowed === 0 ? 'Unlimited' : `${paper.attemptsAllowed}`}
            />
            <Fact icon={<Target />} label="Pass mark" value={`${paper.passScore}%`} />
            <Fact
              icon={<Shuffle />}
              label="Order"
              value={paper.shuffleQuestions ? 'Questions shuffled' : 'Fixed order'}
            />
          </dl>

          {(paper.startsAt || paper.endsAt) && (
            <p className="text-sm text-muted-foreground">
              {paper.startsAt && `Opens ${formatDateTime(paper.startsAt)}`}
              {paper.startsAt && paper.endsAt && ' · '}
              {paper.endsAt && `closes ${formatDateTime(paper.endsAt)}`}
            </p>
          )}

          <Alert tone="info" title="If your internet stops">
            Keep answering. Every answer is saved on this device as you go and sent to the school
            when the connection returns. Do not close the tab — press Submit when you have finished,
            and wait for the confirmation.
          </Alert>

          {paper.mode === 'PRACTICE' ? (
            <Alert tone="success">
              This is a practice paper. You will see the correct answers and explanations as soon as
              you submit.
            </Alert>
          ) : (
            <Alert tone="warning">
              This is an examination. Answers are not shown afterwards, and your teacher sees your
              score.
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button data-cy="cbt-assessment-detail-back" variant="outline" onClick={() => navigate('/cbt')}>
          Back
        </Button>
        {canTake ? (
          <Button
            data-cy="cbt-assessment-detail-start-now"
            onClick={() => void start()}
            loading={startAttempt.isPending}
            loadingLabel="Preparing your paper…"
          >
            <Play />
            Start now
          </Button>
        ) : (
          <Button disabled data-cy="assessment-detail-start-blocked">
            {paper.state === 'OPEN' ? 'You cannot take this paper' : 'Not open'}
          </Button>
        )}
      </div>
    </PageContainer>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border p-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  );
}
