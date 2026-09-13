import type { ComponentType } from '../entities/gradingScheme.entity';
import type { ResultStatus } from '../entities/scoreSheet.entity';
import type { COMMENT_AUDIENCES, COMMENT_BANDS } from '../entities/reportCard.entity';

/** Wire shapes, mirroring `client/src/types/results.ts`. */

export interface GradeBandDTO {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
  remark: string;
  gradePoint: number | null;
  isPass: boolean;
  color: string | null;
}

export interface AssessmentComponentDTO {
  id: string;
  schoolId: string;
  schemeId: string;
  name: string;
  code: string;
  maxScore: number;
  sequence: number;
  type: ComponentType;
}

export interface GradingSchemeDTO {
  id: string;
  schoolId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  passMark: number;
  components: AssessmentComponentDTO[];
  bands: GradeBandDTO[];
  levelIds: string[];
  levelNames: string[];
  showPosition: boolean;
  version: number;
}

export interface ScoreCellDTO {
  componentId: string;
  score: number | null;
}

export interface StudentSubjectScoreDTO {
  id: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  photoUrl: string | null;
  scores: ScoreCellDTO[];
  total: number | null;
  grade: string | null;
  remark: string | null;
  position: number | null;
  isAbsent: boolean;
  version: number;
}

export interface ScoreSheetDTO {
  id: string;
  schoolId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  termId: string;
  termName: string;
  sessionName: string;
  gradingSchemeId: string;
  components: AssessmentComponentDTO[];
  status: ResultStatus;
  submittedByName: string | null;
  submittedAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  rows: StudentSubjectScoreDTO[];
  classAverage: number | null;
  highest: number | null;
  lowest: number | null;
  version: number;
}

export interface ScoreSheetSummaryDTO extends Omit<ScoreSheetDTO, 'rows' | 'components'> {
  rows: [];
  components: AssessmentComponentDTO[];
  enteredCount: number;
  totalCount: number;
}

export interface SubjectResultLineDTO {
  subjectId: string;
  subjectName: string;
  components: { componentId: string; name: string; maxScore: number; score: number | null }[];
  total: number | null;
  grade: string | null;
  remark: string | null;
  position: number | null;
  classAverage: number | null;
  classHighest: number | null;
  teacherName: string | null;
}

export interface BehaviourRatingLineDTO {
  traitId: string;
  traitName: string;
  category: string;
  rating: number;
  scaleMax: number;
  label: string;
}

export interface ReportCardDTO {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  photoUrl: string | null;
  photoConsent: boolean;
  className: string;
  levelName: string;
  termId: string;
  termName: string;
  sessionName: string;
  status: ResultStatus;
  subjects: SubjectResultLineDTO[];
  totalScore: number;
  totalObtainable: number;
  average: number;
  grade: string;
  position: number | null;
  classSize: number;
  attendance: { present: number; absent: number; late: number; total: number; rate: number };
  behaviour: BehaviourRatingLineDTO[];
  formTeacherComment: string | null;
  principalComment: string | null;
  nextTermBegins: string | null;
  publishedAt: string | null;
  verificationCode: string | null;
  verifyUrl: string | null;
  school: {
    name: string;
    logoUrl: string | null;
    address: string;
    primaryColor: string;
    motto: string | null;
  };
}

export interface BroadsheetRowDTO {
  studentId: string;
  studentName: string;
  admissionNo: string;
  subjects: Record<string, number | null>;
  total: number;
  average: number;
  grade: string;
  position: number;
}

export interface BroadsheetDTO {
  classId: string;
  className: string;
  termId: string;
  termName: string;
  sessionName: string;
  subjects: { subjectId: string; subjectName: string }[];
  rows: BroadsheetRowDTO[];
  classAverage: number;
}

export interface CommentTemplateDTO {
  id: string;
  schoolId: string;
  audience: (typeof COMMENT_AUDIENCES)[number];
  band: (typeof COMMENT_BANDS)[number];
  text: string;
  usageCount: number;
}

export interface TranscriptYearDTO {
  sessionName: string;
  levelName: string;
  className: string;
  terms: {
    termName: string;
    subjects: { subjectName: string; total: number; grade: string }[];
    average: number;
    position: number | null;
  }[];
  yearAverage: number;
}

export interface TranscriptDTO {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  dateOfBirth: string;
  admissionDate: string;
  exitDate: string | null;
  status: string;
  years: TranscriptYearDTO[];
  cumulativeAverage: number;
  verificationCode: string;
  verifyUrl: string;
  issuedByName: string | null;
  issuedAt: string | null;
}

/** Public, privacy-conscious payload for `/verify/:code`. */
export interface VerificationResultDTO {
  valid: boolean;
  documentType: 'REPORT_CARD' | 'TRANSCRIPT' | 'CERTIFICATE';
  schoolName: string;
  schoolLogoUrl: string | null;
  studentInitials: string;
  className: string | null;
  termName: string | null;
  sessionName: string | null;
  issuedAt: string;
  averageBand: string | null;
  revoked: boolean;
}
