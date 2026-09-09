/**
 * Curriculum modelled down to the individual performance objective — the
 * distinguishing feature of the product (research doc, feature 4).
 */
export interface Curriculum {
  id: string;
  schoolId: string;
  name: string;
  subjectId: string;
  subjectName: string;
  /**
   * The class this curriculum is written for. A curriculum is not an abstract
   * syllabus here: JSS 1 Gold and JSS 1 Silver move at different speeds, so
   * coverage only means anything once the plan belongs to one class.
   */
  classId: string;
  className: string;
  /** Derived from the class, kept denormalised so lists can group by level. */
  levelId: string;
  levelName: string;
  /**
   * The academic session this plan was written for. A syllabus is rewritten
   * year on year, so last year's plan must not keep answering for this one:
   * the list follows whichever session the school has made current.
   */
  sessionId: string;
  sessionName: string;
  description?: string | null;
  topicCount: number;
  objectiveCount: number;
  isActive: boolean;
  /** Who wrote it — a head teacher needs this before approving anything. */
  createdById: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumTopic {
  id: string;
  curriculumId: string;
  title: string;
  description?: string | null;
  sequence: number;
  suggestedWeeks: number;
  objectives: LearningObjective[];
}

export interface LearningObjective {
  id: string;
  topicId: string;
  code: string;
  statement: string;
  sequence: number;
  bloomLevel?: 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYSE' | 'EVALUATE' | 'CREATE' | null;
  /** Coverage flags resolved for a given class + term. */
  taught: boolean;
  assessed: boolean;
  taughtOn?: string | null;
  questionCount?: number;
}

export interface CoverageCell {
  topicId: string;
  topicTitle: string;
  objectiveId: string;
  objectiveCode: string;
  statement: string;
  taught: boolean;
  assessed: boolean;
}

/** The report that turns a syllabus gap from a WAEC surprise into a weekly fix. */
export interface CurriculumCoverage {
  curriculumId: string;
  subjectName: string;
  className: string;
  termName: string;
  totalObjectives: number;
  taughtCount: number;
  assessedCount: number;
  taughtNotAssessed: number;
  neverTaught: number;
  coverageRate: number;
  assessmentRate: number;
  cells: CoverageCell[];
}

export type SchemeStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

export interface SchemeWeek {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  topicId?: string | null;
  topicTitle: string;
  objectiveIds: string[];
  objectiveStatements: string[];
  activities?: string | null;
  resources?: string | null;
  isBreak: boolean;
}

export interface SchemeOfWork {
  id: string;
  schoolId: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  termId: string;
  termName: string;
  sessionName: string;
  curriculumId: string;
  status: SchemeStatus;
  weeks: SchemeWeek[];
  /** Who wrote it — the same ownership check curricula use to gate visibility. */
  createdById: string;
  createdByName: string;
  approvedByName?: string | null;
  approvedAt?: string | null;
  version: number;
}

export type LessonNoteStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED';

export interface LessonNote {
  id: string;
  schoolId: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  termId: string;
  weekNumber: number;
  date: string;
  topic: string;
  objectiveIds: string[];
  objectiveStatements: string[];
  content: string;
  resources?: string | null;
  assignment?: string | null;
  /** What did not work — the feature that makes notes useful to a head teacher. */
  challenges?: string | null;
  studentDifficulties?: string | null;
  status: LessonNoteStatus;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  version: number;
}

export interface TimetablePeriod {
  id: string;
  schoolId: string;
  name: string;
  startTime: string;
  endTime: string;
  sequence: number;
  isBreak: boolean;
}

export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';

export interface TimetableEntry {
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
  day: Weekday;
}

export interface Timetable {
  id: string;
  schoolId: string;
  name: string;
  sessionId: string;
  termId: string;
  termName: string;
  status: 'DRAFT' | 'PUBLISHED';
  periods: TimetablePeriod[];
  entries: TimetableEntry[];
  version: number;
}

export interface TimetableConflict {
  type: 'TEACHER' | 'CLASS' | 'ROOM';
  day: Weekday;
  periodName: string;
  message: string;
  entryIds: string[];
}

export type CalendarAudience =
  | 'EVERYONE'
  | 'STAFF'
  | 'PARENTS'
  | 'STUDENTS'
  | 'CLASSES'
  | 'ROLES';

export interface CalendarEvent {
  id: string;
  schoolId: string;
  title: string;
  description?: string | null;
  category: 'HOLIDAY' | 'EXAM' | 'TEST' | 'PTA' | 'EVENT' | 'FEE_DEADLINE' | 'ADMISSION' | 'STAFF';
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string | null;
  audience: CalendarAudience;
  classIds: string[];
  roleNames: string[];
  color?: string | null;
  createdByName: string;
}

export interface CalendarConflict {
  eventId: string;
  title: string;
  overlapStart: string;
  overlapEnd: string;
  reason: string;
}
