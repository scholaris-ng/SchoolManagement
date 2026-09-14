/**
 * How much to send to each payment account across a whole document.
 *
 * A charge can accept more than one account (`fee-structure-dialog.tsx`), so
 * reading "pay into" line by line leaves a family to add it all up
 * themselves — this is the other direction: for each account that appears
 * anywhere on the document, what its own total comes to, so a transfer into
 * any one of them can be made in a single amount.
 *
 * Grouped by bank name and account number rather than an account's own id:
 * the same physical account is sometimes entered separately against more
 * than one fee item (`fee-item-dialog.tsx` has no cross-item dedup), and two
 * such rows should still combine into one line here.
 */

export interface AccountLike {
  label?: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface AccountSummaryRow extends AccountLike {
  key: string;
  /** Charges actually billed (or, on a fee structure, billed to everyone in scope). */
  mandatory: number;
  /** Charges that only apply to some families — kept apart rather than folded in. */
  optional: number;
}

export function summarizeByAccount<T extends { isOptional: boolean; accounts: AccountLike[] }>(
  lines: T[],
  amountOf: (line: T) => number,
): AccountSummaryRow[] {
  const byKey = new Map<string, AccountSummaryRow>();

  for (const line of lines) {
    const amount = amountOf(line);
    for (const account of line.accounts) {
      const key = `${account.bankName}::${account.accountNumber}`;
      const row = byKey.get(key) ?? {
        key,
        label: account.label ?? null,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        mandatory: 0,
        optional: 0,
      };
      if (line.isOptional) row.optional += amount;
      else row.mandatory += amount;
      byKey.set(key, row);
    }
  }

  return Array.from(byKey.values());
}
