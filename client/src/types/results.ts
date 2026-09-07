/** Nothing about grading is fixed by the software (spec section 19). */
export interface GradeBand {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
  remark: string;
  gradePoint?: number | null;
  isPass: boolean;
  color?: string | null;
}

export interface AssessmentComponent {
  id: string;
  schoolId: string;
  schemeId: string;
  name: string;
  code: string;
  maxScore: number;
  sequence: number;
  type: 'CONTINUOUS_ASSESSMENT' | 'EXAM';
}

export interface GradingScheme {
  id: string;
  schoolId: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  passMark: number;
  components: AssessmentComponent[];
  bands: GradeBand[];
  levelIds: string[];
  levelNames: string[];
  showPosition: boolean;
  version: number;
}

export type ResultStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED';

export interface ScoreCell {
  componentId: string;
  score: number | null;
}

export interface StudentSubjectScore {
  id: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  photoUrl?: string | null;
  scores: ScoreCell[];
  total: number | null;
  grade: string | null;
  remark: string | null;
  position?: number | null;
  isAbsent: boolean;
  version: number;
}

/** One class + subject + term worksheet, moving through the approval workflow. */
export interface ScoreSheet {
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
  components: AssessmentComponent[];
  status: ResultStatus;
  submittedByName?: string | null;
  submittedAt?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  rows: StudentSubjectScore[];
  classAverage: number | null;
  highest: number | null;
  lowest: number | null;
  version: number;
}

export interface SubjectResultLine {
  subjectId: string;
  subjectName: string;
  components: { componentId: string; name: string; maxScore: number; score: number | null }[];
  total: number | null;
  grade: string | null;
  remark: string | null;
  position?: number | null;
  classAverage?: number | null;
  classHighest?: number | null;
  teacherName?: string | null;
}

export interface BehaviourRatingLine {
  traitId: string;
  traitName: string;
  category: string;
  rating: number;
  scaleMax: number;
  label: string;
}

/** Everything a report card needs, assembled server-side. */
export interface ReportCard {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  photoUrl?: string | null;
  photoConsent: boolean;
  className: string;
  levelName: string;
  termId: string;
  termName: string;
  sessionName: string;
  status: ResultStatus;
  subjects: SubjectResultLine[];
  totalScore: number;
  totalObtainable: number;
  average: number;
  grade: string;
  position?: number | null;
  classSize: number;
  attendance: { present: number; absent: number; late: number; total: number; rate: number };
  behaviour: BehaviourRatingLine[];
  formTeacherComment?: string | null;
  principalComment?: string | null;
  nextTermBegins?: string | null;
  publishedAt?: string | null;
  verificationCode?: string | null;
  verifyUrl?: string | null;
  school: {
    name: string;
    logoUrl?: string | null;
    address: string;
    primaryColor: string;
    motto?: string | null;
  };
}

export interface CommentTemplate {
  id: string;
  schoolId: string;
  audience: 'FORM_TEACHER' | 'PRINCIPAL';
  band: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'GENERAL';
  text: string;
  usageCount: number;
}

export interface Transcript {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  dateOfBirth: string;
  admissionDate: string;
  exitDate?: string | null;
  status: string;
  years: TranscriptYear[];
  cumulativeAverage: number;
  verificationCode: string;
  verifyUrl: string;
  issuedByName?: string | null;
  issuedAt?: string | null;
}

export interface TranscriptYear {
  sessionName: string;
  levelName: string;
  className: string;
  terms: {
    termName: string;
    subjects: { subjectName: string; total: number; grade: string }[];
    average: number;
    position?: number | null;
  }[];
  yearAverage: number;
}

/** Public, privacy-conscious payload for `/verify/:code`. */
export interface VerificationResult {
  valid: boolean;
  documentType: 'REPORT_CARD' | 'TRANSCRIPT' | 'CERTIFICATE';
  schoolName: string;
  schoolLogoUrl?: string | null;
  studentInitials: string;
  className?: string | null;
  termName?: string | null;
  sessionName?: string | null;
  issuedAt: string;
  averageBand?: string | null;
  revoked: boolean;
}
