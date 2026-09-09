import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type { RetentionRiskRow } from '@/types/analytics';

/**
 * Endpoint layer for withdrawal-risk analytics.
 *
 * Pure typed transport calls — no React, no state (frontend guide section 6).
 */
export const AnalyticsEndpoints = {
  fetchRetentionRisk: (query: ListQuery) =>
    http.get<Paginated<RetentionRiskRow>>('/analytics/retention', { query }),
};
