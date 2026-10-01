import { useEffect, useRef, useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { whatsAppUrl } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSupportSettings } from './api';

/** Matches `size-12`. */
const WIDGET_SIZE = 48;
/** Kept clear of the viewport edge so the button is never dragged fully out of reach. */
const EDGE_MARGIN = 8;
/** Pointer movement below this, in either axis, is a click rather than a drag. */
const DRAG_THRESHOLD = 5;

interface Position {
  x: number;
  y: number;
}

function clampToViewport({ x, y }: Position): Position {
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - WIDGET_SIZE - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - WIDGET_SIZE - EDGE_MARGIN);
  return { x: Math.min(Math.max(x, EDGE_MARGIN), maxX), y: Math.min(Math.max(y, EDGE_MARGIN), maxY) };
}

/**
 * A floating "report an issue" button, open to every signed-in persona and
 * draggable to wherever it isn't in the way — it starts bottom-right, but
 * nothing about the page underneath is fixed, so a widget nailed to one spot
 * is bound to sit on top of something eventually.
 *
 * There is no backend send: the message is handed to WhatsApp as a prefilled
 * `wa.me` link (the same approach the finance module uses to share receipts),
 * which the person's own WhatsApp sends when they press its own Send button.
 * Hidden entirely until a platform administrator has set a number — opening
 * WhatsApp with nobody on the other end would be worse than not offering it.
 */
export function SupportWidget() {
  const { user, membership } = useAuth();
  const settings = useSupportSettings();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  // Null until the first drag: before that, the button sits at its default
  // bottom-right corner via CSS, not a position computed from a viewport size
  // that may not match the one it's eventually read in.
  const [position, setPosition] = useState<Position | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  // A drag can leave the button anywhere; a resize afterward (rotating a
  // tablet, shrinking the window) must not leave it stranded off-screen.
  useEffect(() => {
    const onResize = () => setPosition((current) => (current ? clampToViewport(current) : current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const whatsappNumber = settings.data?.whatsappNumber;
  if (!whatsappNumber) return null;

  const send = () => {
    const text = [
      `Support request from ${user?.displayName ?? 'a user'}${membership ? ` at ${membership.schoolName}` : ''} (${user?.email ?? ''}):`,
      '',
      message.trim(),
    ].join('\n');
    window.open(whatsAppUrl({ phone: whatsappNumber, message: text }), '_blank', 'noopener');
    setOpen(false);
    setMessage('');
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved) {
      const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= DRAG_THRESHOLD;
      if (!moved) return;
      drag.moved = true;
    }
    setPosition(clampToViewport({ x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY }));
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    // The browser fires a click right after this pointerup; only swallow it
    // when the press actually dragged the button, so a plain tap still opens
    // the dialog and Enter/Space (no pointer events at all) always does too.
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
  };

  return (
    <>
      <Button
        variant="primary"
        size="icon"
        data-cy="support-widget-trigger"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          setOpen(true);
        }}
        style={position ? { left: position.x, top: position.y } : undefined}
        className={cn(
          'fixed z-40 size-12 touch-none cursor-grab rounded-full shadow-popover no-print active:cursor-grabbing',
          !position && 'bottom-5 right-5',
        )}
        aria-label="Report an issue or ask for help. Drag to move."
        title="Report an issue or ask for help — drag to move"
      >
        <LifeBuoy className="size-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm" data-cy="support-widget-dialog">
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
            <DialogDescription>
              Describe the problem or question. It opens in WhatsApp, addressed to our support team —
              press Send there to reach us.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Textarea
              autoFocus
              rows={5}
              maxLength={1000}
              placeholder="What's going wrong?"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              data-cy="support-widget-message"
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              data-cy="support-widget-send"
              disabled={!message.trim()}
              onClick={send}
            >
              Open WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
