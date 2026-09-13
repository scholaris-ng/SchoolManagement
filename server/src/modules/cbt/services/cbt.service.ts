import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AuditService } from '../../audit/services/audit.service';
import { SubjectRepository } from '../../academics/repositories/subject.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { StudentRepository } from '../../students/repositories/student.repository';
import { CbtRepository } from '../repositories/cbt.repository';
import type { CbtAttempt } from '../entities/cbtAssessment.entity';
import type { QuestionOption } from '../entities/question.entity';
import type {
  AttemptQuestionDTO,
  AttemptResultDTO,
  CbtAssessmentDTO,
  CbtAttemptDTO,
  QuestionDTO,
} from '../dto/cbt.dto';
import { answerable, ANSWERABLE_MESSAGE } from '../validators/cbt.schema';
import type {
  CreateAssessmentInput,
  CreateQuestionInput,
  FetchAssessmentsQuery,
  FetchQuestionsQuery,
  FlushAnswersInput,
  SubmitAttemptInput,
  UpdateAssessmentInput,
  UpdateQuestionInput,
} from '../validators/cbt.schema';

/**
 * The question bank and computer-based tests (spec section 25).
 *
 * Two rules shape everything here. A candidate must never receive the answer
 * key: the paper they are sent is stripped of `isCorrect`, `correctAnswer`
 * and every explanation until they submit. And the clock is the server's:
 * `expires_at` is set when the attempt starts, and a paper submitted after it
 * is marked on what had been saved by then, so a browser left open past time
 * gains nothing.
 *
 * Answers are written as they are given, so a lost connection costs the last
 * few seconds rather than the whole sitting.
 */
export class CbtService {
  static Instance = new CbtService();

