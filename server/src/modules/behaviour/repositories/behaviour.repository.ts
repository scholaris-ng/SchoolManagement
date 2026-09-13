import type { DeepPartial, EntityManager } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { BehaviourScale } from '../entities/behaviourScale.entity';
import { BehaviourTrait } from '../entities/behaviourTrait.entity';
import { BehaviourObservation } from '../entities/behaviourObservation.entity';
import { HousePointAward } from '../entities/housePointAward.entity';
import type {
  BehaviourObservationDTO,
  BehaviourScaleDTO,
  BehaviourTraitDTO,
  HousePointAwardDTO,
  StudentPointsRowDTO,
} from '../dto/behaviour.dto';

const TRAIT_PROJECTION = `
  t.id, t.school_id AS "schoolId", t.name, t.category, t.description,
  t.scale_id AS "scaleId", s.name AS "scaleName", t.level_ids AS "levelIds",
  t.appears_on_report_card AS "appearsOnReportCard", t.sequence, t.is_active AS "isActive"
`;

const OBSERVATION_PROJECTION = `
  o.id, o.school_id AS "schoolId", o.student_id AS "studentId",
  concat_ws(' ', st.first_name, NULLIF(st.middle_name, ''), st.last_name) AS "studentName",
  st.admission_no AS "admissionNo",
  o.trait_id AS "traitId", tr.name AS "traitName", o.term_id AS "termId",
  o.rating, o.scale_max AS "scaleMax", o.note,
  o.observed_by_name AS "observedByName", o.observed_at AS "observedAt"
`;

const AWARD_PROJECTION = `
  a.id, a.school_id AS "schoolId", a.student_id AS "studentId",
  concat_ws(' ', st.first_name, NULLIF(st.middle_name, ''), st.last_name) AS "studentName",
  st.admission_no AS "admissionNo",
  a.house_id AS "houseId", h.name AS "houseName", h.color AS "houseColor",
  a.points, a.reason, a.note, a.awarded_by_name AS "awardedByName",
  a.awarded_at AS "awardedAt", a.term_id AS "termId"
`;

export interface ObservationFilter {
  page: number;
  pageSize: number;
  search?: string;
  traitId?: string;
  classId?: string;
  studentId?: string;
  termId?: string;
  visibleIds: string[] | null;
}

export interface AwardFilter {
  page: number;
  pageSize: number;
  search?: string;
  studentId?: string;
  houseId?: string;
  termId?: string;
  visibleIds: string[] | null;
}

/** One observation, as the term-rating aggregation reads it. */
export interface ObservationPointRow {
  traitId: string;
  traitName: string;
  category: BehaviourTraitDTO['category'];
  rating: number;
  scaleMax: number;
  observedAt: string;
  scalePoints: BehaviourScaleDTO['points'];
}

export class BehaviourRepository extends TenantRepository<BehaviourTrait> {
  static Instance = new BehaviourRepository();

  private constructor() {
    super(BehaviourTrait, 'trait');
  }

  /* -- Scales ---------------------------------------------------------------- */

  async scalesForSchool(schoolId: string): Promise<BehaviourScaleDTO[]> {
    return this.repo.query(
      `SELECT id, school_id AS "schoolId", name, min, max, points
         FROM behaviour_scales WHERE school_id = $1 ORDER BY max DESC, name ASC`,
      [schoolId],
    );
  }

  async findScale(schoolId: string, id: string): Promise<BehaviourScale | null> {
    return this.repo.manager.getRepository(BehaviourScale).findOne({ where: { id, schoolId } });
  }

  async createScales(rows: DeepPartial<BehaviourScale>[]): Promise<void> {
    const repo = this.repo.manager.getRepository(BehaviourScale);
    await repo.save(rows.map((row) => repo.create(row)));
  }

  /* -- Traits ---------------------------------------------------------------- */

  async traitsForSchool(schoolId: string): Promise<BehaviourTraitDTO[]> {
    return this.repo.query(
      `SELECT ${TRAIT_PROJECTION}
         FROM behaviour_traits t JOIN behaviour_scales s ON s.id = t.scale_id
        WHERE t.school_id = $1
        ORDER BY t.sequence ASC, t.name ASC`,
      [schoolId],
    );
  }

