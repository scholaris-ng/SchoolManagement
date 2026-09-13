import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { Curriculum } from '../entities/curriculum.entity';
import { CurriculumTopic } from '../entities/curriculumTopic.entity';
import { LearningObjective } from '../entities/learningObjective.entity';
import type {
  CurriculumDTO,
  CurriculumTopicDTO,
  LearningObjectiveDTO,
} from '../dto/curriculum.dto';

const CURRICULUM_PROJECTION = `
  cur.id,
  cur.school_id            AS "schoolId",
  cur.name,
  cur.subject_id           AS "subjectId",
  sub.name                 AS "subjectName",
  cur.class_id             AS "classId",
  c.name                   AS "className",
  cur.level_id             AS "levelId",
  lvl.name                 AS "levelName",
  cur.session_id           AS "sessionId",
  ses.name                 AS "sessionName",
  cur.description,
  (SELECT COUNT(*)::int FROM curriculum_topics t WHERE t.curriculum_id = cur.id) AS "topicCount",
  (SELECT COUNT(*)::int
     FROM learning_objectives o
     JOIN curriculum_topics t ON t.id = o.topic_id
    WHERE t.curriculum_id = cur.id)                                              AS "objectiveCount",
  cur.is_active            AS "isActive",
  COALESCE(cur.created_by_user_id::text, '') AS "createdById",
  cur.created_by_name      AS "createdByName",
  cur.created_by_role      AS "createdByRole",
  cur.created_at           AS "createdAt",
  cur.updated_at           AS "updatedAt"
`;

const CURRICULUM_FROM = `
  FROM curricula cur
  JOIN subjects          sub ON sub.id = cur.subject_id
  JOIN school_classes    c   ON c.id   = cur.class_id
  JOIN school_levels     lvl ON lvl.id = cur.level_id
  JOIN academic_sessions ses ON ses.id = cur.session_id
`;

/**
 * Which plans a caller may see. `pairs` null means every plan in the school;
 * otherwise the plans for the (class, subject) pairs this teacher takes, plus
 * anything they wrote themselves, whoever teaches it now.
 */
export interface CurriculumVisibility {
  pairs: { classId: string; subjectId: string }[] | null;
  authorUserId: string;
}

export interface CurriculumFilter {
  subjectId?: string;
  levelId?: string;
  classId?: string;
  /** Undefined means every session; the service resolves "current" first. */
  sessionId?: string;
  createdById?: string;
  visibility: CurriculumVisibility;
}

/** A row of `learning_objectives` joined to its topic's sequence, for the code. */
interface ObjectiveRow {
  id: string;
  topicId: string;
  topicSequence: number;
  statement: string;
  sequence: number;
  bloomLevel: LearningObjectiveDTO['bloomLevel'];
  taughtAt: string | null;
  assessedAt: string | null;
}

function toObjectiveDTO(row: ObjectiveRow): LearningObjectiveDTO {
  return {
    id: row.id,
    topicId: row.topicId,
    code: `${row.topicSequence}.${row.sequence}`,
    statement: row.statement,
    sequence: row.sequence,
    bloomLevel: row.bloomLevel,
    taught: row.taughtAt !== null,
    assessed: row.assessedAt !== null,
    taughtOn: row.taughtAt,
  };
}

const OBJECTIVE_PROJECTION = `
  o.id,
  o.topic_id                          AS "topicId",
  t.sequence                          AS "topicSequence",
  o.statement,
  o.sequence,
  o.bloom_level                       AS "bloomLevel",
  to_char(o.taught_at, 'YYYY-MM-DD')   AS "taughtAt",
  to_char(o.assessed_at, 'YYYY-MM-DD') AS "assessedAt"
`;

function visibilityClause(
  params: unknown[],
  where: string[],
  visibility: CurriculumVisibility,
): void {
  if (visibility.pairs === null) return;
  params.push(visibility.pairs.map((pair) => pair.classId));
  const classes = params.length;
  params.push(visibility.pairs.map((pair) => pair.subjectId));
  const subjects = params.length;
  params.push(visibility.authorUserId);
  const author = params.length;
  where.push(
    `(EXISTS (
        SELECT 1 FROM unnest($${classes}::uuid[], $${subjects}::uuid[]) AS pair(class_id, subject_id)
         WHERE pair.class_id = cur.class_id AND pair.subject_id = cur.subject_id
      ) OR cur.created_by_user_id = $${author})`,
  );
}

export class CurriculumRepository extends TenantRepository<Curriculum> {
  static Instance = new CurriculumRepository();

  private constructor() {
    super(Curriculum, 'curriculum');
  }

