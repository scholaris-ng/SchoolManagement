import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrintReceiptDialog, type PrintMode } from './print-receipt-dialog';

function Harness({ onPrint }: { onPrint: (mode: PrintMode) => void }) {
  const [open, setOpen] = useState(true);
  return <PrintReceiptDialog open={open} onOpenChange={setOpen} onPrint={onPrint} />;
}

describe('PrintReceiptDialog', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it('offers both shapes of receipt', () => {
    render(<Harness onPrint={vi.fn()} />);

    expect(screen.getByRole('button', { name: /standard printout/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pos receipt \(78mm\)/i })).toBeInTheDocument();
  });

  it('prints in the chosen mode, but only once the dialog has closed', async () => {
    const onPrint = vi.fn();
    render(<Harness onPrint={onPrint} />);

    await userEvent.click(screen.getByRole('button', { name: /pos receipt \(78mm\)/i }));

    // Not straight away: a dialog still on screen would print with the receipt.
    expect(onPrint).not.toHaveBeenCalled();
    await waitFor(() => expect(onPrint).toHaveBeenCalledWith('pos'), { timeout: 1500 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks the last choice next time it opens', async () => {
    const first = render(<Harness onPrint={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /standard printout/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    first.unmount();

    render(<Harness onPrint={vi.fn()} />);
    const standard = screen.getByRole('button', { name: /standard printout/i });
    expect(standard).toHaveTextContent('Last used');
    expect(screen.getByRole('button', { name: /pos receipt/i })).not.toHaveTextContent('Last used');
  });
});
