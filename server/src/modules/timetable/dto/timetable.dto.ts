import type { TimetablePeriodDTO } from '../../academics/dto/academics.dto';

/** Mirrors `TimetableEntry` in `client/src/types/curriculum.ts`. */
export interface TimetableEntryDTO {
  id: string;
  schoolId: string;
  timetableId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  roomId?: string | null;
  roomName?: string | null;
  periodId: string;
  periodName: string;
  startTime: string;
  endTime: string;
  day: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
}

/** Mirrors `Timetable` in `client/src/types/curriculum.ts`. */
export interface TimetableDTO {
  id: string;
  schoolId: string;
  name: string;
  sessionId: string;
  termId: string;
  termName: string;
  status: 'DRAFT' | 'PUBLISHED';
  periods: TimetablePeriodDTO[];
  entries: TimetableEntryDTO[];
  version: number;
}
