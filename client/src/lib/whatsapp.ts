const MOBILE = /Android|iPhone|iPad|iPod/i;

/**
 * The address that opens WhatsApp with a message already typed.
 *
 * At a desk, with a number, `web.whatsapp.com/send` goes straight to WhatsApp
 * Web with that chat open and the text in the box — the person only presses
 * Send. On a phone that address is a detour, so `wa.me` is used there: it is
 * WhatsApp's own universal link and opens the app. With no number to go on
 * `wa.me` is used everywhere, because WhatsApp then asks who to send it to and
 * `web.whatsapp.com/send` has no such step.
 */
export function whatsAppUrl(
  target: { phone: string | null; message: string },
  userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): string {
  const text = encodeURIComponent(target.message);
  if (!target.phone) return `https://wa.me/?text=${text}`;

  const phone = encodeURIComponent(target.phone);
  return MOBILE.test(userAgent)
    ? `https://wa.me/${phone}?text=${text}`
    : `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;
}

/**
 * What the new tab shows while the document is being saved and the message
 * written — a second or two, during which it would otherwise be a blank page.
 *
 * A whole page of its own because that tab is `about:blank`, outside the app's
 * stylesheet: everything it needs is inline, and it follows the browser's light
 * or dark setting since it cannot follow the app's.
 */
export const WHATSAPP_PENDING_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Opening WhatsApp…</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 6px; padding: 24px; text-align: center;
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #f8fafc; color: #0f172a;
  }
  .spinner {
    width: 40px; height: 40px; margin-bottom: 14px; border-radius: 50%;
    border: 3px solid #e2e8f0; border-top-color: #25d366;
    animation: spin 0.8s linear infinite;
  }
  h1 { margin: 0; font-size: 18px; font-weight: 600; }
  p { margin: 0; max-width: 24em; color: #64748b; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2.4s; } }
  @media (prefers-color-scheme: dark) {
    body { background: #0b1220; color: #e2e8f0; }
    .spinner { border-color: #1e293b; border-top-color: #25d366; }
    p { color: #94a3b8; }
  }
</style>
</head>
<body>
  <div class="spinner" role="status" aria-label="Loading"></div>
  <h1>Preparing your message</h1>
  <p>Saving the document so a link can go in the message. WhatsApp will open here in a moment.</p>
</body>
</html>`;
