import {
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AttemptResult } from '@/types/assessment';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';

/**
 * Pieces used by `attempt-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function AttemptResultView({ result, onDone }: { result: AttemptResult; onDone: () => void }) {
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
