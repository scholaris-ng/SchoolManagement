import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, GraduationCap, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useOffer, useRespondToOffer } from './api';
import { Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/feedback';

/**
 * The "respond to this offer" link (`/offers/:token`), emailed the moment a
 * school offers a place.
 *
 * No account, no password — the token in the URL is the only thing standing
 * in for one, the same way a password-reset link is trusted on its own. What
 * it can do is narrow on purpose: accept or decline one specific offer,
 * nothing else about the application or the school's other records.
 */
export function OfferPage() {
  const { token } = useParams<{ token: string }>();
  const offer = useOffer(token);
  const respond = useRespondToOffer(token);
  const [pending, setPending] = useState<'ACCEPT' | 'DECLINE' | null>(null);

  const result = offer.data;

  const act = async (action: 'ACCEPT' | 'DECLINE') => {
    setPending(action);
    try {
      await respond.mutateAsync(action);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold">Scholaris</span>
        </div>

        <Card>
          {offer.isPending ? (
            <LoadingState label="Loading this offer…" />
          ) : offer.isError || !result ? (
            <CardContent className="space-y-3 pt-6 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger-subtle text-danger">
                <XCircle className="size-6" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">We could not find this offer</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The link may be out of date. If you believe this is wrong, contact the school
                  office directly.
                </p>
              </div>
            </CardContent>
          ) : result.respondable ? (
            <CardContent className="space-y-4 pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{result.schoolName}</p>
                <h1 className="text-lg font-semibold">
                  A place has been offered to {result.applicantName}
                </h1>
              </div>

              <dl className="divide-y divide-border rounded-md border border-border text-sm">
                {result.className && <Row label="Class" value={result.className} />}
                <Row label="Session" value={result.sessionName} />
                <Row label="Reference" value={result.applicationNo} />
                {result.offerExpiresOn && (
                  <Row label="Respond by" value={formatDate(result.offerExpiresOn)} />
                )}
              </dl>

              {respond.isError && (
                <p role="alert" className="text-center text-sm text-danger">
                  That did not go through. Please try again, or contact the school office.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => void act('DECLINE')}
                  loading={pending === 'DECLINE'}
                  disabled={respond.isPending}
                >
                  <ThumbsDown />
                  Decline
                </Button>
                <Button
                  onClick={() => void act('ACCEPT')}
                  loading={pending === 'ACCEPT'}
                  disabled={respond.isPending}
                >
                  <ThumbsUp />
                  Accept
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Accepting confirms the place. The school's office will be in touch about
                enrolment.
              </p>
            </CardContent>
          ) : (
            <CardContent className="space-y-3 pt-6 text-center">
              <span
                className={
                  'mx-auto grid size-12 place-items-center rounded-full ' +
                  (result.status === 'ACCEPTED'
                    ? 'bg-success-subtle text-success'
                    : 'bg-muted text-muted-foreground')
                }
              >
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">{statusMessage(result.status)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.applicantName} · {result.schoolName}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Questions about this application? Contact the school office directly.
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function statusMessage(status: string): string {
  switch (status) {
    case 'ACCEPTED':
      return 'This place has been accepted';
    case 'WITHDRAWN':
      return 'This application has been withdrawn';
    case 'REJECTED':
      return 'This offer is no longer available';
    default:
      return 'This offer has expired';
  }
}
