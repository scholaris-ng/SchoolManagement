import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { Room } from '../entities/room.entity';
import { House } from '../entities/house.entity';
import { TimetablePeriod } from '../entities/timetablePeriod.entity';
import type { HouseDTO, RoomDTO, TimetablePeriodDTO } from '../dto/academics.dto';

export class RoomRepository extends TenantRepository<Room> {
  static Instance = new RoomRepository();

  private constructor() {
    super(Room, 'room');
  }

  async fetchForSchool(schoolId: string): Promise<RoomDTO[]> {
    return this.repo.query(
      `SELECT id, school_id AS "schoolId", name, code, capacity, type
       FROM rooms WHERE school_id = $1 AND deleted_at IS NULL
       ORDER BY name ASC`,
      [schoolId],
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<RoomDTO | null> {
    const rows: RoomDTO[] = await this.repo.query(
      `SELECT id, school_id AS "schoolId", name, code, capacity, type
       FROM rooms WHERE school_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async findByCode(schoolId: string, code: string): Promise<Room | null> {
    return this.repo.findOne({ where: { schoolId, code } });
  }

  async create(data: DeepPartial<Room>): Promise<Room> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<Room>): Promise<void> {
    await this.repo.update(id, patch as never);
  }
}

/**
 * `memberCount` and `captainName` read from the students table, which arrives in
 * phase 2. Both are projected as their empty values for now so the client
 * contract is complete; the subqueries go in with that migration.
 */
const HOUSE_PROJECTION = `
  h.id, h.school_id AS "schoolId", h.name, h.color, h.motto,
  h.captain_student_id AS "captainStudentId",
  NULL::text AS "captainName",
  0 AS "memberCount",
  h.points
`;

export class HouseRepository extends TenantRepository<House> {
  static Instance = new HouseRepository();

  private constructor() {
    super(House, 'house');
  }

  async fetchForSchool(schoolId: string): Promise<HouseDTO[]> {
    return this.repo.query(
      `SELECT ${HOUSE_PROJECTION}
       FROM houses h WHERE h.school_id = $1 AND h.deleted_at IS NULL
       ORDER BY h.name ASC`,
      [schoolId],
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<HouseDTO | null> {
    const rows: HouseDTO[] = await this.repo.query(
      `SELECT ${HOUSE_PROJECTION}
       FROM houses h WHERE h.school_id = $1 AND h.id = $2 AND h.deleted_at IS NULL`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async findByName(schoolId: string, name: string): Promise<House | null> {
    return this.repo.findOne({ where: { schoolId, name } });
  }

  async create(data: DeepPartial<House>): Promise<House> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<House>): Promise<void> {
    await this.repo.update(id, patch as never);
  }
}

export class PeriodRepository extends TenantRepository<TimetablePeriod> {
  static Instance = new PeriodRepository();

  private constructor() {
    super(TimetablePeriod, 'period');
  }

  async fetchForSchool(schoolId: string): Promise<TimetablePeriodDTO[]> {
    return this.repo.query(
      `SELECT id, school_id AS "schoolId", name,
              to_char(start_time, 'HH24:MI') AS "startTime",
              to_char(end_time,   'HH24:MI') AS "endTime",
              sequence, is_break AS "isBreak"
       FROM timetable_periods
       WHERE school_id = $1 AND deleted_at IS NULL
       ORDER BY sequence ASC`,
      [schoolId],
    );
  }

  async findOneDTO(schoolId: string, id: string): Promise<TimetablePeriodDTO | null> {
    const rows: TimetablePeriodDTO[] = await this.repo.query(
      `SELECT id, school_id AS "schoolId", name,
              to_char(start_time, 'HH24:MI') AS "startTime",
              to_char(end_time,   'HH24:MI') AS "endTime",
              sequence, is_break AS "isBreak"
       FROM timetable_periods
       WHERE school_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async nextSequence(schoolId: string): Promise<number> {
    const [row] = await this.repo.query(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next
       FROM timetable_periods WHERE school_id = $1 AND deleted_at IS NULL`,
      [schoolId],
    );
    return Number(row?.next ?? 1);
  }

  async create(data: DeepPartial<TimetablePeriod>): Promise<TimetablePeriod> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, patch: DeepPartial<TimetablePeriod>): Promise<void> {
    await this.repo.update(id, patch as never);
  }
}
