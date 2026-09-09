import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Flag,
  Send,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { localStore, storageKeys } from '@/lib/storage';
import { useOnlineStatus } from '@/hooks/use-outbox';
import { useFlushAnswers, useSubmitAttempt } from './api';
import type { AttemptResult, CbtAttempt } from '@/types/assessment';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/dialog';

const FLUSH_INTERVAL_MS = 15_000;

/**
 * Sitting a paper.
 *
 * The design constraint here is a Nigerian secondary school on a bad line
 * during an exam. So: the attempt and every answer live in this device's
 * storage from the moment the paper opens; answers are pushed to the server on
 * a timer as a convenience, not as the source of truth; and the timer is
 * computed from the server's expiry timestamp so a refresh cannot buy extra
 * minutes (spec section 18).
 */
export function AttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const storageKey = attemptId ? storageKeys.cbtAttempt(attemptId) : null;
  const [attempt] = useState<CbtAttempt | null>(() =>
    storageKey ? localStore.get<CbtAttempt | null>(storageKey, null) : null,
  );

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const stored = storageKey ? localStore.get<CbtAttempt | null>(storageKey, null) : null;
    const map: Record<string, string> = {};
    stored?.answers.forEach((answer) => {
      if (answer.answer) map[answer.questionId] = answer.answer;
    });
    return map;
  });

  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const flushAnswers = useFlushAnswers(attemptId ?? '');
  const submitAttempt = useSubmitAttempt(attemptId ?? '');
  const unsyncedRef = useRef<Set<string>>(new Set());

  const [secondsLeft, setSecondsLeft] = useState(() =>
    attempt ? Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)) : 0,
  );

  const questions = useMemo(() => attempt?.questions ?? [], [attempt]);
  const answeredCount = Object.values(answers).filter(Boolean).length;

  const persist = useCallback(
    (next: Record<string, string>) => {
      if (!storageKey || !attempt) return;
      localStore.set(storageKey, {
        ...attempt,
        answers: Object.entries(next).map(([questionId, answer]) => ({
          questionId,
          answer,
          answeredAt: new Date().toISOString(),
          synced: false,
        })),
      });
    },
    [storageKey, attempt],
  );

  const setAnswer = (questionId: string, answer: string) => {
    setAnswers((current) => {
      const next = { ...current, [questionId]: answer };
      persist(next);
      return next;
    });
    unsyncedRef.current.add(questionId);
  };

  const submit = useCallback(async () => {
    if (!attempt) return;
    const outcome = await submitAttempt.mutateAsync({
      assessmentId: attempt.assessmentId,
      answers: questions.map((question) => ({
        questionId: question.id,
        answer: answers[question.id] ?? null,
      })),
    });
    // Only now is the local copy safe to discard: the server has the paper.
    if (storageKey) localStore.remove(storageKey);
    setResult(outcome);
    setConfirmOpen(false);
  }, [attempt, answers, questions, storageKey, submitAttempt]);

  // Countdown, driven off the server's expiry rather than elapsed local time.
  useEffect(() => {
    if (!attempt || result) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining === 0) void submit();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt, result, submit]);

  // Background flush of anything typed since the last push.
  useEffect(() => {
    if (!attempt || result) return;
    const timer = setInterval(() => {
      if (!navigator.onLine || unsyncedRef.current.size === 0) return;
      const pending = Array.from(unsyncedRef.current).map((questionId) => ({
        questionId,
        answer: answers[questionId] ?? '',
      }));
      flushAnswers.mutate(pending, {
        onSuccess: (response) => {
          unsyncedRef.current.clear();
          setLastSyncedAt(response.savedAt);
        },
      });
    }, FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [attempt, answers, result, flushAnswers]);

  if (!attempt) {
    return (
      <PageContainer width="narrow">
        <EmptyState
          icon={<XCircle />}
          title="This attempt is no longer on this device"
          description="An exam in progress is stored in the browser you started it in. If you submitted it already, your score is with your teacher."
          action={<Button data-cy="cbt-attempt-back-to-assessments" onClick={() => navigate('/cbt')}>Back to assessments</Button>}
        />
      </PageContainer>
    );
  }

  if (result) {
    return <AttemptResultView result={result} onDone={() => navigate('/cbt')} />;
  }

  const question = questions[index];
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const lowTime = secondsLeft < 300;

  return (
    <PageContainer width="wide">
      <PageHeader
        title={attempt.assessmentTitle}
        description={`Question ${index + 1} of ${questions.length}`}
        meta={
          <>
            <Badge tone={lowTime ? 'danger' : 'neutral'}>
              {minutes}:{String(seconds).padStart(2, '0')} left
            </Badge>
            <Badge tone="neutral">
              {answeredCount} of {questions.length} answered
            </Badge>
            {!isOnline ? (
              <Badge tone="warning">
                <CloudOff />
                Offline — answers saved on this device
              </Badge>
            ) : (
              lastSyncedAt && (
                <span className="text-xs text-muted-foreground">
                  Synced {new Date(lastSyncedAt).toLocaleTimeString()}
                </span>
              )
            )}
          </>
        }
        actions={
          <Button data-cy="cbt-attempt-submit-paper" onClick={() => setConfirmOpen(true)}>
            <Send />
            Submit paper
          </Button>
        }
      />

      {lowTime && (
        <Alert tone="warning" title="Less than five minutes remain">
          The paper submits itself automatically when the time runs out.
        </Alert>
      )}

      {!isOnline && (
        <Alert tone="warning" title="You are offline">
          Keep going — your answers are being kept on this device and will be sent when the
          connection returns. Do not close this tab.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base font-medium leading-relaxed">
                {index + 1}. {question?.text}
              </CardTitle>
              <Button
                data-cy="attempt-flag-question"
                variant={flagged.includes(question?.id ?? '') ? 'primary' : 'outline'}
                size="sm"
                onClick={() =>
                  setFlagged((current) =>
                    current.includes(question.id)
                      ? current.filter((entry) => entry !== question.id)
                      : [...current, question.id],
                  )
                }
              >
                <Flag />
                {flagged.includes(question?.id ?? '') ? 'Flagged' : 'Flag'}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {question?.imageUrl && (
              <img
                src={question.imageUrl}
                alt=""
                className="max-h-64 rounded-md border border-border object-contain"
              />
            )}

            {question?.options.length ? (
              <fieldset className="space-y-2">
                <legend className="sr-only">Choose an answer</legend>
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.id;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors',
                        selected
                          ? 'border-primary bg-primary-subtle'
                          : 'border-border hover:border-primary/40 hover:bg-accent/40',
                      )}
                    >
                      <input
                        data-cy="cbt-attempt-selected"
                        type="radio"
                        name={question.id}
                        checked={selected}
                        onChange={() => setAnswer(question.id, option.id)}
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span>
                        <span className="mr-2 font-semibold">{option.label}.</span>
                        {option.text}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <div className="space-y-1.5">
                <label htmlFor="short-answer" className="text-sm font-medium">
                  Your answer
                </label>
                <Input
                  data-cy="short-answer"
                  id="short-answer"
                  value={answers[question?.id ?? ''] ?? ''}
                  onChange={(event) => setAnswer(question.id, event.target.value)}
                  placeholder="Type your answer"
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              <Button
                data-cy="cbt-attempt-previous"
                variant="outline"
                disabled={index === 0}
                onClick={() => setIndex((current) => current - 1)}
              >
                <ChevronLeft />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {question?.marks} mark{question?.marks === 1 ? '' : 's'}
              </span>
              <Button
                data-cy="cbt-attempt-next"
                variant="outline"
                disabled={index === questions.length - 1}
                onClick={() => setIndex((current) => current + 1)}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress
              value={questions.length === 0 ? 0 : (answeredCount / questions.length) * 100}
              tone={answeredCount === questions.length ? 'success' : 'primary'}
            />
            <div className="grid grid-cols-6 gap-1.5">
              {questions.map((entry, entryIndex) => {
                const answered = Boolean(answers[entry.id]);
                const isFlagged = flagged.includes(entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    data-cy={`attempt-jump-to-question-${entryIndex + 1}`}
                    onClick={() => setIndex(entryIndex)}
                    aria-label={`Go to question ${entryIndex + 1}${answered ? ', answered' : ', not answered'}`}
                    aria-current={entryIndex === index}
                    className={cn(
                      'grid aspect-square place-items-center rounded text-xs font-medium transition-colors',
                      entryIndex === index && 'ring-2 ring-ring ring-offset-1',
                      isFlagged
                        ? 'bg-warning text-warning-foreground'
                        : answered
                          ? 'bg-success text-success-foreground'
                          : 'border border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {entryIndex + 1}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Green is answered, amber is flagged for review.
            </p>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit your paper?"
        description={
          answeredCount < questions.length
            ? `You have answered ${answeredCount} of ${questions.length} questions. Unanswered questions score nothing, and you cannot come back to them.`
            : 'You have answered every question. Once submitted you cannot change your answers.'
        }
        confirmLabel="Submit"
        loading={submitAttempt.isPending}
        onConfirm={() => void submit()}
      />
    </PageContainer>
  );
}

function AttemptResultView({ result, onDone }: { result: AttemptResult; onDone: () => void }) {
  return (
    <PageContainer width="narrow">
      <PageHeader title={result.assessmentTitle} description="Your paper has been submitted." />

      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <span
            className={cn(
              'mx-auto grid size-14 place-items-center rounded-full',
              result.passed ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning',
            )}
          >
            {result.passed ? (
              <CheckCircle2 className="size-7" aria-hidden="true" />
            ) : (
              <XCircle className="size-7" aria-hidden="true" />
            )}
          </span>

          <div>
            <p className="text-3xl font-bold tabular-nums">
              {result.score} / {result.totalMarks}
            </p>
            <p className="text-muted-foreground">{result.percentage}%</p>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-md border border-border p-2">
              <dt className="text-xs text-muted-foreground">Correct</dt>
              <dd className="text-lg font-semibold tabular-nums text-success">
                {result.correctCount}
              </dd>
            </div>
            <div className="rounded-md border border-border p-2">
              <dt className="text-xs text-muted-foreground">Wrong</dt>
              <dd className="text-lg font-semibold tabular-nums text-danger">{result.wrongCount}</dd>
            </div>
            <div className="rounded-md border border-border p-2">
              <dt className="text-xs text-muted-foreground">Skipped</dt>
              <dd className="text-lg font-semibold tabular-nums">{result.unansweredCount}</dd>
            </div>
          </dl>

          <Button data-cy="cbt-attempt-done" onClick={onDone} block>
            Done
          </Button>
        </CardContent>
      </Card>

      {result.breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Where you went wrong</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {result.breakdown.map((entry) => (
                <li key={entry.questionId} className="space-y-1 px-5 py-3 text-sm">
                  <div className="flex items-start gap-2">
                    {entry.isCorrect ? (
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-success"
                        aria-hidden="true"
                      />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                    )}
                    <p className="min-w-0 flex-1">{entry.text}</p>
                  </div>
                  {!entry.isCorrect && entry.explanation && (
                    <p className="pl-6 text-muted-foreground">{entry.explanation}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
