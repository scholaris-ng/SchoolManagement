import { env } from '../../config/env';
import { KudismsProvider } from './providers/kudisms.provider';
import type { SmsProvider } from './types';

/**
 * Picks the SMS transport. KudiSMS is the only one today, so this is short;
 * it exists so that adding a second provider — or routing one school through
 * a different one, the way `mail/router.ts` does for Apps Script — changes
 * this file and nothing above it. `SmsService` and the senders behind it only
 * ever see the `SmsProvider` interface.
 *
 * `null` means "nothing is configured": callers then record the message as
 * not sent rather than pretending, and the settings screen can say so.
 */
let kudisms: KudismsProvider | null = null;

export function resolveSmsProvider(): SmsProvider | null {
  const config = env.sms.kudisms;
  if (!config.configured) return null;

  if (!kudisms) {
    kudisms = new KudismsProvider({
      apiKey: config.apiKey!,
      senderId: config.senderId!,
      gateway: config.gateway,
      baseUrl: config.baseUrl,
    });
  }
  return kudisms;
}

export interface SmsProviderStatus {
  configured: boolean;
  provider: string | null;
  senderId: string | null;
  /** The environment variables still unset, so the screen can say exactly what to fix. */
  missing: string[];
}

/** For the settings screen: which provider, and as whom, without exposing the key. */
export function describeSmsProvider(): SmsProviderStatus {
  const provider = resolveSmsProvider();
  const missing: string[] = [];
  if (!env.sms.kudisms.apiKey) missing.push('KUDISMS_API_KEY');
  if (!env.sms.kudisms.senderId) missing.push('KUDISMS_SENDER_ID');
  return {
    configured: provider !== null,
    provider: provider?.name ?? null,
    senderId: provider ? (env.sms.kudisms.senderId ?? null) : null,
    missing,
  };
}