  async fetchAll(schoolId: string, filter: CurriculumFilter): Promise<CurriculumDTO[]> {
    const params: unknown[] = [schoolId];
    const where = ['cur.school_id = $1'];

    const eq = (column: string, value: string | undefined) => {
      if (!value) return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    };
    eq('cur.subject_id', filter.subjectId);
    eq('cur.level_id', filter.levelId);
    eq('cur.class_id', filter.classId);
    eq('cur.session_id', filter.sessionId);
    eq('cur.created_by_user_id', filter.createdById);
    visibilityClause(params, where, filter.visibility);

    return this.repo.query(
      `SELECT ${CURRICULUM_PROJECTION} ${CURRICULUM_FROM}
        WHERE ${where.join(' AND ')}
        ORDER BY ses.start_date DESC, lvl.sequence ASC, c.name ASC, sub.name ASC`,
      params,
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<CurriculumDTO | null> {
    const rows: CurriculumDTO[] = await this.repo.query(
      `SELECT ${CURRICULUM_PROJECTION} ${CURRICULUM_FROM} WHERE cur.school_id = $1 AND cur.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async findByTrio(
    schoolId: string,
    trio: { sessionId: string; classId: string; subjectId: string },
  ): Promise<Curriculum | null> {
    return this.repo.findOne({ where: { schoolId, ...trio } });
  }

  async create(data: DeepPartial<Curriculum>): Promise<Curriculum> {
    return this.repo.save(this.repo.create(data));
  }

  async update(schoolId: string, id: string, patch: DeepPartial<Curriculum>): Promise<void> {
    await this.repo.update({ id, schoolId }, patch as never);
  }

  async remove(schoolId: string, id: string): Promise<boolean> {
    const result = await this.repo.delete({ id, schoolId });
    return (result.affected ?? 0) > 0;
  }

  /* -- Topics ---------------------------------------------------------------- */

  /** The whole tree for one curriculum: topics in order, each with its objectives in order. */
  async topicsWithObjectives(schoolId: string, curriculumId: string): Promise<CurriculumTopicDTO[]> {
    const [topics, objectives]: [
      Omit<CurriculumTopicDTO, 'objectives'>[],
      ObjectiveRow[],
    ] = await Promise.all([
      this.repo.query(
        `SELECT t.id, t.curriculum_id AS "curriculumId", t.title, t.description,
                t.sequence, t.suggested_weeks AS "suggestedWeeks"
           FROM curriculum_topics t
          WHERE t.school_id = $1 AND t.curriculum_id = $2
          ORDER BY t.sequence ASC, t.created_at ASC`,
        [schoolId, curriculumId],
      ),
      this.repo.query(
        `SELECT ${OBJECTIVE_PROJECTION}
           FROM learning_objectives o
           JOIN curriculum_topics t ON t.id = o.topic_id
          WHERE o.school_id = $1 AND t.curriculum_id = $2
          ORDER BY t.sequence ASC, o.sequence ASC, o.created_at ASC`,
        [schoolId, curriculumId],
      ),
    ]);

    const byTopic = new Map<string, LearningObjectiveDTO[]>();
    for (const row of objectives) {
      const list = byTopic.get(row.topicId) ?? [];
      list.push(toObjectiveDTO(row));
      byTopic.set(row.topicId, list);
    }
    return topics.map((topic) => ({ ...topic, objectives: byTopic.get(topic.id) ?? [] }));
  }

  async findTopic(schoolId: string, curriculumId: string, topicId: string): Promise<CurriculumTopic | null> {
    return this.repo.manager
      .getRepository(CurriculumTopic)
      .findOne({ where: { id: topicId, schoolId, curriculumId } });
  }

  async findTopicDTO(schoolId: string, topicId: string): Promise<CurriculumTopicDTO | null> {
    const rows: Omit<CurriculumTopicDTO, 'objectives'>[] = await this.repo.query(
      `SELECT t.id, t.curriculum_id AS "curriculumId", t.title, t.description,
              t.sequence, t.suggested_weeks AS "suggestedWeeks"
         FROM curriculum_topics t WHERE t.school_id = $1 AND t.id = $2`,
      [schoolId, topicId],
    );
    if (!rows[0]) return null;
    const objectives: ObjectiveRow[] = await this.repo.query(
      `SELECT ${OBJECTIVE_PROJECTION}
         FROM learning_objectives o JOIN curriculum_topics t ON t.id = o.topic_id
        WHERE o.school_id = $1 AND o.topic_id = $2
        ORDER BY o.sequence ASC, o.created_at ASC`,
      [schoolId, topicId],
    );
    return { ...rows[0], objectives: objectives.map(toObjectiveDTO) };
  }

  async nextTopicSequence(schoolId: string, curriculumId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COALESCE(MAX(sequence), 0)::int + 1 AS next
         FROM curriculum_topics WHERE school_id = $1 AND curriculum_id = $2`,
      [schoolId, curriculumId],
    );
    return Number(row?.next ?? 1);
  }

  async createTopic(data: DeepPartial<CurriculumTopic>): Promise<CurriculumTopic> {
    const repo = this.repo.manager.getRepository(CurriculumTopic);
    return repo.save(repo.create(data));
  }

  async updateTopic(schoolId: string, id: string, patch: DeepPartial<CurriculumTopic>): Promise<void> {
    await this.repo.manager.getRepository(CurriculumTopic).update({ id, schoolId }, patch as never);
  }

  async removeTopic(schoolId: string, id: string): Promise<boolean> {
    const result = await this.repo.manager.getRepository(CurriculumTopic).delete({ id, schoolId });
    return (result.affected ?? 0) > 0;
  }

  /* -- Objectives ------------------------------------------------------------ */

  async findObjective(schoolId: string, topicId: string, id: string): Promise<LearningObjective | null> {
    return this.repo.manager
      .getRepository(LearningObjective)
      .findOne({ where: { id, schoolId, topicId } });
  }

  async findObjectiveDTO(schoolId: string, id: string): Promise<LearningObjectiveDTO | null> {
    const rows: ObjectiveRow[] = await this.repo.query(
      `SELECT ${OBJECTIVE_PROJECTION}
         FROM learning_objectives o JOIN curriculum_topics t ON t.id = o.topic_id
        WHERE o.school_id = $1 AND o.id = $2`,
      [schoolId, id],
    );
    return rows[0] ? toObjectiveDTO(rows[0]) : null;
  }

  async nextObjectiveSequence(schoolId: string, topicId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COALESCE(MAX(sequence), 0)::int + 1 AS next
         FROM learning_objectives WHERE school_id = $1 AND topic_id = $2`,
      [schoolId, topicId],
    );
    return Number(row?.next ?? 1);
  }

  async createObjective(data: DeepPartial<LearningObjective>): Promise<LearningObjective> {
    const repo = this.repo.manager.getRepository(LearningObjective);
    return repo.save(repo.create(data));
  }

  async updateObjective(schoolId: string, id: string, patch: DeepPartial<LearningObjective>): Promise<void> {
    await this.repo.manager.getRepository(LearningObjective).update({ id, schoolId }, patch as never);
  }

  async removeObjective(schoolId: string, id: string): Promise<boolean> {
    const result = await this.repo.manager.getRepository(LearningObjective).delete({ id, schoolId });
    return (result.affected ?? 0) > 0;
  }

  /* -- Coverage -------------------------------------------------------------- */

  /**
   * Stamps or clears the two coverage dates on a set of objectives, only those
   * that belong to the named curriculum — an id from another plan is ignored,
   * not written. Returns how many rows changed.
   *
   * Marking assessed also marks taught; clearing taught also clears assessed.
   * Both keep the table's own check constraint true without a second query.
   */
  async markCoverage(
    schoolId: string,
    curriculumId: string,
    objectiveIds: string[],
    mark: { taught?: boolean; assessed?: boolean },
    today: string,
  ): Promise<number> {
    if (objectiveIds.length === 0) return 0;

    const sets: string[] = [];
    if (mark.taught === true) sets.push(`taught_at = COALESCE(o.taught_at, $4::date)`);
    if (mark.taught === false) sets.push(`taught_at = NULL`, `assessed_at = NULL`);
    if (mark.assessed === true) {
      sets.push(`assessed_at = COALESCE(o.assessed_at, $4::date)`);
      if (mark.taught !== true) sets.push(`taught_at = COALESCE(o.taught_at, $4::date)`);
    }
    if (mark.assessed === false && mark.taught !== false) sets.push(`assessed_at = NULL`);
    if (sets.length === 0) return 0;

    // Postgres refuses a bound parameter the statement never mentions, and a
    // pure clear mentions no date.
    const params: unknown[] = [schoolId, curriculumId, objectiveIds];
    if (sets.some((clause) => clause.includes('$4'))) params.push(today);

    // TypeORM answers an UPDATE with `[rows, rowCount]`, not the rows alone.
    const [, affected]: [unknown[], number] = await this.repo.query(
      `UPDATE learning_objectives o
          SET ${sets.join(', ')}, updated_at = now()
         FROM curriculum_topics t
        WHERE t.id = o.topic_id
          AND o.school_id = $1
          AND t.curriculum_id = $2
          AND o.id = ANY($3::uuid[])`,
      params,
    );
    return Number(affected ?? 0);
  }
}
