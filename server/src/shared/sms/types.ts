/** One text message, ready for any provider to deliver. */
export interface SmsMessage {
  /** International digits, no `+` — what `toInternationalDigits()` returns. */
  to: string;
  text: string;
}

/** What a provider reports back once the gateway has accepted a message. */
export interface SmsSendResult {
  /** The gateway's own reference for the message, when it gives one. */
  providerMessageId: string | null;
  /** The gateway's reply, kept verbatim on the log row for anyone diagnosing a failure. */
  raw: unknown;
}

/**
 * A text-message transport. `SmsService` never imports a vendor client
 * directly — only this shape — so the provider behind `send()` can be swapped
 * in `router.ts` without touching the senders (birthday greetings, and
 * whatever comes next) or their call sites. Mirrors `shared/mail/types.ts`.
 */
export interface SmsProvider {
  /** Recorded on every log row, so the history still makes sense after a provider change. */
  readonly name: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
  /** Remaining credit in the provider's own units, or `null` when it cannot say. */
  balance(): Promise<number | null>;
}

/**
 * The gateway refused, or answered something we could not read. `code` is the
 * provider's own code (KudiSMS's `error_code`, for instance) so a log row can
 * be matched against the vendor's documentation without guesswork.
 */
export class SmsProviderError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
    readonly raw: unknown = null,
    /**
     * Whether the message itself was the problem (a number the network
     * rejects, a blocked word, too long) rather than the platform's account
     * with the gateway (bad key, unapproved sender ID, no credit). A school
     * is told the first in full; the second is the platform's to fix, and
     * the school only needs to know sending is unavailable for now.
     */
    readonly aboutMessage = false,
  ) {
    super(message);
    this.name = 'SmsProviderError';
  }
}
