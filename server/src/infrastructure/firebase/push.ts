import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { getFirebaseApp, isFirebaseConfigured } from './firebaseAdmin';

/**
 * Web push over Firebase Cloud Messaging.
 *
 * Sending needs nothing beyond the service-account credentials Auth already
 * uses — the VAPID key belongs to the browser, which presents it when asking
 * FCM for a registration token, and never reaches the server.
 *
 * Behind the same synchronous credential guard as `firebaseAdmin.ts`: an
 * unguarded Admin SDK call with no credentials available rejects on a promise
 * outside the awaited chain and takes the process down with it.
 */

let messaging: Messaging | null = null;

function getPushMessaging(): Messaging {
  if (messaging) return messaging;
  messaging = getMessaging(getFirebaseApp());
  return messaging;
}

export interface PushPayload {
  title: string;
  body: string;
  /** A client route. The service worker uses it to decide where a tap lands. */
  actionUrl?: string | null;
  category?: string;
}

export interface PushResult {
  sent: number;
  /** Tokens FCM rejected as permanently dead, for the caller to delete. */
  deadTokens: string[];
}

/**
 * Fans one payload out to many devices.
 *
 * Never throws for a delivery failure. A push is a courtesy copy of a
 * notification that is already saved and already visible in the app — losing it
 * must not fail the operation that caused it.
 */
export async function sendPushToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<PushResult> {
  if (tokens.length === 0) return { sent: 0, deadTokens: [] };
  if (!isFirebaseConfigured()) return { sent: 0, deadTokens: [] };

  try {
    const response = await getPushMessaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      // The service worker reads these; `notification.click_action` is not
      // available for web the way it is on mobile, so the route travels as data.
      data: {
        actionUrl: payload.actionUrl ?? '',
        category: payload.category ?? '',
      },
      webpush: {
        fcmOptions: payload.actionUrl ? { link: payload.actionUrl } : undefined,
      },
    });

    const deadTokens: string[] = [];
    response.responses.forEach((result, index) => {
      if (result.success) return;
      const code = (result.error as { code?: string } | undefined)?.code;
      // A browser that cleared its site data, or an uninstalled app. The token
      // will never work again, so it is pruned rather than retried forever.
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument'
      ) {
        deadTokens.push(tokens[index]);
      }
    });

    return { sent: response.successCount, deadTokens };
  } catch (error) {
    console.error('[push] Send failed:', error);
    return { sent: 0, deadTokens: [] };
  }
}
