import { useEffect } from 'react';
import type { PrintMode } from './print-receipt-dialog';

/** The width of a thermal roll's printable area, for the `@page` rule and the layout. */
export const POS_WIDTH_MM = 78;

/** Selector the print handler measures before sizing the page to it — shared by every POS copy (receipt, invoice, …), since only one is ever mounted at a time. */
export const POS_RECEIPT_SELECTOR = '.pos-receipt-root';

const POS_PAGE_STYLE_ID = 'pos-page-style';

/**
 * Sends a document to the printer in one of two shapes: the ordinary page, or
 * a narrow copy for a POS thermal roll — shared by the receipt and invoice
 * print flows so both size a POS print off the same measured-height logic.
 *
 * The mode is a `data-print-mode` attribute on the body — the print CSS in
 * `index.css` reads it to decide what appears on paper — and it is cleared
 * again once printing is over, so a later Ctrl+P is an ordinary print.
 *
 * A POS print also sets the paper size, to the roll's width and the height of
 * the copy itself: a fixed length would either cut a long document in two or
 * feed a short one out with a blank tail. `@page` cannot be scoped by a
 * selector, which is why it is injected for the print and removed after.
 */
export function usePrintMode(posSelector: string = POS_RECEIPT_SELECTOR, posWidthMm: number = POS_WIDTH_MM) {
  useEffect(() => {
    const reset = () => {
      delete document.body.dataset.printMode;
      document.getElementById(POS_PAGE_STYLE_ID)?.remove();
    };
    window.addEventListener('afterprint', reset);
    return () => {
      window.removeEventListener('afterprint', reset);
      reset();
    };
  }, []);

  return (mode: PrintMode) => {
    document.body.dataset.printMode = mode;
    document.getElementById(POS_PAGE_STYLE_ID)?.remove();

    if (mode === 'pos') {
      const copy = document.querySelector<HTMLElement>(posSelector);
      // CSS pixels to millimetres, plus a little slack: a page a hair too short
      // spills its last line onto a second, otherwise blank, page.
      const heightMm = copy ? Math.ceil((copy.getBoundingClientRect().height * 25.4) / 96) + 4 : 200;
      const style = document.createElement('style');
      style.id = POS_PAGE_STYLE_ID;
      style.textContent = `@page { size: ${posWidthMm}mm ${heightMm}mm; margin: 0; }`;
      document.head.appendChild(style);
    }

    window.print();
  };
}
