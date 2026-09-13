import { AppError } from '../../../shared/errors/AppError';
import type { RequestContext } from '../../../shared/types/context';
import type { Paginated } from '../../../shared/response/apiResponse';
import { AppDataSource } from '../../../infrastructure/database/dataSource';
import { AuditService } from '../../audit/services/audit.service';
import { TermRepository } from '../../academics/repositories/term.repository';
import { HouseRepository } from '../../academics/repositories/facility.repository';
import { AcademicScopeService } from '../../academics/services/academicScope.service';
import { StudentRepository } from '../../students/repositories/student.repository';
import { StudentAccessService } from '../../students/services/studentAccess.service';
import { BehaviourRepository } from '../repositories/behaviour.repository';
import type { BehaviourScale } from '../entities/behaviourScale.entity';
import type {
  BehaviourObservationDTO,
  BehaviourScaleDTO,
  BehaviourTermRatingDTO,
  BehaviourTraitDTO,
  HousePointAwardDTO,
  LeaderboardDTO,
} from '../dto/behaviour.dto';
import type {
  AwardHousePointsInput,
  CreateTraitInput,
  FetchHousePointsQuery,
  FetchObservationsQuery,
  RecordObservationInput,
  UpdateTraitInput,
} from '../validators/behaviour.schema';
import type { TermDTO } from '../../academics/dto/academics.dto';

/**
 * A school's first two scales, written the first time anyone asks for them.
 * The screens offer no way to create a scale, only to pick one, so a school
 * with none could never rate anything.
 */
const DEFAULT_SCALES: Omit<BehaviourScale, 'id' | 'schoolId' | 'createdAt' | 'updatedAt' | 'school'>[] = [
  {
    name: 'Five-point scale',
    min: 1,
    max: 5,
    points: [
      { value: 1, label: 'Poor' },
      { value: 2, label: 'Fair' },
      { value: 3, label: 'Good' },
      { value: 4, label: 'Very good' },
      { value: 5, label: 'Excellent' },
    ],
  },
  {
    name: 'Three-point scale',
    min: 1,
    max: 3,
    points: [
      { value: 1, label: 'Needs improvement' },
      { value: 2, label: 'Satisfactory' },
      { value: 3, label: 'Excellent' },
    ],
  },
];

/**
 * Behaviour and house points (spec sections 23 and 24).
 *
 * An observation is a note about a named child that a parent will later read,
 * so it is recorded on the day, by a named member of staff, against the term
 * it happened in — and never edited. The report card's behaviour section is
 * the average of those observations, which is what makes it worth reading.
 *
 * Reads are narrowed by `StudentAccessService`: a parent sees their own
 * children's observations and awards and nobody else's.
 */
export class BehaviourService {
  static Instance = new BehaviourService();

  private constructor(
    private readonly behaviour = BehaviourRepository.Instance,
    private readonly students = StudentRepository.Instance,
    private readonly houses = HouseRepository.Instance,
    private readonly terms = TermRepository.Instance,
    private readonly access = StudentAccessService.Instance,
    private readonly scope = AcademicScopeService.Instance,
    private readonly audit = AuditService.Instance,
  ) {}

  /* -- Scales and traits ----------------------------------------------------- */

  async fetchScales(context: RequestContext): Promise<BehaviourScaleDTO[]> {
    const existing = await this.behaviour.scalesForSchool(context.schoolId);
    if (existing.length > 0) return existing;

    await this.behaviour.createScales(
      DEFAULT_SCALES.map((scale) => ({ ...scale, schoolId: context.schoolId })),
    );
    return this.behaviour.scalesForSchool(context.schoolId);
  }

  async fetchTraits(context: RequestContext): Promise<BehaviourTraitDTO[]> {
    return this.behaviour.traitsForSchool(context.schoolId);
  }

