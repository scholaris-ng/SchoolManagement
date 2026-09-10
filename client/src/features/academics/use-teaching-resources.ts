import { queryKeys } from '@/lib/query-keys';
import type { House, Room, Subject } from '@/types/academics';
import type { TimetablePeriod } from '@/types/curriculum';
import { AcademicsEndpoints } from './academics.endpoints';
import { useAcademicMutation } from './use-academic-mutation';

/** Writes to what a school teaches with: subjects, houses, rooms and periods. */

export function useSaveSubject() {
  return useAcademicMutation<{ id?: string; values: Partial<Subject> }, Subject>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updateSubject(id, values) : AcademicsEndpoints.createSubject(values),
    invalidate: (schoolId) => [queryKeys.academics.subjects(schoolId)],
    successMessage: 'Subject saved',
  });
}

export function useDeleteSubject() {
  return useAcademicMutation<string, void>({
    request: (id) => AcademicsEndpoints.removeSubject(id),
    invalidate: (schoolId) => [queryKeys.academics.subjects(schoolId)],
    successMessage: 'Subject removed',
  });
}

export function useSaveHouse() {
  return useAcademicMutation<{ id?: string; values: Partial<House> }, House>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updateHouse(id, values) : AcademicsEndpoints.createHouse(values),
    invalidate: (schoolId) => [queryKeys.academics.houses(schoolId)],
    successMessage: 'House saved',
  });
}

export function useSaveRoom() {
  return useAcademicMutation<{ id?: string; values: Partial<Room> }, Room>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updateRoom(id, values) : AcademicsEndpoints.createRoom(values),
    invalidate: (schoolId) => [queryKeys.academics.rooms(schoolId)],
    successMessage: 'Room saved',
  });
}

export function useSavePeriod() {
  return useAcademicMutation<{ id?: string; values: Partial<TimetablePeriod> }, TimetablePeriod>({
    request: ({ id, values }) =>
      id ? AcademicsEndpoints.updatePeriod(id, values) : AcademicsEndpoints.createPeriod(values),
    // A new or retimed period changes what the timetable grid can show.
    invalidate: (schoolId) => [
      queryKeys.academics.periods(schoolId),
      queryKeys.timetable.list(schoolId),
    ],
    successMessage: 'Period saved',
  });
}

export function useDeletePeriod() {
  return useAcademicMutation<string, void>({
    request: (id) => AcademicsEndpoints.removePeriod(id),
    invalidate: (schoolId) => [
      queryKeys.academics.periods(schoolId),
      queryKeys.timetable.list(schoolId),
    ],
    successMessage: 'Period deleted',
  });
}