  private constructor(
    private readonly cbt = CbtRepository.Instance,
    private readonly subjects = SubjectRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly students = StudentRepository.Instance,
    private readonly scope = AcademicScopeService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /* -- Questions ------------------------------------------------------------- */

  async fetchQuestions(context: RequestContext, query: FetchQuestionsQuery): Promise<Paginated<QuestionDTO>> {
    const scope = await this.scope.forContext(context);
    return this.cbt.fetchQuestions(context.schoolId, { ...query, subjectIds: scope.subjectIds });
  }

  async createQuestion(context: RequestContext, input: CreateQuestionInput): Promise<QuestionDTO> {
    const { schoolId } = context;
    await this.refuseUnteachableSubject(context, input.subjectId);

    const created = await this.cbt.createQuestion({
      schoolId,
      subjectId: input.subjectId,
      topicId: input.topicId ?? null,
      objectiveId: input.objectiveId ?? null,
      levelId: input.levelId ?? null,
      type: input.type,
      difficulty: input.difficulty,
      text: input.text,
      imageUrl: input.imageUrl ?? null,
      options: input.options,
      correctAnswer: input.correctAnswer ?? null,
      explanation: input.explanation ?? null,
      marks: input.marks,
      usageCount: 0,
      createdByUserId: context.user.id,
      createdByName: context.user.displayName,
    });

    const dto = await this.cbt.findQuestionDTO(schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateQuestion(context: RequestContext, id: string, patch: UpdateQuestionInput): Promise<QuestionDTO> {
    const { schoolId } = context;
    const existing = await this.cbt.findQuestionDTO(schoolId, id);
    if (!existing) throw AppError.notFound('Question');
    await this.refuseUnteachableSubject(context, patch.subjectId ?? existing.subjectId);

    // Validated as a whole, because "one correct option" is a fact about the
    // merged question rather than about the fields this patch happens to send.
    const merged = { ...existing, ...patch } as CreateQuestionInput;
    if (!answerable(merged)) throw AppError.validation(ANSWERABLE_MESSAGE);

    const columns: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) columns[key] = value;
    }
    if (Object.keys(columns).length > 0) await this.cbt.updateQuestion(schoolId, id, columns);

    const dto = await this.cbt.findQuestionDTO(schoolId, id);
    if (!dto) throw AppError.notFound('Question');
    return dto;
  }

  /** A question already on a paper stays: marks students earned depend on it. */
  async removeQuestion(context: RequestContext, id: string): Promise<void> {
    const { schoolId } = context;
    const existing = await this.cbt.findQuestionDTO(schoolId, id);
    if (!existing) throw AppError.notFound('Question');
    const papers = await this.cbt.papersUsing(schoolId, id);
    if (papers > 0) {
      throw AppError.conflict(
        `This question is on ${papers} paper${papers === 1 ? '' : 's'}. Remove it from ${papers === 1 ? 'that paper' : 'those papers'} first.`,
      );
    }
    await this.cbt.removeQuestion(schoolId, id);
  }

  /* -- Assessments ----------------------------------------------------------- */

  async fetchAssessments(context: RequestContext, query: FetchAssessmentsQuery): Promise<Paginated<CbtAssessmentDTO>> {
    return this.cbt.fetchAssessments(context.schoolId, { ...query, classIds: await this.candidateClassIds(context) });
  }

  async fetchAssessment(context: RequestContext, id: string): Promise<CbtAssessmentDTO> {
    return this.resolveVisibleAssessment(context, id);
  }

  async createAssessment(context: RequestContext, input: CreateAssessmentInput): Promise<CbtAssessmentDTO> {
    const { schoolId } = context;
    const [subject, term] = await Promise.all([
      this.subjects.findOneDTO(schoolId, input.subjectId),
      this.terms.findOneDTO(schoolId, input.termId),
    ]);
    if (!subject) throw AppError.notFound('Subject');
    if (!term) throw AppError.notFound('Term');
    await this.refuseUnteachableSubject(context, input.subjectId);
    await this.refuseUnknownQuestions(schoolId, input.questionIds, input.subjectId);

    const created = await this.cbt.createAssessment({
      schoolId,
      title: input.title,
      mode: input.mode,
      subjectId: input.subjectId,
      classIds: input.classIds,
      termId: input.termId,
      questionIds: input.questionIds,
      durationMinutes: input.durationMinutes,
      attemptsAllowed: input.attemptsAllowed,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      shuffleQuestions: input.shuffleQuestions,
      shuffleOptions: input.shuffleOptions,
      showResultImmediately: input.showResultImmediately,
      passScore: input.passScore,
      state: input.state ?? 'DRAFT',
      createdByUserId: context.user.id,
      createdByName: context.user.displayName,
    });

    await this.audit.record(context, {
      action: 'cbt.assessment_created',
      entityType: 'CbtAssessment',
      entityId: created.id,
      entityLabel: input.title,
      after: { mode: input.mode, questions: input.questionIds.length, classes: input.classIds.length },
    });

    const dto = await this.cbt.findAssessmentDTO(schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  /**
   * A paper anybody has sat is fixed: its questions, timing and pass mark
   * decide marks already earned. Only its state may move after that.
   */
  async updateAssessment(
    context: RequestContext,
    id: string,
    patch: UpdateAssessmentInput,
    expectedVersion: number | undefined,
  ): Promise<CbtAssessmentDTO> {
    const { schoolId } = context;
    const existing = await this.cbt.findAssessmentDTO(schoolId, id);
    if (!existing) throw AppError.notFound('Assessment');

    const { state, ...content } = patch;
    const changesContent = Object.values(content).some((value) => value !== undefined);
    if (changesContent && existing.submissionCount > 0) {
      throw AppError.conflict(
        `${existing.submissionCount} pupil${existing.submissionCount === 1 ? ' has' : 's have'} already sat this paper, so its questions and timing can no longer change.`,
      );
    }
    if (content.questionIds) {
      await this.refuseUnknownQuestions(schoolId, content.questionIds, content.subjectId ?? existing.subjectId);
    }

    const columns: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) columns[key] = value;
    }
    if (Object.keys(columns).length > 0) {
      const applied = await this.cbt.updateAssessmentIfVersionMatches(schoolId, id, expectedVersion, columns);
      if (!applied) throw AppError.versionConflict();
    }
    if (state && state !== existing.state) {
      await this.audit.record(context, {
        action: 'cbt.assessment_state_changed',
        entityType: 'CbtAssessment',
        entityId: id,
        entityLabel: existing.title,
        before: { state: existing.state },
        after: { state },
      });
    }

    const dto = await this.cbt.findAssessmentDTO(schoolId, id);
    if (!dto) throw AppError.notFound('Assessment');
    return dto;
  }

  /* -- Sitting a paper ------------------------------------------------------- */

  /**
   * Starts a sitting, or hands back the one already in progress — a reload
   * must not consume another of the pupil's attempts, nor reshuffle their
   * paper. The order is fixed here, once.
   */
  async startAttempt(context: RequestContext, assessmentId: string): Promise<CbtAttemptDTO> {
    const { schoolId } = context;
    const studentId = context.membership.studentId;
    if (!studentId) throw AppError.forbidden('Only a pupil signed in to their own account can sit a paper.');

    const assessment = await this.resolveVisibleAssessment(context, assessmentId);
    const student = await this.students.findOneDTO(schoolId, studentId);
    if (!student) throw AppError.notFound('Student');
    if (!student.currentClassId || !assessment.classIds.includes(student.currentClassId)) {
      throw AppError.notFound('Assessment');
    }

    const now = new Date();
    if (assessment.state !== 'OPEN') throw AppError.conflict('This paper is not open.');
    if (assessment.startsAt && new Date(assessment.startsAt) > now) throw AppError.conflict('This paper has not opened yet.');
    if (assessment.endsAt && new Date(assessment.endsAt) < now) throw AppError.conflict('This paper has closed.');

    const previous = await this.cbt.attemptsFor(schoolId, assessmentId, studentId);
    const live = previous.find((attempt) => attempt.status === 'IN_PROGRESS' && attempt.expiresAt > now);
    if (live) return this.toAttemptDTO(context, assessment, live, student.fullName);
    if (previous.filter((attempt) => attempt.status !== 'ABANDONED').length >= assessment.attemptsAllowed) {
      throw AppError.conflict(
        `You have used all ${assessment.attemptsAllowed} attempt${assessment.attemptsAllowed === 1 ? '' : 's'} at this paper.`,
      );
    }

    const questions = await this.cbt.questionsByIds(schoolId, assessment.questionIds);
    const ordered = assessment.shuffleQuestions ? shuffle(questions) : orderBy(questions, assessment.questionIds);
    const expiresAt = new Date(now.getTime() + assessment.durationMinutes * 60_000);
    const hardStop = assessment.endsAt ? new Date(assessment.endsAt) : null;

    const created = await this.cbt.createAttempt({
      schoolId,
      assessmentId,
      studentId,
      questionIds: ordered.map((question) => question.id),
      answers: {},
      startedAt: now,
      expiresAt: hardStop && hardStop < expiresAt ? hardStop : expiresAt,
      totalMarks: questions.reduce((sum, question) => sum + question.marks, 0),
      status: 'IN_PROGRESS',
    });
    await this.cbt.countQuestionUse(schoolId, assessment.questionIds);

    return this.toAttemptDTO(context, assessment, created, student.fullName);
  }

  /** Saves what has been answered so far. Silently ignored once time is up. */
  async flushAnswers(context: RequestContext, attemptId: string, input: FlushAnswersInput): Promise<{ saved: number; savedAt: string }> {
    const attempt = await this.resolveOwnAttempt(context, attemptId);
    const now = new Date();
    if (attempt.status !== 'IN_PROGRESS' || attempt.expiresAt < now) {
      return { saved: 0, savedAt: now.toISOString() };
    }

    const onPaper = new Set(attempt.questionIds);
    const answers = { ...attempt.answers };
    let saved = 0;
    for (const entry of input.answers) {
      if (!onPaper.has(entry.questionId)) continue;
      answers[entry.questionId] = entry.answer;
      saved += 1;
    }
    await this.cbt.updateAttempt(context.schoolId, attemptId, { answers });
    return { saved, savedAt: now.toISOString() };
  }

  /**
   * Marks the paper. Everything the candidate had saved counts, including
   * anything in this request that arrived before time; answers sent after
   * expiry are ignored rather than rejected, so a slow connection at the
   * buzzer does not cost the whole paper.
   */
  async submitAttempt(context: RequestContext, attemptId: string, input: SubmitAttemptInput): Promise<AttemptResultDTO> {
    const { schoolId } = context;
    const attempt = await this.resolveOwnAttempt(context, attemptId);
    if (attempt.assessmentId !== input.assessmentId) throw AppError.validation('That paper does not match this attempt.');

    const assessment = await this.cbt.findAssessmentDTO(schoolId, attempt.assessmentId);
    if (!assessment) throw AppError.notFound('Assessment');
    if (attempt.status !== 'IN_PROGRESS') throw AppError.conflict('This attempt has already been submitted.');

    const now = new Date();
    const inTime = attempt.expiresAt >= now;
    const onPaper = new Set(attempt.questionIds);
    const answers = { ...attempt.answers };
    if (inTime) {
      for (const entry of input.answers) {
        if (onPaper.has(entry.questionId)) answers[entry.questionId] = entry.answer;
      }
    }

    const questions = await this.cbt.questionsByIds(schoolId, attempt.questionIds);
    const byId = new Map(questions.map((question) => [question.id, question]));
    const breakdown = attempt.questionIds.map((questionId) => {
      const question = byId.get(questionId);
      const given = answers[questionId] ?? null;
      const correct = question ? correctAnswerOf(question) : null;
      return {
        questionId,
        text: question?.text ?? '',
        yourAnswer: given === null ? null : displayAnswer(question, given),
        correctAnswer: correct ? displayAnswer(question, correct) : null,
        isCorrect: Boolean(question && given !== null && isCorrect(question, given)),
        explanation: question?.explanation ?? null,
        marks: question?.marks ?? 0,
      };
    });

    const score = breakdown.reduce((sum, row) => sum + (row.isCorrect ? row.marks : 0), 0);
    const totalMarks = questions.reduce((sum, question) => sum + question.marks, 0);
    const percentage = totalMarks > 0 ? Math.round((1000 * score) / totalMarks) / 10 : 0;

    await this.cbt.updateAttempt(schoolId, attemptId, {
      answers,
      submittedAt: now,
      score: String(score),
      totalMarks,
      status: 'GRADED',
    });

    return {
      attemptId,
      assessmentTitle: assessment.title,
      score,
      totalMarks,
      percentage,
      passed: percentage >= assessment.passScore,
      correctCount: breakdown.filter((row) => row.isCorrect).length,
      wrongCount: breakdown.filter((row) => !row.isCorrect && row.yourAnswer !== null).length,
      unansweredCount: breakdown.filter((row) => row.yourAnswer === null).length,
      submittedAt: now.toISOString(),
      // A practice paper shows its working; an exam that does not release
      // results immediately gives the score and keeps the answer key.
      breakdown: assessment.showResultImmediately
        ? breakdown.map(({ marks: _marks, ...row }) => row)
        : [],
    };
  }

  /* -- Internals ------------------------------------------------------------- */

  private async resolveVisibleAssessment(context: RequestContext, id: string): Promise<CbtAssessmentDTO> {
    const assessment = await this.cbt.findAssessmentDTO(context.schoolId, id);
    if (!assessment) throw AppError.notFound('Assessment');
    const classIds = await this.candidateClassIds(context);
    if (classIds) {
      const mine = assessment.classIds.some((classId) => classIds.includes(classId));
      if (!mine || assessment.state === 'DRAFT' || assessment.state === 'SCHEDULED') throw AppError.notFound('Assessment');
    }
    return assessment;
  }

  private async resolveOwnAttempt(context: RequestContext, attemptId: string): Promise<CbtAttempt> {
    const attempt = await this.cbt.findAttempt(context.schoolId, attemptId);
    if (!attempt) throw AppError.notFound('Attempt');
    if (context.membership.studentId && attempt.studentId !== context.membership.studentId) {
      throw AppError.notFound('Attempt');
    }
    if (!context.membership.studentId) throw AppError.forbidden('Only the candidate can answer their own paper.');
    return attempt;
  }

  /** Null for staff; a pupil's own class for a candidate. */
  private async candidateClassIds(context: RequestContext): Promise<string[] | null> {
    if (!context.membership.studentId) return null;
    const scope = await this.scope.forContext(context);
    return scope.classIds ?? [];
  }

  private async refuseUnteachableSubject(context: RequestContext, subjectId: string): Promise<void> {
    const scope = await this.scope.forContext(context);
    if (scope.subjectIds && !scope.subjectIds.includes(subjectId)) {
      throw AppError.validation('You are not assigned that subject.');
    }
  }

  private async refuseUnknownQuestions(schoolId: string, questionIds: string[], subjectId: string): Promise<void> {
    const questions = await this.cbt.questionsByIds(schoolId, questionIds);
    if (questions.length !== new Set(questionIds).size) throw AppError.validation('One of those questions no longer exists.');
    const strays = questions.filter((question) => question.subjectId !== subjectId);
    if (strays.length > 0) throw AppError.validation('Every question on a paper must be for the paper’s own subject.');
  }

  private async toAttemptDTO(
    context: RequestContext,
    assessment: CbtAssessmentDTO,
    attempt: CbtAttempt,
    studentName: string,
  ): Promise<CbtAttemptDTO> {
    const questions = await this.cbt.questionsByIds(context.schoolId, attempt.questionIds);
    const byId = new Map(questions.map((question) => [question.id, question]));
    const ordered = attempt.questionIds.map((id) => byId.get(id)).filter((q): q is QuestionDTO => Boolean(q));

    return {
      id: attempt.id,
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      studentId: attempt.studentId,
      studentName,
      mode: assessment.mode,
      startedAt: attempt.startedAt.toISOString(),
      expiresAt: attempt.expiresAt.toISOString(),
      submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
      durationMinutes: assessment.durationMinutes,
      answers: Object.entries(attempt.answers).map(([questionId, answer]) => ({
        questionId,
        answer,
        answeredAt: attempt.updatedAt.toISOString(),
        synced: true,
      })),
      questions: ordered.map((question) => stripAnswers(question, assessment.shuffleOptions)),
      score: attempt.score === null ? null : Number(attempt.score),
      totalMarks: attempt.totalMarks,
      passed: attempt.score === null ? null : Number(attempt.score) >= (assessment.passScore * attempt.totalMarks) / 100,
      status: attempt.status,
    };
  }
}

/* -- Marking ---------------------------------------------------------------- */

function correctAnswerOf(question: QuestionDTO): string | null {
  if (question.type === 'SHORT_ANSWER') return question.correctAnswer;
  return question.options.find((option) => option.isCorrect)?.id ?? null;
}

function isCorrect(question: QuestionDTO, given: string): boolean {
  if (question.type === 'SHORT_ANSWER') {
    // Case and surrounding space are not what is being tested.
    return normalise(given) === normalise(question.correctAnswer ?? '');
  }
  const correct = question.options.find((option) => option.isCorrect);
  return Boolean(correct && (given === correct.id || normalise(given) === normalise(correct.label)));
}

/** The answer as a person reads it: the option's text, or the typed words. */
function displayAnswer(question: QuestionDTO | undefined, value: string): string {
  if (!question || question.type === 'SHORT_ANSWER') return value;
  const option = question.options.find((entry) => entry.id === value || entry.label === value);
  return option ? `${option.label}. ${option.text}` : value;
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** What a candidate is allowed to see: no `isCorrect`, no answer, no explanation. */
function stripAnswers(question: QuestionDTO, shuffleOptions: boolean): AttemptQuestionDTO {
  const options: QuestionOption[] = shuffleOptions ? shuffle(question.options) : question.options;
  return {
    id: question.id,
    type: question.type,
    text: question.text,
    imageUrl: question.imageUrl,
    marks: question.marks,
    options: options.map((option) => ({ id: option.id, label: option.label, text: option.text })),
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function orderBy(questions: QuestionDTO[], ids: string[]): QuestionDTO[] {
  const byId = new Map(questions.map((question) => [question.id, question]));
  return ids.map((id) => byId.get(id)).filter((question): question is QuestionDTO => Boolean(question));
}