  async findTraitDTO(schoolId: string, id: string): Promise<BehaviourTraitDTO | null> {
    const rows: BehaviourTraitDTO[] = await this.repo.query(
      `SELECT ${TRAIT_PROJECTION}
         FROM behaviour_traits t JOIN behaviour_scales s ON s.id = t.scale_id
        WHERE t.school_id = $1 AND t.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async nextTraitSequence(schoolId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COALESCE(MAX(sequence), 0)::int + 1 AS next FROM behaviour_traits WHERE school_id = $1`,
      [schoolId],
    );
    return Number(row?.next ?? 1);
  }

  async createTrait(data: DeepPartial<BehaviourTrait>): Promise<BehaviourTrait> {
    return this.repo.save(this.repo.create(data));
  }

  async updateTrait(schoolId: string, id: string, patch: DeepPartial<BehaviourTrait>): Promise<void> {
    await this.repo.update({ id, schoolId }, patch as never);
  }

  /* -- Observations ---------------------------------------------------------- */

  async fetchObservations(
    schoolId: string,
    filter: ObservationFilter,
  ): Promise<Paginated<BehaviourObservationDTO>> {
    if (filter.visibleIds && filter.visibleIds.length === 0) {
      return paginatedResult<BehaviourObservationDTO>([], filter.page, filter.pageSize, 0);
    }

    const params: unknown[] = [schoolId];
    const where = ['o.school_id = $1'];
    const eq = (column: string, value: string | undefined) => {
      if (!value) return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    };
    eq('o.trait_id', filter.traitId);
    eq('o.student_id', filter.studentId);
    eq('o.term_id', filter.termId);
    eq('st.current_class_id', filter.classId);
    if (filter.visibleIds) {
      params.push(filter.visibleIds);
      where.push(`o.student_id = ANY($${params.length}::uuid[])`);
    }
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(
        `(st.first_name ILIKE $${i} OR st.last_name ILIKE $${i} OR st.admission_no ILIKE $${i} OR tr.name ILIKE $${i})`,
      );
    }
    const from = `
      FROM behaviour_observations o
      JOIN students st ON st.id = o.student_id
      JOIN behaviour_traits tr ON tr.id = o.trait_id
      WHERE ${where.join(' AND ')}`;

