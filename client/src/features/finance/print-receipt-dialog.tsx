import { useMemo } from 'react';
import { Printer, Receipt as ReceiptIcon } from 'lucide-react';
import { Badge } from '@/components/ui/primitives';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type PrintMode = 'standard' | 'pos';

const DEFAULT_STORAGE_KEY = 'receipt-print-mode';

/**
 * How long the dialog's own fade-out takes to finish. Printing waits for it:
 * a dialog still on screen when the browser prints would come out on the
 * paper, ahead of the receipt.
 */
const DIALOG_CLOSE_MS = 300;

function readLastMode(storageKey: string): PrintMode | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === 'pos' || value === 'standard' ? value : null;
  } catch {
    return null;
  }
}

function rememberMode(storageKey: string, mode: PrintMode) {
  try {
    window.localStorage.setItem(storageKey, mode);
  } catch {
    // A browser that will not store it just asks without the hint.
  }
}

const OPTIONS: {
  mode: PrintMode;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    mode: 'standard',
    title: 'Standard printout',
    description: 'The full document on A4 or half-sheet paper, with the school header and colours.',
    icon: <Printer className="size-5" aria-hidden="true" />,
  },
  {
    mode: 'pos',
    title: 'POS receipt (78mm)',
    description: 'A narrow black-and-white slip for a thermal roll printer, sized to fit its content.',
    icon: <ReceiptIcon className="size-5" aria-hidden="true" />,
  },
];

/**
 * Asks which shape of document to print, then prints it — shared by receipts
 * and invoices, the two documents a school prints at a desk often enough to
 * want a thermal-roll copy as well as a full page.
 *
 * Choosing an option is the whole interaction — no separate confirm button —
 * because at a desk this happens for every payment, and the answer is nearly
 * always the same one as last time, which is marked and remembered per
 * `storageKey` — a receipt's preference and an invoice's stay separate,
 * since a desk that always POS-prints receipts may still want full-page
 * invoices to hand out.
 */
export function PrintReceiptDialog({
  open,
  onOpenChange,
  onPrint,
  title = 'Print receipt',
  storageKey = DEFAULT_STORAGE_KEY,
  dataCyPrefix = 'finance-receipt-print',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrint: (mode: PrintMode) => void;
  title?: string;
  storageKey?: string;
  dataCyPrefix?: string;
}) {
  const lastMode = useMemo(() => (open ? readLastMode(storageKey) : null), [open, storageKey]);

  const choose = (mode: PrintMode) => {
    rememberMode(storageKey, mode);
    onOpenChange(false);
    window.setTimeout(() => onPrint(mode), DIALOG_CLOSE_MS);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Choose the kind of printer this is going to.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          {OPTIONS.map((option) => (
            <button
              key={option.mode}
              type="button"
              data-cy={`${dataCyPrefix}-${option.mode}`}
              onClick={() => choose(option.mode)}
              className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="mt-0.5 text-muted-foreground">{option.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{option.title}</span>
                  {lastMode === option.mode && <Badge tone="info">Last used</Badge>}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
