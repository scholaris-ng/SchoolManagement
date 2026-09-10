import { http } from '@/lib/http';
import type { House, Room, Subject } from '@/types/academics';
import type { TimetablePeriod } from '@/types/curriculum';
import type { SubjectQuery } from './academics.types';

/** Endpoints for what a school teaches with: subjects, houses, rooms, periods. */
export const AcademicsResourceEndpoints = {
  fetchSubjects: (query: SubjectQuery) =>
    http.get<Subject[]>('/academics/subjects', { query }),

  fetchRooms: () => http.get<Room[]>('/academics/rooms'),

  fetchHouses: () => http.get<House[]>('/academics/houses'),

  fetchPeriods: () => http.get<TimetablePeriod[]>('/academics/periods'),

  createSubject: (values: Partial<Subject>) => http.post<Subject>('/academics/subjects', values),

  updateSubject: (id: string, values: Partial<Subject>) =>
    http.patch<Subject>(`/academics/subjects/${id}`, values),

  removeSubject: (id: string) => http.delete<void>(`/academics/subjects/${id}`),

  createHouse: (values: Partial<House>) => http.post<House>('/academics/houses', values),

  updateHouse: (id: string, values: Partial<House>) =>
    http.patch<House>(`/academics/houses/${id}`, values),

  createRoom: (values: Partial<Room>) => http.post<Room>('/academics/rooms', values),

  updateRoom: (id: string, values: Partial<Room>) =>
    http.patch<Room>(`/academics/rooms/${id}`, values),

  createPeriod: (values: Partial<TimetablePeriod>) =>
    http.post<TimetablePeriod>('/academics/periods', values),

  updatePeriod: (id: string, values: Partial<TimetablePeriod>) =>
    http.patch<TimetablePeriod>(`/academics/periods/${id}`, values),

  removePeriod: (id: string) => http.delete<void>(`/academics/periods/${id}`),
};
