import { createPortal } from 'react-dom';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Invoice } from '@/types/finance';
import type { AccountSummaryRow } from './account-summary';
import { POS_WIDTH_MM } from './pos-print';
import { carriedRows } from './carried-rows';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span>{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function Rule() {
  return <hr className="my-[1.5mm] border-0 border-t border-dashed border-black" />;
}

/**
 * A bill for a thermal (POS) printer: one narrow column, black on white, same
 * reasoning as `PosReceipt` — a thermal head has one tone, and this is handed
 * to a family at a desk far more often than it is mailed.
 *
 * Rendered into `document.body` through the same `.pos-receipt-root` portal
 * `PosReceipt` uses (see `pos-print.ts`): only one of the two is ever mounted
 * at a time, since a receipt and an invoice are different pages, so sharing
 * the selector needs no extra CSS.
 */
export function InvoicePos({
  record,
  accountSummary,
}: {
  record: Invoice;
  accountSummary: AccountSummaryRow[];
}) {
  // A discount keyed straight onto a charge has no name the way a ticked one
  // does — whatever of `discountTotal` the named rows below don't already
  // account for is shown as one line, so the summary is never short of it.
  const unnamedDiscountTotal =
    record.discountTotal - record.appliedDiscounts.reduce((sum, entry) => sum + entry.amount, 0);

  return createPortal(
    <div
      data-cy="finance-invoice-pos"
      className="pos-receipt-root text-[11px] leading-[1.35]"
      style={{
        width: `${POS_WIDTH_MM}mm`,
        padding: '4mm 4mm 8mm',
        fontFamily: 'ui-sans-serif, system-ui, Arial, sans-serif',
      }}
    >
      <div className="text-center">
        <p className="text-[14px] font-extrabold uppercase leading-tight">{record.schoolName}</p>
        {record.schoolAddress && <p className="mt-[1mm] text-[10px]">{record.schoolAddress}</p>}
        <p className="mt-[2mm] text-[12px] font-bold tracking-wide">INVOICE</p>
        <p className="font-mono text-[11px] font-semibold">{record.invoiceNo}</p>
      </div>

      <Rule />

      <div className="space-y-[0.6mm]">
        <Row label="Billed to" value={record.studentName} />
        <Row label="Adm. no." value={record.admissionNo} />
        <Row label="Class" value={record.className ?? '—'} />
        <Row label="Term" value={`${record.termName} · ${record.sessionName}`} />
        <Row label="Issued" value={formatDate(record.issueDate)} />
        <Row label="Due" value={formatDate(record.dueDate)} />
      </div>

      <Rule />

      <p className="mb-[1mm] text-[10px] font-semibold uppercase tracking-wide">Charges</p>
      <div className="space-y-[1.2mm]">
        {record.lines
          .filter((line) => !line.carriedFromInvoiceId)
          .map((line) => (
          <div key={line.id}>
            <div className="flex items-start justify-between gap-2">
              <span>
                {line.description}
                {line.isOptional ? ' (opt.)' : ''}
              </span>
              <span className="tabular-nums">
                {formatCurrency(line.lineTotal, 'NGN', { showDecimals: false })}
              </span>
            </div>
            {line.discountAmount > 0 && (
              <p className="text-[9px] italic">
                {formatCurrency(line.unitAmount * line.quantity, 'NGN', { showDecimals: false })}{' '}
                less {formatCurrency(line.discountAmount, 'NGN', { showDecimals: false })} discount
              </p>
            )}
            {line.amountPaid > 0 && (
              <p className="text-[9px] italic">
                {formatCurrency(line.amountPaid, 'NGN', { showDecimals: false })} paid
                {line.balance > 0 ? ' · part payment' : ''}
              </p>
            )}
          </div>
        ))}
      </div>

      {record.carriedFrom.map((source) => (
        <div key={source.invoiceId} className="mt-[1.5mm] space-y-[1.2mm]">
          <p className="text-[10px] font-semibold uppercase tracking-wide">
            Brought forward from {source.invoiceNo}
          </p>
          {carriedRows(source).map((row) => (
            <div key={row.key}>
              <div className="flex items-start justify-between gap-2">
                <span>{row.label}</span>
                <span className="tabular-nums">
                  {row.balance < 0 ? '− ' : ''}
                  {formatCurrency(Math.abs(row.balance), 'NGN', { showDecimals: false })}
                </span>
              </div>
              {row.billed !== null && row.paid !== null && row.paid > 0 && (
                <p className="text-[9px] italic">
                  {formatCurrency(row.billed, 'NGN', { showDecimals: false })} billed ·{' '}
                  {formatCurrency(row.paid, 'NGN', { showDecimals: false })} paid
                </p>
              )}
            </div>
          ))}
        </div>
      ))}

      <Rule />

      <div className="space-y-[0.6mm]">
        <Row label="Subtotal" value={formatCurrency(record.subtotal, 'NGN', { showDecimals: false })} />
        {record.appliedDiscounts.map((discount) => (
          <Row
            key={discount.discountId}
            label={discount.name}
            value={`− ${formatCurrency(discount.amount, 'NGN', { showDecimals: false })}`}
          />
        ))}
        {unnamedDiscountTotal > 0 && (
          <Row
            label="Charge discounts"
            value={`− ${formatCurrency(unnamedDiscountTotal, 'NGN', { showDecimals: false })}`}
          />
        )}
        {record.broughtForward > 0 && (
          <Row
            label="Brought forward"
            value={formatCurrency(record.broughtForward, 'NGN', { showDecimals: false })}
          />
        )}
        <Row label="Total" value={formatCurrency(record.total, 'NGN', { showDecimals: false })} />
        <Row label="Paid" value={formatCurrency(record.amountPaid, 'NGN', { showDecimals: false })} />
      </div>

      <Rule />

      <Row
        label="Balance due"
        value={<span className="tabular-nums">{formatCurrency(record.balance, 'NGN')}</span>}
      />

      {accountSummary.length > 0 && (
        <>
          <Rule />
          <p className="mb-[1mm] text-[10px] font-semibold uppercase tracking-wide">Pay into</p>
          <div className="space-y-[1.2mm]">
            {accountSummary.map((row) => (
              <div key={row.key}>
                <p className="font-semibold">{row.label || row.bankName}</p>
                <p className="text-[10px]">
                  {row.label ? `${row.bankName} · ` : ''}
                  {row.accountNumber} · {row.accountName}
                </p>
                <div className="flex items-start justify-between gap-2 text-[10px]">
                  <span>{row.mandatory > 0 ? 'Amount' : 'Optional'}</span>
                  <span className="tabular-nums">
                    {formatCurrency(row.mandatory > 0 ? row.mandatory : row.optional, 'NGN', {
                      showDecimals: false,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {record.note && (
        <>
          <Rule />
          <p className="whitespace-pre-line text-[10px]">{record.note}</p>
        </>
      )}

      <Rule />

      <div className="text-center text-[10px]">
        <p>Questions about this bill?</p>
        {(record.schoolPhone || record.schoolEmail) && (
          <p>{[record.schoolPhone, record.schoolEmail].filter(Boolean).join(' · ')}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
