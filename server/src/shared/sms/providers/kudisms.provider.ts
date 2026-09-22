import type { SmsMessage, SmsProvider, SmsSendResult } from '../types';
import { SmsProviderError } from '../types';

export interface KudismsConfig {
  apiKey: string;
  senderId: string;
  gateway?: string;
  baseUrl: string;
}

/**
 * KudiSMS's documented response codes, in words — the gateway's `msg` is
 * often terse, and the code is what their support asks for.
 */
const ERROR_MESSAGES: Record<string, string> = {
  '000': 'Message received successfully',
  '009': 'A message may be at most 6 SMS pages long',
  '100': 'The KudiSMS API key is invalid',
  '101': 'The KudiSMS account is deactivated',
  '103': 'The gateway selected does not exist',
  '104': 'The message contains a blocked keyword',
  '105': 'The sender ID is blocked',
  '106': 'The sender ID does not exist on this KudiSMS account',
  '107': 'The phone number is invalid',
  '108': 'Too many recipients in one request (the batch limit is 100)',
  '109': 'Insufficient KudiSMS credit balance',
  '111': 'Only an approved promotional sender ID may be used on this route',
  '114': 'No package is attached to the KudiSMS account',
  '187': 'KudiSMS could not process the request',
  '188': 'The sender ID has not been approved yet',
  '300': 'A required parameter was missing',
  '401': 'KudiSMS could not complete the request',
};

/** The codes that say something about the message, not about the account — see `SmsProviderError.aboutMessage`. */
const MESSAGE_FAULT_CODES = new Set(['009', '104', '107', '108']);

/** How long to wait on the gateway before giving up on one message. */
const REQUEST_TIMEOUT_MS = 15_000;

interface KudismsReply {
  status?: string;
  error_code?: string | number;
  msg?: string;
  message?: string;
  data?: unknown;
  balance?: string | number;
  [key: string]: unknown;
}

/**
 * KudiSMS HTTP API v2 (`https://my.kudisms.net/api`).
 *
 * `POST /sms` with fields `token`, `senderID`, `recipients` (comma separated
 * international digits), `message` and optionally `gateway`; the reply is
 * JSON with `status` (`success` | `error`), `error_code` (`000` on success)
 * and `msg`. One recipient per call here: every message this app sends is
 * personalised, so the 100-recipient batch form never applies.
 *
 * The fields go as `multipart/form-data`. Tried by hand: KudiSMS reads
 * multipart, JSON and a GET query string, but answers a urlencoded POST body
 * with "missing parameters" — so do not "simplify" this to `URLSearchParams`.
 */
export class KudismsProvider implements SmsProvider {
  readonly name = 'kudisms';

  constructor(private readonly config: KudismsConfig) {}

  async send({ to, text }: SmsMessage): Promise<SmsSendResult> {
    const form = new FormData();
    form.set('token', this.config.apiKey);
    form.set('senderID', this.config.senderId);
    form.set('recipients', to);
    form.set('message', text);
    if (this.config.gateway) form.set('gateway', this.config.gateway);

    const reply = await this.call('/sms', form);
    if (reply.status !== 'success') {
      throw this.errorFrom(reply);
    }

    return {
      providerMessageId: extractMessageId(reply),
      raw: reply,
    };
  }

  async balance(): Promise<number | null> {
    const form = new FormData();
    form.set('token', this.config.apiKey);
    const reply = await this.call('/balance', form);
    if (reply.status !== 'success') throw this.errorFrom(reply);
    const nested = (reply.data as { balance?: unknown } | undefined)?.balance;
    const value = Number(reply.balance ?? nested);
    return Number.isFinite(value) ? value : null;
  }

  private async call(path: string, form: FormData): Promise<KudismsReply> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        // No Content-Type: fetch sets the multipart boundary itself.
        headers: { Accept: 'application/json' },
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new SmsProviderError(`Could not reach KudiSMS: ${reason}`);
    }

    const body = await response.text();
    let reply: KudismsReply;
    try {
      reply = JSON.parse(body) as KudismsReply;
    } catch {
      throw new SmsProviderError(
        `KudiSMS answered ${response.status} with a non-JSON body`,
        String(response.status),
        body.slice(0, 500),
      );
    }

    // KudiSMS reports most refusals with a 200 and `status: "error"`, but a
    // bad key can come back as a 401 — treat any non-2xx the same way.
    if (!response.ok && reply.status !== 'success') {
      throw this.errorFrom(reply, response.status);
    }
    return reply;
  }

  private errorFrom(reply: KudismsReply, httpStatus?: number): SmsProviderError {
    const code = reply.error_code === undefined ? null : String(reply.error_code).padStart(3, '0');
    const known = code ? ERROR_MESSAGES[code] : undefined;
    const vendor = reply.msg ?? reply.message;
    const fallback = httpStatus ? `KudiSMS answered HTTP ${httpStatus}` : 'KudiSMS refused the message';
    const message = known ?? vendor ?? fallback;
    return new SmsProviderError(
      vendor && known && vendor !== known ? `${message} (${vendor})` : message,
      code ?? (httpStatus ? String(httpStatus) : null),
      reply,
      code !== null && MESSAGE_FAULT_CODES.has(code),
    );
  }
}

/** KudiSMS has not settled on one field for the reference; take whichever it sent. */
function extractMessageId(reply: KudismsReply): string | null {
  const data = reply.data;
  const nested = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const candidates: unknown[] = [
    reply['msg_id'],
    reply['message_id'],
    reply['messageId'],
    nested['msg_id'],
    nested['message_id'],
    typeof data === 'string' ? data : undefined,
  ];
  const found = candidates.find((value) => typeof value === 'string' || typeof value === 'number');
  return found === undefined ? null : String(found);
}
