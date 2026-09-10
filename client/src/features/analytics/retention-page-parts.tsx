import { Link } from 'react-router-dom';
import {
  CalendarClock,
  MessageSquare,
  Wallet,
} from 'lucide-react';
import { formatCurrency, formatPercent, formatRelative } from '@/lib/format';
import type { RetentionRiskRow } from '@/types/analytics';
import { Badge, Card, CardContent, Progress } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PermissionGate } from '@/components/guards/permission-gate';
import { BAND_TONE } from './retention-page-constants';

/**
 * Pieces used by `retention-page`, kept beside it so neither file outgrows
 * the limit in section 17 of the frontend guide.
 */

export function RiskDetailDialog({
  row,
  currency,
  onOpenChange,
}: {
  row: RetentionRiskRow | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent>
        {row && (
          <>
            <DialogHeader>
              <DialogTitle>{row.studentName}</DialogTitle>
              <DialogDescription>
                {row.className ?? 'No class'} · {row.admissionNo} · scored {row.riskScore} out of 100
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge tone={BAND_TONE[row.riskBand]}>{row.riskBand} risk</Badge>
                <Progress
                  value={row.riskScore}
                  tone={BAND_TONE[row.riskBand] === 'success' ? 'success' : BAND_TONE[row.riskBand]}
                  showLabel
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">What triggered this</p>
                {row.signals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active signals.</p>
                ) : (
                  <ul className="space-y-2">
                    {row.signals.map((signal) => (
                      <li
                        key={signal.key}
                        className="flex items-start gap-3 rounded-lg border border-border p-3"
                      >
                        <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
                          {signal.key === 'arrears' || signal.key === 'overdue' ? (
                            <Wallet className="size-4" />
                          ) : signal.key === 'attendance' ? (
                            <CalendarClock className="size-4" />
                          ) : (
                            <MessageSquare className="size-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{signal.label}</p>
                          <p className="text-xs text-muted-foreground">{signal.detail}</p>
                        </div>
                        <Badge tone="neutral">+{signal.weight}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Card>
                <CardContent className="grid gap-3 pt-5 sm:grid-cols-3">
                  <Figure
                    label="Outstanding"
                    value={formatCurrency(row.outstandingBalance, currency, {
                      showDecimals: false,
                    })}
                  />
                  <Figure label="Attendance" value={formatPercent(row.attendanceRate, 0)} />
                  <Figure
                    label="Guardian last seen"
                    value={
                      row.guardianLastLoginAt ? formatRelative(row.guardianLastLoginAt) : 'Never'
                    }
                  />
                </CardContent>
              </Card>
            </DialogBody>

            <DialogFooter>
              <Button data-cy="analytics-retention-open-student" variant="outline" asChild>
                <Link to={`/students/${row.studentId}`}>Open student</Link>
              </Button>
              <PermissionGate require="message.send">
                <Button data-cy="analytics-retention-message-the-family" asChild>
                  <Link to={`/messages?studentId=${row.studentId}`}>
                    <MessageSquare />
                    Message the family
                  </Link>
                </Button>
              </PermissionGate>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
