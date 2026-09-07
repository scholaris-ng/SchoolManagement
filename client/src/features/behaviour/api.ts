import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery, Paginated } from '@/types/api';
import type {
  BehaviourObservation,
  BehaviourScale,
  BehaviourTrait,
  HouseLeaderboardRow,
  HousePointAward,
  StudentPointsRow,
} from '@/types/behaviour';

export function useBehaviourTraits() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.behaviour.traits(schoolId),
    queryFn: () => http.get<BehaviourTrait[]>('/behaviour/traits'),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useBehaviourScales() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.behaviour.scales(schoolId),
    queryFn: () => http.get<BehaviourScale[]>('/behaviour/scales'),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useSaveBehaviourTrait() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<BehaviourTrait> }) =>
      id
        ? http.patch<BehaviourTrait>(`/behaviour/traits/${id}`, values)
        : http.post<BehaviourTrait>('/behaviour/traits', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.behaviour.traits(schoolId) });
      toast.success('Behaviour trait saved');
    },
  });
}

export function useBehaviourObservations(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.behaviour.observations(schoolId, query),
    queryFn: () => http.get<Paginated<BehaviourObservation>>('/behaviour/observations', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

/**
 * Recording an observation.
 *
 * Ratings are captured through the term as things actually happen, rather than
 * invented in one sitting at report time — which is the whole reason the
 * behaviour section of a report card is worth reading (spec section 23).
 */
export function useRecordObservation() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: {
      studentId: string;
      traitId: string;
      rating: number;
      note?: string;
    }) => http.post<BehaviourObservation>('/behaviour/observations', values),
    onSuccess: (observation) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.behaviour.observations(schoolId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.students.behaviour(schoolId, observation.studentId),
      });
      toast.success('Observation recorded');
    },
  });
}

export function useHousePoints(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.behaviour.housePoints(schoolId, query),
    queryFn: () => http.get<Paginated<HousePointAward>>('/house-points', { query }),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useAwardHousePoints() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: {
      studentId: string;
      points: number;
      reason: string;
      note?: string;
    }) => http.post<HousePointAward>('/house-points', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.behaviour.housePoints(schoolId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.behaviour.houseLeaderboard(schoolId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academics.houses(schoolId) });
      toast.success('House points awarded');
    },
  });
}

export interface Leaderboard {
  houses: HouseLeaderboardRow[];
  students: StudentPointsRow[];
}

export function useHouseLeaderboard(termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.behaviour.houseLeaderboard(schoolId, termId),
    queryFn: () => http.get<Leaderboard>('/house-leaderboard', { query: { termId } }),
    enabled: Boolean(schoolId),
  });
}
