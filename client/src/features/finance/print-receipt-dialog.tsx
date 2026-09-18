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

const LAST_MODE_KEY = 'receipt-print-mode';

/**
 * How long the dialog's own fade-out takes to finish. Printing waits for it:
 * a dialog still on screen when the browser prints would come out on the
 * paper, ahead of the receipt.
 */
const DIALOG_CLOSE_MS = 300;

function readLastMode(): PrintMode | null {
  try {
    const value = window.localStorage.getItem(LAST_MODE_KEY);
    return value === 'pos' || value === 'standard' ? value : null;
  } catch {
    return null;
  }
}

function rememberMode(mode: PrintMode) {
  try {
    window.localStorage.setItem(LAST_MODE_KEY, mode);
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
    description: 'The full receipt on A4 or half-sheet paper, with the school header and colours.',
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
 * Asks which shape of receipt to print, then prints it.
 *
 * Choosing an option is the whole interaction — no separate confirm button —
 * because at a desk this happens for every payment, and the answer is nearly
 * always the same one as last time, which is marked and remembered.
 */
export function PrintReceiptDialog({
  open,
  onOpenChange,
  onPrint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrint: (mode: PrintMode) => void;
}) {
  const lastMode = useMemo(() => (open ? readLastMode() : null), [open]);

  const choose = (mode: PrintMode) => {
    rememberMode(mode);
    onOpenChange(false);
    window.setTimeout(() => onPrint(mode), DIALOG_CLOSE_MS);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Print receipt</DialogTitle>
          <DialogDescription>Choose the kind of printer this is going to.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          {OPTIONS.map((option) => (
            <button
              key={option.mode}
              type="button"
              data-cy={`finance-receipt-print-${option.mode}`}
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
