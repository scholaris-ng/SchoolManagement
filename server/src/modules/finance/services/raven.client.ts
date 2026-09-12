import { env } from '../../../config/env';
import { AppError } from '../../../shared/errors/AppError';

/**
 * A thin client for the handful of Raven Atlas calls the fees flow needs
 * (https://raven-atlas.readme.io). Nothing here knows about students or
 * schools — it speaks Raven's shapes and nothing else, so the service above it
 * is the only place that has to reconcile the two.
 *
 * Amounts are passed through exactly as Raven reports them. Their reference
 * quotes whole naira in `generate_account` examples, and the same for
 * collection records; nothing is scaled here, and nothing should be until
 * that is confirmed against a live credit rather than assumed.
 */

export interface RavenCollectionAccount {
  account_number: string;
  account_name: string;
  bank: string;
  customer: { email: string; first_name: string; last_name: string; phone: string };
  isPermanent: boolean;
  amount: string;
}

/** One credit into a collection account, as Raven records it. */
export interface RavenCollection {
  id: number;
  session_id: string;
  account_number: string;
  amount: number;
  fee?: number;
  stamp_duty?: number;
  currency?: string;
  email?: string;
  bank?: string | null;
  /** Raven stores the sender's details as a JSON string, not an object. */
  source?: string | null;
  verified?: number;
  created_at: string;
  updated_at?: string;
}

interface RavenEnvelope<T> {
  status: 'success' | 'fail' | string;
  message: string;
  data: T;
}

export class RavenClient {
  static Instance = new RavenClient();

  private constructor() {}

  get configured(): boolean {
    return env.raven.configured;
  }

  /**
   * A one-off collection account a family can transfer into. Raven ties it to
   * the customer named here and, being non-permanent, to the amount — which is
   * why one is generated per bill rather than once per student.
   */
  async generateCollectionAccount(input: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    amount: number;
    /** Undocumented in Raven's reference, but their partner refuses without it. */
    bvn: string;
  }): Promise<RavenCollectionAccount> {
    return this.request<RavenCollectionAccount>('POST', '/pwbt/generate_account', {
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      email: input.email,
      amount: String(input.amount),
      bvn: input.bvn,
    });
  }

  /**
   * The authoritative record of one credit. A webhook only tells us *that*
   * something happened; this is what tells us what, from Raven's own books,
   * before a single naira is written to ours.
   */
  async fetchCollectionBySessionId(sessionId: string): Promise<RavenCollection | null> {
    const data = await this.request<RavenCollection | RavenCollection[] | null>(
      'GET',
      `/collection-session-id?session_id=${encodeURIComponent(sessionId)}`,
    );
    if (!data) return null;
    // Raven has answered this with a single object in one place and a list in
    // another; take the one matching the session either way.
    const record = Array.isArray(data) ? data.find((row) => row.session_id === sessionId) : data;
    return record ?? null;
  }

  /** Registers where Raven should post notifications, and the secret it echoes back. */
  async updateWebhook(webhookUrl: string, webhookSecretKey: string): Promise<void> {
    await this.request('POST', '/webhooks/update', {
      webhook_url: webhookUrl,
      webhook_secret_key: webhookSecretKey,
    });
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!env.raven.secretKey) {
      throw AppError.internal('Raven is not configured on this server (RAVEN_SECRET_KEY).');
    }

    let response: Response;
    try {
      response = await fetch(`${env.raven.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${env.raven.secretKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw AppError.internal(
        `Could not reach Raven: ${error instanceof Error ? error.message : 'network error'}`,
      );
    }

    const text = await response.text();
    let envelope: RavenEnvelope<T> | null = null;
    try {
      envelope = text ? (JSON.parse(text) as RavenEnvelope<T>) : null;
    } catch {
      envelope = null;
    }

    if (!response.ok || !envelope || envelope.status !== 'success') {
      const detail = envelope?.message ?? (text ? text.slice(0, 200) : `HTTP ${response.status}`);
      throw AppError.internal(`Raven refused the request: ${detail}`);
    }

    return envelope.data;
  }
}
