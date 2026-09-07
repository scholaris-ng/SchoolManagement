import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';

/**
 * A genuine, scannable QR code.
 *
 * Printed report cards, transcripts and receipts carry one so a third party can
 * confirm the document at `/verify/:code` without phoning the school. It encodes
 * only that public URL — never anything about the child (spec section 22).
 *
 * Rendered as an SVG data URI so it prints crisply at any size and needs no
 * canvas, which some print pipelines rasterise badly.
 */
export function QrCode({
  value,
  size = 96,
  className,
  label = 'Scan to verify this document',
}: {
  value: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 0,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  // If encoding fails we show nothing rather than a decorative square: a mark
  // that looks like a QR code but does not scan is worse than no mark at all.
  if (failed || !svg) {
    return <div style={{ width: size, height: size }} className={className} aria-hidden="true" />;
  }

  return (
    <div
      className={cn('shrink-0 bg-white p-1', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
