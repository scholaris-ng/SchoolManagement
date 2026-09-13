import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AssessmentComponent, GradeBand, GradingScheme } from '../entities/gradingScheme.entity';
import { ScoreSheet, type ResultStatus } from '../entities/scoreSheet.entity';
import { CommentTemplate, ReportCardRecord, TranscriptIssue } from '../entities/reportCard.entity';
import type {
  AssessmentComponentDTO,
  CommentTemplateDTO,
  GradeBandDTO,
  GradingSchemeDTO,
} from '../dto/assessment.dto';

/* -- Row shapes the service assembles from ---------------------------------- */

export interface SheetRow {
  id: string;
  schoolId: string;
  classId: string;
  className: string;
  levelId: string;
  levelName: string;
  subjectId: string;
  subjectName: string;
  termId: string;
  termName: string;
  termSequence: number;
  sessionId: string;
  sessionName: string;
  sessionStartDate: string;
  gradingSchemeId: string;
  status: ResultStatus;
  submittedByName: string | null;
  submittedAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  version: number;
  teacherName: string | null;
}

export interface SheetSummaryCounts {
  sheetId: string;
  enteredCount: number;
  totalCount: number;
}

export interface EntryRow {
  scoreSheetId: string;
  studentId: string;
  componentId: string;
  score: number | null;
}

export interface RosterRow {
  studentId: string;
  studentName: string;
  admissionNo: string;
  photoUrl: string | null;
  photoConsent: boolean;
  currentClassId: string | null;
}

export interface SheetFilter {
  page: number;
  pageSize: number;
  search?: string;
  classId?: string;
  subjectId?: string;
  termId: string;
  status?: string;
  /** (class, subject) pairs the caller may see; null for everyone. */
  pairs: { classId: string; subjectId: string }[] | null;
}

const SHEET_PROJECTION = `
  s.id, s.school_id AS "schoolId",
  s.class_id AS "classId", c.name AS "className", c.level_id AS "levelId", lvl.name AS "levelName",
  s.subject_id AS "subjectId", sub.name AS "subjectName",
  s.term_id AS "termId", t.name AS "termName", t.sequence AS "termSequence",
  t.session_id AS "sessionId", ses.name AS "sessionName", to_char(ses.start_date, 'YYYY-MM-DD') AS "sessionStartDate",
  s.grading_scheme_id AS "gradingSchemeId", s.status,
  s.submitted_by_name AS "submittedByName", s.submitted_at AS "submittedAt",
  s.approved_by_name AS "approvedByName", s.approved_at AS "approvedAt",
  s.published_at AS "publishedAt", s.version,
  (SELECT concat_ws(' ', st.first_name, st.last_name)
     FROM teaching_assignments ta JOIN staff st ON st.id = ta.staff_id
    WHERE ta.class_id = s.class_id AND ta.subject_id = s.subject_id LIMIT 1) AS "teacherName"
`;

const SHEET_FROM = `
  FROM score_sheets s
  JOIN school_classes c ON c.id = s.class_id
  JOIN school_levels lvl ON lvl.id = c.level_id
  JOIN subjects sub ON sub.id = s.subject_id
  JOIN terms t ON t.id = s.term_id
  JOIN academic_sessions ses ON ses.id = t.session_id
`;

export class AssessmentRepository extends TenantRepository<ScoreSheet> {
  static Instance = new AssessmentRepository();

  private constructor() {
    super(ScoreSheet, 'sheet');
  }

  /* -- Grading schemes ------------------------------------------------------- */

  async schemesForSchool(schoolId: string): Promise<GradingSchemeDTO[]> {
    const schemes: Omit<GradingSchemeDTO, 'components' | 'bands' | 'levelNames'>[] = await this.repo.query(
      `SELECT id, school_id AS "schoolId", name, description, is_default AS "isDefault",
              pass_mark AS "passMark", level_ids AS "levelIds", show_position AS "showPosition", version
         FROM grading_schemes WHERE school_id = $1 ORDER BY is_default DESC, name ASC`,
      [schoolId],
    );
    if (schemes.length === 0) return [];

    const ids = schemes.map((scheme) => scheme.id);
    const [components, bands, levels]: [
      AssessmentComponentDTO[],
      (GradeBandDTO & { schemeId: string; gradePoint: string | null })[],
      { id: string; name: string }[],
    ] = await Promise.all([
      this.repo.query(
        `SELECT id, school_id AS "schoolId", scheme_id AS "schemeId", name, code, max_score AS "maxScore", sequence, type
           FROM assessment_components WHERE scheme_id = ANY($1::uuid[]) ORDER BY sequence ASC`,
        [ids],
      ),
      this.repo.query(
        `SELECT id, scheme_id AS "schemeId", label, min_score AS "minScore", max_score AS "maxScore",
                remark, grade_point AS "gradePoint", is_pass AS "isPass", color
           FROM grade_bands WHERE scheme_id = ANY($1::uuid[]) ORDER BY min_score DESC`,
        [ids],
      ),
      this.repo.query(`SELECT id, name FROM school_levels WHERE school_id = $1 AND deleted_at IS NULL`, [schoolId]),
    ]);
    const levelName = new Map(levels.map((level) => [level.id, level.name]));

    return schemes.map((scheme) => ({
      ...scheme,
      components: components.filter((component) => component.schemeId === scheme.id),
      bands: bands
        .filter((band) => band.schemeId === scheme.id)
        .map(({ schemeId: _schemeId, gradePoint, ...band }) => ({
          ...band,
          gradePoint: gradePoint === null ? null : Number(gradePoint),
        })),
      levelNames: scheme.levelIds.map((id) => levelName.get(id) ?? '').filter(Boolean),
    }));
  }