  async createTrait(context: RequestContext, input: CreateTraitInput): Promise<BehaviourTraitDTO> {
    const { schoolId } = context;
    if (!(await this.behaviour.findScale(schoolId, input.scaleId))) throw AppError.notFound('Scale');

    const created = await this.behaviour.createTrait({
      schoolId,
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      scaleId: input.scaleId,
      levelIds: input.levelIds ?? [],
      appearsOnReportCard: input.appearsOnReportCard,
      sequence: input.sequence ?? (await this.behaviour.nextTraitSequence(schoolId)),
      isActive: input.isActive,
    });

    const dto = await this.behaviour.findTraitDTO(schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  async updateTrait(context: RequestContext, id: string, patch: UpdateTraitInput): Promise<BehaviourTraitDTO> {
    const { schoolId } = context;
    if (!(await this.behaviour.findTraitDTO(schoolId, id))) throw AppError.notFound('Trait');
    if (patch.scaleId && !(await this.behaviour.findScale(schoolId, patch.scaleId))) {
      throw AppError.notFound('Scale');
    }

    const columns: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) columns[key] = value;
    }
    if (Object.keys(columns).length > 0) await this.behaviour.updateTrait(schoolId, id, columns);

    const dto = await this.behaviour.findTraitDTO(schoolId, id);
    if (!dto) throw AppError.notFound('Trait');
    return dto;
  }

  /* -- Observations ---------------------------------------------------------- */

  async fetchObservations(
    context: RequestContext,
    query: FetchObservationsQuery,
  ): Promise<Paginated<BehaviourObservationDTO>> {
    return this.behaviour.fetchObservations(context.schoolId, {
      ...query,
      visibleIds: await this.access.visibleStudentIds(context),
    });
  }

