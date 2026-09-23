import { useEffect, useMemo, useState } from 'react';
import { Mail, MessageCircle, Printer, SendHorizonal } from 'lucide-react';
import { toDateTimeInputValue } from '@/lib/format';
import { cn, humanizeEnum } from '@/lib/utils';
import { isApiError } from '@/lib/api-error';
import { useStudentGuardians } from '@/features/students/api';
import { Badge, Label } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormError } from '@/components/forms/form-actions';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DeliveryChannel, DeliveryDocumentType, PrintFormat } from '@/types/finance';
import { useRecordDelivery } from './use-document-deliveries';

const CHANNELS: { channel: DeliveryChannel; label: string; icon: React.ReactNode }[] = [
  { channel: 'PRINT', label: 'Handed over', icon: <Printer className="size-4" aria-hidden="true" /> },
  { channel: 'EMAIL', label: 'Email', icon: <Mail className="size-4" aria-hidden="true" /> },
  {
    channel: 'WHATSAPP',
    label: 'WhatsApp',
    icon: <MessageCircle className="size-4" aria-hidden="true" />,
  },
  {
    channel: 'OTHER',
    label: 'Another way',
    icon: <SendHorizonal className="size-4" aria-hidden="true" />,
  },
];

/** The two shapes of paper a desk produces — the full document, or a thermal-roll slip. */
const PRINT_FORMATS: { format: PrintFormat; label: string }[] = [
  { format: 'FULL_PAGE', label: 'Full page' },
  { format: 'POS', label: 'POS slip (78mm)' },
];

/** Who a copy went to, when it was not a guardian on file. */
const SOMEONE_ELSE = 'someone-else';

/**
 * Records a copy of a document the office sent by its own means.
 *
 * The register fills itself in for the channels this system drives, but plenty
 * of documents reach a family another way — the paper handed to an aunt at the
 * gate, a photograph from a bursar's own phone, a copy posted to a parent
 * abroad. Without somewhere to put those, the register would quietly become a
 * list of what the *software* did rather than what the family has, and the first
 * time it said "not sent" about a receipt somebody remembers handing over,
 * nobody would trust it again.
 *
 * Everything here is optional except the channel: a document handed across the
 * counter has no recipient to name, and refusing to log it without one would
 * mean it never got logged.
 */