  async findSchemeDTO(schoolId: string, id: string): Promise<GradingSchemeDTO | null> {
    return (await this.schemesForSchool(schoolId)).find((scheme) => scheme.id === id) ?? null;
  }

  async createScheme(
    scheme: DeepPartial<GradingScheme>,
    components: DeepPartial<AssessmentComponent>[],
    bands: DeepPartial<GradeBand>[],
    manager: EntityManager,
  ): Promise<GradingScheme> {
    const schemeRepo = manager.getRepository(GradingScheme);
    const saved = await schemeRepo.save(schemeRepo.create(scheme));
    const componentRepo = manager.getRepository(AssessmentComponent);
    await componentRepo.save(components.map((c) => componentRepo.create({ ...c, schemeId: saved.id, schoolId: saved.schoolId })));
    const bandRepo = manager.getRepository(GradeBand);
    await bandRepo.save(bands.map((b) => bandRepo.create({ ...b, schemeId: saved.id, schoolId: saved.schoolId })));
    return saved;
  }

  async updateScheme(schoolId: string, id: string, patch: DeepPartial<GradingScheme>, manager: EntityManager): Promise<void> {
    await manager.getRepository(GradingScheme).update({ id, schoolId }, patch as never);
  }

  async clearDefault(schoolId: string, exceptId: string, manager: EntityManager): Promise<void> {
    await manager.query(`UPDATE grading_schemes SET is_default = FALSE WHERE school_id = $1 AND id <> $2`, [schoolId, exceptId]);
  }