  /**
   * Recorded against the current term, on the day, by whoever saw it. The
   * rating must sit on the trait's own scale, and the scale's ceiling is
   * stored with the observation so a later change to the scale cannot
   * re-grade the past.
   */
  async recordObservation(
    context: RequestContext,
    input: RecordObservationInput,
  ): Promise<BehaviourObservationDTO> {
    const { schoolId } = context;
    const [student, trait, term] = await Promise.all([
      this.students.findOneDTO(schoolId, input.studentId),
      this.behaviour.findTraitDTO(schoolId, input.traitId),
      this.currentTerm(schoolId),
    ]);
    if (!student) throw AppError.notFound('Student');
    if (!trait) throw AppError.notFound('Trait');
    if (!trait.isActive) throw AppError.validation(`${trait.name} is no longer rated.`);
    await this.refuseOutsideOwnClasses(context, student.currentClassId);

    const scale = await this.behaviour.findScale(schoolId, trait.scaleId);
    if (!scale) throw AppError.internal();
    if (input.rating < scale.min || input.rating > scale.max) {
      throw AppError.validation(
        `${trait.name} is rated from ${scale.min} to ${scale.max} on the ${scale.name}.`,
      );
    }

    const created = await this.behaviour.createObservation({
      schoolId,
      studentId: student.id,
      traitId: trait.id,
      termId: term.id,
      rating: input.rating,
      scaleMax: scale.max,
      note: input.note ?? null,
      observedByUserId: context.user.id,
      observedByName: context.user.displayName,
      observedAt: new Date(),
    });

    const dto = await this.behaviour.findObservationDTO(schoolId, created.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  /**
   * One pupil's term, trait by trait: how many times they were rated, the
   * average, what that average is called on the scale, and the run of ratings
   * behind it — the report card's behaviour section, and the portal's tab.
   */
  async fetchStudentTermRatings(
    context: RequestContext,
    studentId: string,
    termId: string | undefined,
  ): Promise<BehaviourTermRatingDTO[]> {
    if (!(await this.access.canSeeStudent(context, studentId))) throw AppError.notFound('Student');

    const term = termId
      ? await this.terms.findOneDTO(context.schoolId, termId)
      : (await this.terms.fetchForSchool(context.schoolId)).find((entry) => entry.isCurrent) ?? null;
    if (termId && !term) throw AppError.notFound('Term');
    if (!term) return [];

    const points = await this.behaviour.observationPoints(context.schoolId, studentId, term.id);

    const byTrait = new Map<string, BehaviourTermRatingDTO & { total: number }>();
    for (const point of points) {
      const entry = byTrait.get(point.traitId) ?? {
        traitId: point.traitId,
        traitName: point.traitName,
        category: point.category,
        observationCount: 0,
        averageRating: 0,
        scaleMax: point.scaleMax,
        label: '',
        trend: [],
        total: 0,
      };
      entry.observationCount += 1;
      entry.total += point.rating;
      entry.scaleMax = Math.max(entry.scaleMax, point.scaleMax);
      entry.trend.push({ date: point.observedAt, rating: point.rating });
      byTrait.set(point.traitId, entry);

      // The label is the scale point nearest the running average.
      const average = entry.total / entry.observationCount;
      entry.averageRating = Math.round(average * 10) / 10;
      const nearest = [...point.scalePoints].sort(
        (a, b) => Math.abs(a.value - average) - Math.abs(b.value - average),
      )[0];
      entry.label = nearest?.label ?? '';
    }

    return [...byTrait.values()].map(({ total: _total, ...row }) => row);
  }

  /* -- House points ---------------------------------------------------------- */

  async fetchHousePoints(
    context: RequestContext,
    query: FetchHousePointsQuery,
  ): Promise<Paginated<HousePointAwardDTO>> {
    return this.behaviour.fetchAwards(context.schoolId, {
      ...query,
      visibleIds: await this.access.visibleStudentIds(context),
    });
  }

  /** Points go to the pupil's own house; a pupil in no house has nowhere to put them. */
  async awardHousePoints(context: RequestContext, input: AwardHousePointsInput): Promise<HousePointAwardDTO> {
    const { schoolId } = context;
    const [student, term] = await Promise.all([
      this.students.findOneDTO(schoolId, input.studentId),
      this.currentTerm(schoolId),
    ]);
    if (!student) throw AppError.notFound('Student');
    if (!student.houseId) {
      throw AppError.validation(`${student.fullName} is not in a house yet. Assign one on their record first.`);
    }
    await this.refuseOutsideOwnClasses(context, student.currentClassId);

    const saved = await AppDataSource.transaction((manager) =>
      this.behaviour.award(
        {
          schoolId,
          studentId: student.id,
          houseId: student.houseId!,
          termId: term.id,
          points: input.points,
          reason: input.reason,
          note: input.note ?? null,
          awardedByUserId: context.user.id,
          awardedByName: context.user.displayName,
          awardedAt: new Date(),
        },
        manager,
      ),
    );

    await this.audit.record(context, {
      action: input.points < 0 ? 'house.points_deducted' : 'house.points_awarded',
      entityType: 'Student',
      entityId: student.id,
      entityLabel: student.fullName,
      after: { houseId: student.houseId, points: input.points, reason: input.reason },
    });

    const dto = await this.behaviour.findAwardDTO(schoolId, saved.id);
    if (!dto) throw AppError.internal();
    return dto;
  }

  /**
   * The standings. All-time totals come straight from the houses (kept in
   * step with every award); a term's standings are summed from that term's
   * awards alone. Pupils are ranked from the awards either way.
   */
  async fetchLeaderboard(context: RequestContext, termId?: string): Promise<LeaderboardDTO> {
    const { schoolId } = context;
    if (termId && !(await this.terms.findOneDTO(schoolId, termId))) throw AppError.notFound('Term');

    const [houses, termTotals, students] = await Promise.all([
      this.houses.fetchForSchool(schoolId),
      termId ? this.behaviour.houseTotalsForTerm(schoolId, termId) : Promise.resolve(null),
      this.behaviour.studentStandings(schoolId, termId, 50),
    ]);

    const ranked = houses
      .map((house) => ({ ...house, points: termTotals ? (termTotals.get(house.id) ?? 0) : house.points }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

    return {
      houses: ranked.map((house, index) => ({
        houseId: house.id,
        houseName: house.name,
        color: house.color,
        points: house.points,
        memberCount: house.memberCount,
        averagePerStudent:
          house.memberCount > 0 ? Math.round((house.points / house.memberCount) * 10) / 10 : 0,
        rank: index + 1,
      })),
      students,
    };
  }

  /* -- Internals ------------------------------------------------------------- */

  private async currentTerm(schoolId: string): Promise<TermDTO> {
    const terms = await this.terms.fetchForSchool(schoolId);
    const current = terms.find((term) => term.isCurrent);
    if (!current) {
      throw AppError.validation('The school has no current term, so there is nothing to record this against.');
    }
    return current;
  }

  /**
   * A teacher records against the pupils they teach; anyone with oversight,
   * against the school. "Not found" rather than "forbidden", as everywhere a
   * pupil outside the caller's remit is concerned.
   */
  private async refuseOutsideOwnClasses(context: RequestContext, classId: string | null): Promise<void> {
    const scope = await this.scope.forContext(context);
    if (scope.classIds === null) return;
    if (!classId || !scope.classIds.includes(classId)) throw AppError.notFound('Student');
  }
}