export function RecordDeliveryDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  studentId,
  includeCharges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: DeliveryDocumentType;
  documentId: string;
  /** Absent for a bill or a fee schedule, which belong to no one child. */
  studentId?: string | null;
  includeCharges: boolean;
}) {
  const record = useRecordDelivery(documentType, documentId);
  const links = useStudentGuardians(open && studentId ? studentId : undefined);

  const [channel, setChannel] = useState<DeliveryChannel>('PRINT');
  const [printFormat, setPrintFormat] = useState<PrintFormat>('FULL_PAGE');
  const [recipientId, setRecipientId] = useState<string>('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientContact, setRecipientContact] = useState('');
  const [sentAt, setSentAt] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);

  const guardians = useMemo(() => links.data ?? [], [links.data]);

  // Opening the dialog is the start of a fresh entry: a channel or a recipient
  // left over from the last document would quietly log the wrong thing.
  useEffect(() => {
    if (!open) return;
    setChannel('PRINT');
    setPrintFormat('FULL_PAGE');
    setRecipientId('');
    setRecipientName('');
    setRecipientContact('');
    setSentAt(toDateTimeInputValue(new Date()));
    setNote('');
    setError(null);
  }, [open]);

  const selected = guardians.find((link) => link.guardianId === recipientId);

  // What the guardian's record already holds for this channel, shown so nobody
  // wonders which of two numbers the register will end up with. The server
  // captures the same value from the same record.
  const guardianContact =
    channel === 'EMAIL' ? selected?.guardianEmail ?? '' : selected?.guardianPhone ?? '';

  const namedSomeoneElse = recipientId === SOMEONE_ELSE;

  const submit = async () => {
    setError(null);
    try {
      await record.mutateAsync({
        channel,
        // Only paper has a shape — the server drops it on any other channel anyway.
        printFormat: channel === 'PRINT' ? printFormat : undefined,
        guardianId: selected ? selected.guardianId : undefined,
        recipientName: namedSomeoneElse ? recipientName.trim() || undefined : undefined,
        recipientContact: namedSomeoneElse ? recipientContact.trim() || undefined : undefined,
        includeCharges,
        note: note.trim() || undefined,
        // Typed in the browser's own zone; sent as an instant so the register
        // reads the same for a school and for anyone reviewing it elsewhere.
        sentAt: sentAt ? new Date(sentAt).toISOString() : undefined,
      });
      onOpenChange(false);
    } catch (thrown) {
      if (!isApiError(thrown)) throw thrown;
      setError(thrown);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Record a delivery</DialogTitle>
          <DialogDescription>
            For a copy that went out by other means — handed over at the desk, posted, or sent from
            your own phone. Printing, emailing and WhatsApp from this page log themselves.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FormError error={error} />

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">How did it go out?</legend>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((option) => (
                <button
                  key={option.channel}
                  type="button"
                  data-cy={`record-delivery-channel-${option.channel}`}
                  aria-pressed={channel === option.channel}
                  onClick={() => setChannel(option.channel)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    channel === option.channel
                      ? 'border-primary bg-primary-subtle text-primary'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Only paper has a shape, so this appears only for a handed-over copy. */}
          {channel === 'PRINT' && (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Which paper?</legend>
              <div className="flex flex-wrap gap-2">
                {PRINT_FORMATS.map((option) => (
                  <button
                    key={option.format}
                    type="button"
                    data-cy={`record-delivery-format-${option.format}`}
                    aria-pressed={printFormat === option.format}
                    onClick={() => setPrintFormat(option.format)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      printFormat === option.format
                        ? 'border-primary bg-primary-subtle text-primary'
                        : 'border-border hover:bg-accent',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="space-y-1.5">
            <Label>Who has it?</Label>
            <div className="space-y-1.5">
              {guardians.map((link) => (
                <label key={link.guardianId} className="flex items-start gap-2 text-sm">
                  <input
                    data-cy="record-delivery-guardian"
                    type="radio"
                    name="record-delivery-recipient"
                    className="mt-1 size-4 shrink-0 border-input"
                    checked={recipientId === link.guardianId}
                    onChange={() => setRecipientId(link.guardianId)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{link.guardianName}</span>
                      <span className="text-xs text-muted-foreground">
                        {humanizeEnum(link.relationship)}
                      </span>
                      {link.isFinanciallyResponsible && <Badge tone="success">Pays fees</Badge>}
                    </span>
                    {recipientId === link.guardianId && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {guardianContact || 'Nothing on file for this channel'}
                      </span>
                    )}
                  </span>
                </label>
              ))}

              <label className="flex items-center gap-2 text-sm">
                <input
                  data-cy="record-delivery-someone-else"
                  type="radio"
                  name="record-delivery-recipient"
                  className="size-4 shrink-0 border-input"
                  checked={namedSomeoneElse}
                  onChange={() => setRecipientId(SOMEONE_ELSE)}
                />
                Somebody else
              </label>

              {/* The usual case for a printed document: nobody to name, because
                  the person was standing at the counter. */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  data-cy="record-delivery-unnamed"
                  type="radio"
                  name="record-delivery-recipient"
                  className="size-4 shrink-0 border-input"
                  checked={recipientId === ''}
                  onChange={() => setRecipientId('')}
                />
                <span className="text-muted-foreground">Handed over — nobody to name</span>
              </label>
            </div>
          </div>

          {namedSomeoneElse && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="record-delivery-name">Name</Label>
                <Input
                  data-cy="record-delivery-name"
                  id="record-delivery-name"
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder="Who received it"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="record-delivery-contact">
                  {channel === 'EMAIL' ? 'Email address' : 'Phone number'}
                </Label>
                <Input
                  data-cy="record-delivery-contact"
                  id="record-delivery-contact"
                  value={recipientContact}
                  onChange={(event) => setRecipientContact(event.target.value)}
                  placeholder={channel === 'EMAIL' ? 'name@example.com' : '0803…'}
                />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="record-delivery-sent-at">When</Label>
              <Input
                data-cy="record-delivery-sent-at"
                id="record-delivery-sent-at"
                type="datetime-local"
                value={sentAt}
                max={toDateTimeInputValue(new Date())}
                onChange={(event) => setSentAt(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="record-delivery-note">Note</Label>
              <Input
                data-cy="record-delivery-note"
                id="record-delivery-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Posted to their Lagos address"
              />
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            data-cy="record-delivery-cancel"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            data-cy="record-delivery-save"
            loading={record.isPending}
            onClick={() => void submit()}
          >
            Record it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