    const [countRow] = await this.repo.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const rows: BehaviourObservationDTO[] = await this.repo.query(
      `SELECT ${OBSERVATION_PROJECTION} ${from}
        ORDER BY o.observed_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );
    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  async findObservationDTO(schoolId: string, id: string): Promise<BehaviourObservationDTO | null> {
    const rows: BehaviourObservationDTO[] = await this.repo.query(
      `SELECT ${OBSERVATION_PROJECTION}
         FROM behaviour_observations o
         JOIN students st ON st.id = o.student_id
         JOIN behaviour_traits tr ON tr.id = o.trait_id
        WHERE o.school_id = $1 AND o.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async createObservation(data: DeepPartial<BehaviourObservation>): Promise<BehaviourObservation> {
    const repo = this.repo.manager.getRepository(BehaviourObservation);
    return repo.save(repo.create(data));
  }

  /** Every observation of one pupil in one term, oldest first, with the scale to label it. */
  async observationPoints(schoolId: string, studentId: string, termId: string): Promise<ObservationPointRow[]> {
    return this.repo.query(
      `SELECT o.trait_id AS "traitId", tr.name AS "traitName", tr.category,
              o.rating, o.scale_max AS "scaleMax",
              to_char(o.observed_at, 'YYYY-MM-DD') AS "observedAt",
              s.points AS "scalePoints"
         FROM behaviour_observations o
         JOIN behaviour_traits tr ON tr.id = o.trait_id
         JOIN behaviour_scales s ON s.id = tr.scale_id
        WHERE o.school_id = $1 AND o.student_id = $2 AND o.term_id = $3
        ORDER BY tr.sequence ASC, o.observed_at ASC`,
      [schoolId, studentId, termId],
    );
  }

  /* -- House points ---------------------------------------------------------- */

  async fetchAwards(schoolId: string, filter: AwardFilter): Promise<Paginated<HousePointAwardDTO>> {
    if (filter.visibleIds && filter.visibleIds.length === 0) {
      return paginatedResult<HousePointAwardDTO>([], filter.page, filter.pageSize, 0);
    }

    const params: unknown[] = [schoolId];
    const where = ['a.school_id = $1'];
    const eq = (column: string, value: string | undefined) => {
      if (!value) return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    };
    eq('a.student_id', filter.studentId);
    eq('a.house_id', filter.houseId);
    eq('a.term_id', filter.termId);
    if (filter.visibleIds) {
      params.push(filter.visibleIds);
      where.push(`a.student_id = ANY($${params.length}::uuid[])`);
    }
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(
        `(st.first_name ILIKE $${i} OR st.last_name ILIKE $${i} OR st.admission_no ILIKE $${i} OR h.name ILIKE $${i})`,
      );
    }
    const from = `
      FROM house_point_awards a
      JOIN students st ON st.id = a.student_id
      JOIN houses h ON h.id = a.house_id
      WHERE ${where.join(' AND ')}`;

    const [countRow] = await this.repo.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const rows: HousePointAwardDTO[] = await this.repo.query(
      `SELECT ${AWARD_PROJECTION} ${from}
        ORDER BY a.awarded_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );
    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  async findAwardDTO(schoolId: string, id: string): Promise<HousePointAwardDTO | null> {
    const rows: HousePointAwardDTO[] = await this.repo.query(
      `SELECT ${AWARD_PROJECTION}
         FROM house_point_awards a
         JOIN students st ON st.id = a.student_id
         JOIN houses h ON h.id = a.house_id
        WHERE a.school_id = $1 AND a.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  /**
   * Writes the award and moves the house's running total in one transaction,
   * so the standings can never drift from the awards behind them.
   */
  async award(data: DeepPartial<HousePointAward>, manager: EntityManager): Promise<HousePointAward> {
    const repo = manager.getRepository(HousePointAward);
    const saved = await repo.save(repo.create(data));
    await manager.query(
      `UPDATE houses SET points = points + $1, updated_at = now() WHERE id = $2 AND school_id = $3`,
      [data.points, data.houseId, data.schoolId],
    );
    return saved;
  }

  /** Pupils ranked by points, over one term or all time. */
  async studentStandings(schoolId: string, termId: string | undefined, limit: number): Promise<StudentPointsRowDTO[]> {
    const params: unknown[] = [schoolId, limit];
    const termClause = termId ? `AND a.term_id = $3` : '';
    if (termId) params.push(termId);

    const rows: Omit<StudentPointsRowDTO, 'rank'>[] = await this.repo.query(
      `SELECT st.id AS "studentId",
              concat_ws(' ', st.first_name, NULLIF(st.middle_name, ''), st.last_name) AS "studentName",
              st.admission_no AS "admissionNo",
              c.name AS "className",
              h.name AS "houseName",
              h.color AS "houseColor",
              SUM(a.points)::int AS points
         FROM house_point_awards a
         JOIN students st ON st.id = a.student_id AND st.deleted_at IS NULL
         LEFT JOIN school_classes c ON c.id = st.current_class_id
         LEFT JOIN houses h ON h.id = st.house_id
        WHERE a.school_id = $1 ${termClause}
        GROUP BY st.id, c.name, h.name, h.color
        ORDER BY points DESC, "studentName" ASC
        LIMIT $2`,
      params,
    );
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  }

  /** The house totals for one term — the standings when a term is asked for. */
  async houseTotalsForTerm(schoolId: string, termId: string): Promise<Map<string, number>> {
    const rows: { houseId: string; points: number }[] = await this.repo.query(
      `SELECT house_id AS "houseId", SUM(points)::int AS points
         FROM house_point_awards WHERE school_id = $1 AND term_id = $2 GROUP BY house_id`,
      [schoolId, termId],
    );
    return new Map(rows.map((row) => [row.houseId, Number(row.points)]));
  }
}
