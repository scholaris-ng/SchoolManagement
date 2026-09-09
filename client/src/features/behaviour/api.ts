import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { BehaviourTrait } from '@/types/behaviour';
import { BehaviourEndpoints } from './behaviour.endpoints';
import type {
  AwardHousePointsInput,
  Leaderboard,
  RecordObservationInput,
} from './behaviour.endpoints';

export type { AwardHousePointsInput, Leaderboard, RecordObservationInput };

export function useBehaviourTraits() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.behaviour.traits(schoolId),
    queryFn: () => BehaviourEndpoints.fetchTraits(),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useBehaviourScales() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.behaviour.scales(schoolId),
    queryFn: () => BehaviourEndpoints.fetchScales(),
    enabled: Boolean(schoolId),
    staleTime: 10 * 60_000,
  });
}

export function useSaveBehaviourTrait() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: Partial<BehaviourTrait> }) =>
      id ? BehaviourEndpoints.updateTrait(id, values) : BehaviourEndpoints.createTrait(values),
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
    queryFn: () => BehaviourEndpoints.fetchObservations(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

/** Records one trait observation against a student. */
export function useRecordObservation() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: RecordObservationInput) => BehaviourEndpoints.recordObservation(values),
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
    queryFn: () => BehaviourEndpoints.fetchHousePoints(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useAwardHousePoints() {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: AwardHousePointsInput) => BehaviourEndpoints.awardHousePoints(values),
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

export function useHouseLeaderboard(termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.behaviour.houseLeaderboard(schoolId, termId),
    queryFn: () => BehaviourEndpoints.fetchLeaderboard(termId),
    enabled: Boolean(schoolId),
  });
}
