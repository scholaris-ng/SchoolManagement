import { clampReceiptBalance, reversalRefusal } from '../services/payments.service';

describe('clampReceiptBalance', () => {
  it('keeps a normal positive balance unchanged', () => {
    expect(clampReceiptBalance(125_000)).toBe(125_000);
  });

  it('turns negative balances into zero on a receipt', () => {
    expect(clampReceiptBalance(-327_500)).toBe(0);
  });

  it('handles invalid numeric values safely', () => {
    expect(clampReceiptBalance(Number.NaN)).toBe(0);
  });
});

describe('reversalRefusal', () => {
  const reversible = { status: 'SUCCESSFUL', provider: 'MANUAL', isReconciled: false } as const;

  it('allows an unreconciled desk payment to be reversed', () => {
    expect(reversalRefusal(reversible)).toBeNull();
  });

  it('refuses a payment that has already been reversed', () => {
    expect(reversalRefusal({ ...reversible, status: 'REVERSED' })).toMatch(/already been reversed/);
  });

  it.each(['PENDING', 'FAILED'] as const)('refuses a %s payment, which has nothing to undo', (status) => {
    expect(reversalRefusal({ ...reversible, status })).toMatch(/successful payment/);
  });

  it('refuses a Raven credit, which only the bank can move back', () => {
    expect(reversalRefusal({ ...reversible, provider: 'RAVEN' })).toMatch(/through the bank/);
  });

  it('refuses a payment that has been reconciled against the bank statement', () => {
    expect(reversalRefusal({ ...reversible, isReconciled: true })).toMatch(/reconciled/);
  });

  it('reports a reversed payment as reversed even when it was also reconciled', () => {
    expect(reversalRefusal({ ...reversible, status: 'REVERSED', isReconciled: true })).toMatch(
      /already been reversed/,
    );
  });
});
