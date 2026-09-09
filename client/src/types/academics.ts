import type { Weekday } from './curriculum';

export interface AcademicSession {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';
  termCount: number;
}

export interface Term {
  id: string;
  schoolId: string;
  sessionId: string;
  sessionName: string;
  name: string;
  sequence: number;
  startDate: string;
  endDate: string;
  teachingWeeks: number;
  isCurrent: boolean;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';
}

/** School-defined ladder (Creche / Nursery / Year 1…) — never hardcoded. */
export interface SchoolLevel {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  sequence: number;
  /** Grading scheme applied to classes in this level, if it differs. */
  gradingSchemeId?: string | null;
  gradingSchemeName?: string | null;
  classCount: number;
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  levelId: string;
  levelName: string;
  name: string;
  arm?: string | null;
  code: string;
  capacity: number;
  enrolledCount: number;
  formTeacherIds: string[];
  formTeacherNames: string[];
  roomId?: string | null;
  isActive: boolean;
}

/** One slot in a subject's usual weekly spread — which day, which period. */
export interface SubjectScheduleSlot {
  day: Weekday;
  periodId: string;
}

export interface Subject {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  category?: string | null;
  isCore: boolean;
  levelIds: string[];
  levelNames: string[];
  teacherCount: number;
  isActive: boolean;
  /** When this subject is normally taught, independent of any one class's timetable. */
  schedule: SubjectScheduleSlot[];
}

export interface Room {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  capacity: number;
  type: 'CLASSROOM' | 'LABORATORY' | 'HALL' | 'LIBRARY' | 'OTHER';
}

export interface House {
  id: string;
  schoolId: string;
  name: string;
  color: string;
  motto?: string | null;
  captainStudentId?: string | null;
  captainName?: string | null;
  memberCount: number;
  points: number;
}
