import { http } from '@/lib/http';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  BehaviourObservation,
  BehaviourScale,
  BehaviourTrait,
  HouseLeaderboardRow,
  HousePointAward,
  StudentPointsRow,
} from '@/types/behaviour';

export interface RecordObservationInput {
  studentId: string;
  traitId: string;
  rating: number;
  note?: string;
}

export interface AwardHousePointsInput {
  studentId: string;
  points: number;
  reason: string;
  note?: string;
}

export interface Leaderboard {
  houses: HouseLeaderboardRow[];
  students: StudentPointsRow[];
}

/**
 * Endpoint layer for behaviour traits, observations and house points.
 *
 * Ratings are captured through the term as things actually happen, rather than
 * invented in one sitting at report time — which is the whole reason the
 * behaviour section of a report card is worth reading (spec section 23).
 */
export const BehaviourEndpoints = {
  fetchTraits: () => http.get<BehaviourTrait[]>('/behaviour/traits'),

  fetchScales: () => http.get<BehaviourScale[]>('/behaviour/scales'),

  createTrait: (values: Partial<BehaviourTrait>) =>
    http.post<BehaviourTrait>('/behaviour/traits', values),

  updateTrait: (id: string, values: Partial<BehaviourTrait>) =>
    http.patch<BehaviourTrait>(`/behaviour/traits/${id}`, values),

  fetchObservations: (query: ListQuery) =>
    http.get<Paginated<BehaviourObservation>>('/behaviour/observations', { query }),

  recordObservation: (values: RecordObservationInput) =>
    http.post<BehaviourObservation>('/behaviour/observations', values),

  fetchHousePoints: (query: ListQuery) =>
    http.get<Paginated<HousePointAward>>('/house-points', { query }),

  awardHousePoints: (values: AwardHousePointsInput) =>
    http.post<HousePointAward>('/house-points', values),

  fetchLeaderboard: (termId?: string) =>
    http.get<Leaderboard>('/house-leaderboard', { query: { termId } }),
};
