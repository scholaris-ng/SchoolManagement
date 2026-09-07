export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  schoolId: string;
  subjectId: string;
  subjectName: string;
  topicId?: string | null;
  topicTitle?: string | null;
  objectiveId?: string | null;
  objectiveStatement?: string | null;
  levelId?: string | null;
  type: QuestionType;
  difficulty: Difficulty;
  text: string;
  imageUrl?: string | null;
  options: QuestionOption[];
  correctAnswer?: string | null;
  explanation?: string | null;
  marks: number;
  usageCount: number;
  createdByName: string;
  createdAt: string;
}

export type AssessmentMode = 'PRACTICE' | 'EXAM';
export type AssessmentState = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'GRADED';

export interface CbtAssessment {
  id: string;
  schoolId: string;
  title: string;
  mode: AssessmentMode;
  subjectId: string;
  subjectName: string;
  classIds: string[];
  classNames: string[];
  termId: string;
  questionIds: string[];
  questionCount: number;
  totalMarks: number;
  durationMinutes: number;
  attemptsAllowed: number;
  startsAt?: string | null;
  endsAt?: string | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultImmediately: boolean;
  passScore: number;
  state: AssessmentState;
  createdByName: string;
  submissionCount: number;
  averageScore?: number | null;
  version: number;
}

export interface AttemptAnswer {
  questionId: string;
  answer: string | null;
  answeredAt: string;
  /** Not yet acknowledged by the server — held in local storage until it is. */
  synced: boolean;
}

export interface CbtAttempt {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  studentId: string;
  studentName: string;
  mode: AssessmentMode;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string | null;
  durationMinutes: number;
  answers: AttemptAnswer[];
  questions: AttemptQuestion[];
  score?: number | null;
  totalMarks: number;
  passed?: boolean | null;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'ABANDONED';
}

/** Correct answers are stripped from the payload while an exam is in progress. */
export interface AttemptQuestion {
  id: string;
  type: QuestionType;
  text: string;
  imageUrl?: string | null;
  marks: number;
  options: { id: string; label: string; text: string }[];
}

export interface AttemptResult {
  attemptId: string;
  assessmentTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  submittedAt: string;
  breakdown: {
    questionId: string;
    text: string;
    yourAnswer: string | null;
    correctAnswer: string | null;
    isCorrect: boolean;
    explanation?: string | null;
  }[];
}
