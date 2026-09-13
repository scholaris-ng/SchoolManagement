import type { Difficulty, QuestionOption, QuestionType } from '../entities/question.entity';
import type { AssessmentMode, AssessmentState, AttemptStatus } from '../entities/cbtAssessment.entity';

/** Wire shapes, mirroring `client/src/types/assessment.ts`. */

export interface QuestionDTO {
  id: string;
  schoolId: string;
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicTitle: string | null;
  objectiveId: string | null;
  objectiveStatement: string | null;
  levelId: string | null;
  type: QuestionType;
  difficulty: Difficulty;
  text: string;
  imageUrl: string | null;
  options: QuestionOption[];
  correctAnswer: string | null;
  explanation: string | null;
  marks: number;
  usageCount: number;
  createdByName: string;
  createdAt: string;
}

export interface CbtAssessmentDTO {
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
  startsAt: string | null;
  endsAt: string | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultImmediately: boolean;
  passScore: number;
  state: AssessmentState;
  createdByName: string;
  submissionCount: number;
  averageScore: number | null;
  version: number;
}

/** The paper as a candidate sees it — no correct answers, no explanations. */
export interface AttemptQuestionDTO {
  id: string;
  type: QuestionType;
  text: string;
  imageUrl: string | null;
  marks: number;
  options: { id: string; label: string; text: string }[];
}

export interface AttemptAnswerDTO {
  questionId: string;
  answer: string | null;
  answeredAt: string;
  synced: boolean;
}

export interface CbtAttemptDTO {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  studentId: string;
  studentName: string;
  mode: AssessmentMode;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  durationMinutes: number;
  answers: AttemptAnswerDTO[];
  questions: AttemptQuestionDTO[];
  score: number | null;
  totalMarks: number;
  passed: boolean | null;
  status: AttemptStatus;
}

export interface AttemptResultDTO {
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
    explanation: string | null;
  }[];
}
