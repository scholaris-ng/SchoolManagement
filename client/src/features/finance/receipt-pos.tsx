import { createPortal } from 'react-dom';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { QrCode } from '@/components/data/qr-code';
import type { Receipt } from '@/types/finance';

/** The width of the roll's printable area, for the `@page` rule and the layout. */
export const POS_WIDTH_MM = 78;

/** Selector the print handler uses to measure the copy it is about to print. */
export const POS_RECEIPT_SELECTOR = '.pos-receipt-root';

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
 * A receipt for a thermal (POS) printer: one narrow column, black on white, no
 * greys or brand colour — a thermal head has one tone, and a mid-grey turns to
 * either nothing or a smudge.
 *
 * Rendered into `document.body` rather than inside the page, so the app
 * shell's padding and the page container's width cannot narrow it: a receipt
 * squeezed into a 78mm page by a wider layout was exactly what came out
 * unreadable. It is always laid out, but held off-screen (see `index.css`)
 * until a POS print is asked for, so its height can be measured to size the
 * paper to it.
 */
export function PosReceipt({
  record,
  verifyUrl,
  showItems,
}: {
  record: Receipt;
  verifyUrl: string;
  showItems: boolean;
}) {
  return createPortal(
    <div
      data-cy="finance-receipt-pos"
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
        <p className="mt-[2mm] text-[12px] font-bold tracking-wide">PAYMENT RECEIPT</p>
        <p className="font-mono text-[11px] font-semibold">{record.receiptNo}</p>
      </div>

      <Rule />

      <div className="space-y-[0.6mm]">
        <Row label="Date" value={formatDateTime(record.paidAt)} />
        <Row label="Received from" value={record.studentName} />
        <Row label="Adm. no." value={record.admissionNo} />
        <Row label="Class" value={record.className ?? '—'} />
        <Row label="Method" value={humanizeEnum(record.method)} />
        <Row label="Received by" value={record.receivedByName} />
      </div>

      <Rule />

      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide">Amount received</p>
        <p className="text-[20px] font-extrabold leading-tight tabular-nums">
          {formatCurrency(record.amount, 'NGN')}
        </p>
        <p className="mt-[0.5mm] text-[10px] capitalize">{record.amountInWords}</p>
      </div>

      {record.allocations.length > 0 && (
        <>
          <Rule />
          <p className="mb-[1mm] text-[10px] font-semibold uppercase tracking-wide">Applied to</p>
          <div className="space-y-[1.2mm]">
            {record.allocations.map((allocation, index) => (
                <div key={index}>
                  <p className="font-mono text-[10px] font-semibold">{allocation.invoiceNo}</p>
                  <div className="flex items-start justify-between gap-2">
                    <span>{allocation.description}</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(allocation.amount, 'NGN', { showDecimals: false })}
                    </span>
                  </div>
                  {showItems &&
                    allocation.lines.map((line, lineIndex) => (
                      <div
                        key={lineIndex}
                        className="flex items-start justify-between gap-2 pl-[3mm] text-[10px]"
                      >
                        <span>
                          {line.description}
                          {line.isOptional ? ' (opt.)' : ''}
                        </span>
                        <span className="tabular-nums">
                          {formatCurrency(line.amount, 'NGN', { showDecimals: false })}
                        </span>
                      </div>
                    ))}
                </div>
            ))}
          </div>
        </>
      )}

      <Rule />

      <Row
        label="Balance after this payment"
        value={<span className="tabular-nums">{formatCurrency(record.balanceAfter, 'NGN')}</span>}
      />

      <Rule />

      <div className="flex flex-col items-center text-center">
        <QrCode value={verifyUrl} size={104} label="Scan to verify this receipt" />
        <p className="mt-[1.5mm] text-[10px]">
          Verification code <span className="font-mono font-semibold">{record.verificationCode}</span>
        </p>
        <p className="break-all text-[9px]">{verifyUrl}</p>
        <p className="mt-[2mm] text-[10px] font-semibold">Thank you</p>
      </div>
    </div>,
    document.body,
  );
}
