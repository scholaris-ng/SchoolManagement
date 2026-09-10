import { http } from './http';
import type { OutboxEntry } from './outbox.types';

/**
 * Replaying one queued mutation, and the id every entry is filed under.
 *
 * Every entry carries an idempotency key so replay after an ambiguous failure
 * cannot double-post a payment or duplicate a register.
 */

export function send(entry: OutboxEntry): Promise<unknown> {
  const options = { headers: { 'Idempotency-Key': entry.idempotencyKey } };
  switch (entry.method) {
    case 'POST':
      return http.post(entry.path, entry.body, options);
    case 'PATCH':
      return http.patch(entry.path, entry.body, options);
    case 'PUT':
      return http.put(entry.path, entry.body, options);
    case 'DELETE':
      return http.delete(entry.path, options);
  }
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `ob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
