import { clampReceiptBalance } from '../services/payments.service';

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
