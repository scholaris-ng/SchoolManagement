import { useParams } from 'react-router-dom';
import { BadgeCheck, GraduationCap, ShieldX, XCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { useVerification } from './api';
import { Card, CardContent } from '@/components/ui/primitives';
import { ErrorState, LoadingState } from '@/components/ui/feedback';

/**
 * Public document verification (`/verify/:code`).
 *
 * An employer or university holding a printed report card can confirm the
 * school issued it. It shows initials, class and term — never the results
 * themselves, a full name, or anything else that would turn a verification
 * link into a way to look children up.
 */
export function VerifyPage() {
  const { code } = useParams<{ code: string }>();
  const verification = useVerification(code);

  const result = verification.data;

  return (
    <div className="grid min-h-dvh place-items-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold">Scholaris document check</span>
        </div>

        <Card>
          {verification.isPending ? (
            <LoadingState label="Checking this document…" />
          ) : verification.isError ? (
            <ErrorState
              error={verification.error}
              onRetry={() => void verification.refetch()}
              title="We could not check this code"
            />
          ) : !result?.valid ? (
            <CardContent className="space-y-3 pt-6 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger-subtle text-danger">
                <XCircle className="size-6" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">This code does not match a document we issued</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Check the code was typed exactly as printed. If it still fails, contact the school
                  directly — do not rely on the document.
                </p>
              </div>
              <p className="font-mono text-xs text-muted-foreground">{code}</p>
            </CardContent>
          ) : result.revoked ? (
            <CardContent className="space-y-3 pt-6 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-warning-subtle text-warning">
                <ShieldX className="size-6" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">This document has been withdrawn</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.schoolName} issued it, then revoked it. Ask the school for a current copy.
                </p>
              </div>
            </CardContent>
          ) : (
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-success-subtle text-success">
                  <BadgeCheck className="size-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold">This is a genuine document</p>
                  <p className="text-sm text-muted-foreground">Issued by {result.schoolName}</p>
                </div>
              </div>

              <dl className="divide-y divide-border rounded-md border border-border text-sm">
                <Row label="Document" value={documentLabel(result.documentType)} />
                <Row label="Student" value={result.studentInitials} />
                {result.className && <Row label="Class" value={result.className} />}
                {result.termName && (
                  <Row
                    label="Term"
                    value={[result.termName, result.sessionName].filter(Boolean).join(' · ')}
                  />
                )}
                {result.averageBand && <Row label="Overall band" value={result.averageBand} />}
                <Row label="Verified at" value={formatDateTime(result.issuedAt)} />
              </dl>

              <p className="text-center text-xs text-muted-foreground">
                Only the details needed to confirm authenticity are shown. Full academic records are
                released by the school, to the student or their guardian.
              </p>
            </CardContent>
          )}
        </Card>

        <p className="text-center font-mono text-xs text-muted-foreground">{code}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function documentLabel(type: string): string {
  return (
    { REPORT_CARD: 'Termly report card', TRANSCRIPT: 'Academic transcript', CERTIFICATE: 'Certificate' }[
      type
    ] ?? 'School document'
  );
}
