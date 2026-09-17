/**
 * Response contracts for the academic structure, matching
 * `client/src/types/academics.ts` field for field.
 *
 * Several fields here are denormalised joins or counts rather than columns —
 * `sessionName`, `levelName`, `formTeacherNames`, `classCount`. The client
 * renders lists straight from these, so resolving them in the repository's
 * projection is what keeps a class list from becoming a query per row.
 */

export interface AcademicSessionDTO {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';
  termCount: number;
}

export interface TermDTO {
  id: string;
  schoolId: string;
  sessionId: string;
  sessionName: string;
  /**
   * The session's own start date, not the term's.
   *
   * Term sequences restart every year, so "is this term earlier than that
   * one?" is only answerable as `(session start, term sequence)`. The ledger's
   * carry-forward asks that question on every invoice it issues, and carrying
   * the date here saves it a second lookup. Additive to the client's `Term`,
   * which simply ignores it.
   */
  sessionStartDate: string;
  name: string;
  sequence: number;
  startDate: string;
  endDate: string;
  teachingWeeks: number;
  isCurrent: boolean;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';
}

export interface SchoolLevelDTO {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  sequence: number;
  gradingSchemeId: string | null;
  gradingSchemeName: string | null;
  classCount: number;
}

export interface SchoolClassDTO {
  id: string;
  schoolId: string;
  levelId: string;
  levelName: string;
  name: string;
  arm: string | null;
  code: string;
  capacity: number;
  enrolledCount: number;
  formTeacherIds: string[];
  formTeacherNames: string[];
  roomId: string | null;
  isActive: boolean;
}

export interface SubjectScheduleSlotDTO {
  day: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
  periodId: string;
}

export interface SubjectDTO {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  category: string | null;
  isCore: boolean;
  levelIds: string[];
  levelNames: string[];
  teacherIds: string[];
  teacherNames: string[];
  teacherCount: number;
  isActive: boolean;
  schedule: SubjectScheduleSlotDTO[];
  /**
   * Whether anything beyond the subject's own level list depends on it — a
   * teaching assignment, a timetable entry, a scheme of work or lesson note, a
   * result, a CBT question or assessment. Deleting it is only ever genuinely
   * destructive when this is true; the settings screen uses it to say which
   * one deleting will do before the school commits to it.
   */
  isReferenced: boolean;
}

export interface RoomDTO {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  capacity: number;
  type: 'CLASSROOM' | 'LABORATORY' | 'HALL' | 'LIBRARY' | 'OTHER';
}

export interface HouseDTO {
  id: string;
  schoolId: string;
  name: string;
  color: string;
  motto: string | null;
  captainStudentId: string | null;
  captainName: string | null;
  memberCount: number;
  points: number;
}

export interface TimetablePeriodDTO {
  id: string;
  schoolId: string;
  name: string;
  startTime: string;
  endTime: string;
  sequence: number;
  isBreak: boolean;
}