  /** Components are matched by id so marks already entered against them survive an edit. */
  async replaceComponents(
    schoolId: string,
    schemeId: string,
    components: (DeepPartial<AssessmentComponent> & { id?: string })[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(AssessmentComponent);
    const keep: string[] = [];
    for (const component of components) {
      const existing = component.id ? await repo.findOne({ where: { id: component.id, schemeId, schoolId } }) : null;
      if (existing) {
        await repo.update(existing.id, { ...component, id: existing.id } as never);
        keep.push(existing.id);
      } else {
        const { id: _ignored, ...fresh } = component;
        const saved = await repo.save(repo.create({ ...fresh, schemeId, schoolId }));
        keep.push(saved.id);
      }
    }
    await manager.query(
      `DELETE FROM assessment_components WHERE scheme_id = $1 AND NOT (id = ANY($2::uuid[]))`,
      [schemeId, keep],
    );
  }

  async componentsWithMarks(schemeId: string, manager: EntityManager): Promise<string[]> {
    const rows: { id: string }[] = await manager.query(
      `SELECT DISTINCT c.id FROM assessment_components c
         JOIN score_entries e ON e.component_id = c.id AND e.score IS NOT NULL
        WHERE c.scheme_id = $1`,
      [schemeId],
    );
    return rows.map((row) => row.id);
  }

  async replaceBands(schoolId: string, schemeId: string, bands: DeepPartial<GradeBand>[], manager: EntityManager): Promise<void> {
    await manager.query(`DELETE FROM grade_bands WHERE scheme_id = $1`, [schemeId]);
    const repo = manager.getRepository(GradeBand);
    await repo.save(bands.map(({ id: _ignored, ...band }) => repo.create({ ...band, schemeId, schoolId })));
  }

  /* -- Score sheets ---------------------------------------------------------- */

  /** Every (class, subject) a teacher is assigned — the sheets a term needs. */
  async teachingPairs(schoolId: string): Promise<{ classId: string; subjectId: string; levelId: string }[]> {
    return this.repo.query(
      `SELECT DISTINCT ta.class_id AS "classId", ta.subject_id AS "subjectId", c.level_id AS "levelId"
         FROM teaching_assignments ta
         JOIN school_classes c ON c.id = ta.class_id AND c.deleted_at IS NULL AND c.is_active = TRUE
         JOIN subjects sub ON sub.id = ta.subject_id AND sub.deleted_at IS NULL
        WHERE ta.school_id = $1`,
      [schoolId],
    );
  }

  async levelOfClasses(schoolId: string, classIds: string[]): Promise<Map<string, string>> {
    if (classIds.length === 0) return new Map();
    const rows: { id: string; levelId: string }[] = await this.repo.query(
      `SELECT id, level_id AS "levelId" FROM school_classes WHERE school_id = $1 AND id = ANY($2::uuid[])`,
      [schoolId, classIds],
    );
    return new Map(rows.map((row) => [row.id, row.levelId]));
  }

  /** Makes the sheets that do not yet exist; existing ones are left exactly as they are. */
  async ensureSheets(
    schoolId: string,
    termId: string,
    pairs: { classId: string; subjectId: string; gradingSchemeId: string }[],
  ): Promise<void> {
    if (pairs.length === 0) return;
    await this.repo.query(
      `INSERT INTO score_sheets (school_id, class_id, subject_id, term_id, grading_scheme_id, status, version)
       SELECT $1, p.class_id::uuid, p.subject_id::uuid, $2, p.scheme_id::uuid, 'DRAFT', 1
         FROM jsonb_to_recordset($3::jsonb) AS p(class_id text, subject_id text, scheme_id text)
       ON CONFLICT (class_id, subject_id, term_id) DO NOTHING`,
      [
        schoolId,
        termId,
        JSON.stringify(pairs.map((pair) => ({ class_id: pair.classId, subject_id: pair.subjectId, scheme_id: pair.gradingSchemeId }))),
      ],
    );
  }

  async fetchSheets(schoolId: string, filter: SheetFilter): Promise<Paginated<SheetRow & SheetSummaryCounts>> {
    if (filter.pairs && filter.pairs.length === 0) {
      return paginatedResult<SheetRow & SheetSummaryCounts>([], filter.page, filter.pageSize, 0);
    }
    const params: unknown[] = [schoolId, filter.termId];
    const where = ['s.school_id = $1', 's.term_id = $2'];
    const eq = (column: string, value: string | undefined) => {
      if (!value) return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    };
    eq('s.class_id', filter.classId);
    eq('s.subject_id', filter.subjectId);
    eq('s.status', filter.status);
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(`(c.name ILIKE $${i} OR sub.name ILIKE $${i})`);
    }
    if (filter.pairs) {
      params.push(filter.pairs.map((pair) => pair.classId));
      const classes = params.length;
      params.push(filter.pairs.map((pair) => pair.subjectId));
      const subjects = params.length;
      where.push(
        `EXISTS (SELECT 1 FROM unnest($${classes}::uuid[], $${subjects}::uuid[]) AS pair(class_id, subject_id)
                  WHERE pair.class_id = s.class_id AND pair.subject_id = s.subject_id)`,
      );
    }
    const whereSql = where.join(' AND ');

    const [countRow] = await this.repo.query(`SELECT COUNT(*)::int AS total ${SHEET_FROM} WHERE ${whereSql}`, params);
    const rows: (SheetRow & SheetSummaryCounts)[] = await this.repo.query(
      `SELECT ${SHEET_PROJECTION},
              s.id AS "sheetId",
              (SELECT COUNT(DISTINCT e.student_id)::int FROM score_entries e
                WHERE e.score_sheet_id = s.id AND e.score IS NOT NULL) AS "enteredCount",
              (SELECT COUNT(*)::int FROM students st
                WHERE st.current_class_id = s.class_id AND st.status = 'ACTIVE' AND st.deleted_at IS NULL) AS "totalCount"
         ${SHEET_FROM}
        WHERE ${whereSql}
        ORDER BY c.name ASC, sub.name ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );
    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  async findSheet(schoolId: string, id: string): Promise<SheetRow | null> {
    const rows: SheetRow[] = await this.repo.query(
      `SELECT ${SHEET_PROJECTION} ${SHEET_FROM} WHERE s.school_id = $1 AND s.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async sheetsForClassTerm(schoolId: string, classId: string, termId: string, statuses: ResultStatus[]): Promise<SheetRow[]> {
    return this.repo.query(
      `SELECT ${SHEET_PROJECTION} ${SHEET_FROM}
        WHERE s.school_id = $1 AND s.class_id = $2 AND s.term_id = $3 AND s.status = ANY($4::text[])
        ORDER BY sub.name ASC`,
      [schoolId, classId, termId, statuses],
    );
  }

  /** Every sheet a pupil has a mark on, for a term (or all of them), regardless of class. */
  async sheetsForStudent(schoolId: string, studentId: string, termId: string | null, statuses: ResultStatus[]): Promise<SheetRow[]> {
    const params: unknown[] = [schoolId, studentId, statuses];
    const termClause = termId ? 'AND s.term_id = $4' : '';
    if (termId) params.push(termId);
    return this.repo.query(
      `SELECT DISTINCT ${SHEET_PROJECTION} ${SHEET_FROM}
        WHERE s.school_id = $1 AND s.status = ANY($3::text[]) ${termClause}
          AND EXISTS (SELECT 1 FROM score_entries e WHERE e.score_sheet_id = s.id AND e.student_id = $2)
        ORDER BY "sessionStartDate" ASC, "termSequence" ASC, "subjectName" ASC`,
      params,
    );
  }

  async sheetsForTerm(schoolId: string, termId: string, statuses: ResultStatus[]): Promise<SheetRow[]> {
    return this.repo.query(
      `SELECT ${SHEET_PROJECTION} ${SHEET_FROM}
        WHERE s.school_id = $1 AND s.term_id = $2 AND s.status = ANY($3::text[])`,
      [schoolId, termId, statuses],
    );
  }

  /**
   * Who is on the sheet: the class as it stands, plus anyone who has since
   * moved class but still has marks here — a mark is a record of a term, and
   * a promotion must not erase it.
   */
  async rosterForSheet(schoolId: string, sheetId: string, classId: string): Promise<RosterRow[]> {
    return this.repo.query(
      `SELECT DISTINCT st.id AS "studentId",
              concat_ws(' ', st.first_name, NULLIF(st.middle_name, ''), st.last_name) AS "studentName",
              st.admission_no AS "admissionNo",
              CASE WHEN st.photo_consent THEN st.photo_url END AS "photoUrl",
              st.photo_consent AS "photoConsent",
              st.current_class_id AS "currentClassId",
              st.last_name, st.first_name
         FROM students st
         LEFT JOIN score_entries e ON e.student_id = st.id AND e.score_sheet_id = $2
        WHERE st.school_id = $1 AND st.deleted_at IS NULL
          AND ((st.current_class_id = $3 AND st.status = 'ACTIVE') OR e.id IS NOT NULL)
        ORDER BY st.last_name ASC, st.first_name ASC`,
      [schoolId, sheetId, classId],
    );
  }

  async rosterForClass(schoolId: string, classId: string): Promise<RosterRow[]> {
    return this.repo.query(
      `SELECT st.id AS "studentId",
              concat_ws(' ', st.first_name, NULLIF(st.middle_name, ''), st.last_name) AS "studentName",
              st.admission_no AS "admissionNo",
              CASE WHEN st.photo_consent THEN st.photo_url END AS "photoUrl",
              st.photo_consent AS "photoConsent",
              st.current_class_id AS "currentClassId"
         FROM students st
        WHERE st.school_id = $1 AND st.current_class_id = $2 AND st.status = 'ACTIVE' AND st.deleted_at IS NULL
        ORDER BY st.last_name ASC, st.first_name ASC`,
      [schoolId, classId],
    );
  }

  async entriesForSheets(schoolId: string, sheetIds: string[]): Promise<EntryRow[]> {
    if (sheetIds.length === 0) return [];
    const rows: (Omit<EntryRow, 'score'> & { score: string | null })[] = await this.repo.query(
      `SELECT score_sheet_id AS "scoreSheetId", student_id AS "studentId", component_id AS "componentId", score
         FROM score_entries WHERE school_id = $1 AND score_sheet_id = ANY($2::uuid[])`,
      [schoolId, sheetIds],
    );
    return rows.map((row) => ({ ...row, score: row.score === null ? null : Number(row.score) }));
  }

  /**
   * Writes the marks in one statement and bumps the sheet's version, but only
   * if the caller's version is still current — a colleague who saved first
   * wins, and the second save is told so rather than overwriting them.
   */
  async saveScoresIfVersionMatches(
    schoolId: string,
    sheetId: string,
    expectedVersion: number,
    entries: { studentId: string; componentId: string; score: number | null }[],
    manager: EntityManager,
  ): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .update(ScoreSheet)
      .set({ version: () => 'version + 1' } as never)
      .where('id = :id AND school_id = :schoolId AND version = :expectedVersion', { id: sheetId, schoolId, expectedVersion })
      .execute();
    if ((result.affected ?? 0) === 0) return false;
    if (entries.length === 0) return true;

    await manager.query(
      `INSERT INTO score_entries (school_id, score_sheet_id, student_id, component_id, score)
       SELECT $1, $2, e.student_id::uuid, e.component_id::uuid, e.score
         FROM jsonb_to_recordset($3::jsonb) AS e(student_id text, component_id text, score numeric)
       ON CONFLICT (score_sheet_id, student_id, component_id)
       DO UPDATE SET score = EXCLUDED.score, updated_at = now()`,
      [
        schoolId,
        sheetId,
        JSON.stringify(entries.map((entry) => ({ student_id: entry.studentId, component_id: entry.componentId, score: entry.score }))),
      ],
    );
    return true;
  }

  async transitionSheet(schoolId: string, id: string, patch: DeepPartial<ScoreSheet>): Promise<void> {
    await this.repo.update({ id, schoolId }, { ...patch, version: () => 'version + 1' } as never);
  }

  /* -- Report cards, templates, transcripts ---------------------------------- */

  async findReportCard(schoolId: string, studentId: string, termId: string): Promise<ReportCardRecord | null> {
    return this.repo.manager.getRepository(ReportCardRecord).findOne({ where: { schoolId, studentId, termId } });
  }

  async upsertReportCard(data: DeepPartial<ReportCardRecord> & { schoolId: string; studentId: string; termId: string }): Promise<ReportCardRecord> {
    const repo = this.repo.manager.getRepository(ReportCardRecord);
    const existing = await repo.findOne({ where: { schoolId: data.schoolId, studentId: data.studentId, termId: data.termId } });
    if (existing) {
      await repo.update(existing.id, data as never);
      return (await repo.findOne({ where: { id: existing.id } }))!;
    }
    return repo.save(repo.create(data));
  }

  async findReportCardByCode(code: string): Promise<ReportCardRecord | null> {
    return this.repo.manager.getRepository(ReportCardRecord).findOne({ where: { verificationCode: code } });
  }

  async templatesForSchool(schoolId: string): Promise<CommentTemplateDTO[]> {
    return this.repo.query(
      `SELECT id, school_id AS "schoolId", audience, band, text, usage_count AS "usageCount"
         FROM comment_templates WHERE school_id = $1 ORDER BY audience ASC, band ASC, usage_count DESC`,
      [schoolId],
    );
  }

  async createTemplate(data: DeepPartial<CommentTemplate>): Promise<CommentTemplate> {
    const repo = this.repo.manager.getRepository(CommentTemplate);
    return repo.save(repo.create(data));
  }

  async countTemplateUse(schoolId: string, text: string): Promise<void> {
    await this.repo.query(
      `UPDATE comment_templates SET usage_count = usage_count + 1 WHERE school_id = $1 AND text = $2`,
      [schoolId, text],
    );
  }

  async findTranscriptIssue(schoolId: string, studentId: string): Promise<TranscriptIssue | null> {
    return this.repo.manager.getRepository(TranscriptIssue).findOne({ where: { schoolId, studentId } });
  }

  async findTranscriptIssueByCode(code: string): Promise<TranscriptIssue | null> {
    return this.repo.manager.getRepository(TranscriptIssue).findOne({ where: { verificationCode: code } });
  }

  async upsertTranscriptIssue(data: DeepPartial<TranscriptIssue> & { schoolId: string; studentId: string }): Promise<TranscriptIssue> {
    const repo = this.repo.manager.getRepository(TranscriptIssue);
    const existing = await repo.findOne({ where: { schoolId: data.schoolId, studentId: data.studentId } });
    if (existing) {
      await repo.update(existing.id, data as never);
      return (await repo.findOne({ where: { id: existing.id } }))!;
    }
    return repo.save(repo.create(data));
  }

  /* -- Analytics ------------------------------------------------------------- */

  async entriesForTerm(schoolId: string, termId: string, statuses: ResultStatus[]): Promise<EntryRow[]> {
    const rows: (Omit<EntryRow, 'score'> & { score: string | null })[] = await this.repo.query(
      `SELECT e.score_sheet_id AS "scoreSheetId", e.student_id AS "studentId", e.component_id AS "componentId", e.score
         FROM score_entries e JOIN score_sheets s ON s.id = e.score_sheet_id
        WHERE e.school_id = $1 AND s.term_id = $2 AND s.status = ANY($3::text[])`,
      [schoolId, termId, statuses],
    );
    return rows.map((row) => ({ ...row, score: row.score === null ? null : Number(row.score) }));
  }
}
