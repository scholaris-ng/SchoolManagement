import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { CollectionEvent } from '@/types/people';

export interface ReleaseChildInput {
  studentId: string;
  pickupPersonId?: string | null;
  pickupPersonName: string;
  relationship: string;
  method: CollectionEvent['method'];
  note?: string;
}

/**
 * Endpoint layer for child collection.
 *
 * These records are append-only by design: who collected a child, when, and
 * which member of staff released them. That history is the point of the
 * feature, so nothing here edits or deletes (spec section 12).
 */
export const CollectionEndpoints = {
  fetchEvents: (query: ListQuery) =>
    http.get<Paginated<CollectionEvent>>('/collection/events', { query }),

  releaseChild: (input: ReleaseChildInput) =>
    http.post<CollectionEvent>('/collection/events', input),
};
