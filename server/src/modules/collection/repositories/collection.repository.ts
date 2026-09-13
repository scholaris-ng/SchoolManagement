import type { DeepPartial } from 'typeorm';
import { TenantRepository } from '../../../shared/repositories/baseRepository';
import { paginatedResult } from '../../../shared/pagination/paginate';
import type { Paginated } from '../../../shared/response/apiResponse';
import { PickupPerson } from '../entities/pickupPerson.entity';
import { CollectionEvent } from '../entities/collectionEvent.entity';
import type { CollectionEventDTO, PickupPersonDTO } from '../dto/collection.dto';

const PERSON_PROJECTION = `
  p.id, p.school_id AS "schoolId", p.student_id AS "studentId", p.name, p.relationship,
  p.phone, p.photo_url AS "photoUrl", p.authorization_status AS "authorizationStatus",
  p.authorized_by_name AS "authorizedByName", p.authorized_at AS "authorizedAt", p.note
`;

const EVENT_PROJECTION = `
  e.id, e.school_id AS "schoolId", e.student_id AS "studentId",
  concat_ws(' ', st.first_name, NULLIF(st.middle_name, ''), st.last_name) AS "studentName",
  st.admission_no AS "studentAdmissionNo",
  c.name AS "className",
  e.pickup_person_id AS "pickupPersonId", e.pickup_person_name AS "pickupPersonName",
  e.relationship,
  COALESCE(e.released_by_user_id::text, '') AS "releasedByStaffId",
  e.released_by_name AS "releasedByName", e.released_at AS "releasedAt",
  e.method, e.parent_notified AS "parentNotified", e.note
`;

const EVENT_FROM = `
  FROM collection_events e
  JOIN students st ON st.id = e.student_id
  LEFT JOIN school_classes c ON c.id = st.current_class_id
`;

export interface EventFilter {
  page: number;
  pageSize: number;
  search?: string;
  studentId?: string;
  visibleIds: string[] | null;
}

export class CollectionRepository extends TenantRepository<CollectionEvent> {
  static Instance = new CollectionRepository();

  private constructor() {
    super(CollectionEvent, 'event');
  }

  /* -- Pickup persons -------------------------------------------------------- */

  async personsForStudent(schoolId: string, studentId: string): Promise<PickupPersonDTO[]> {
    return this.repo.query(
      `SELECT ${PERSON_PROJECTION} FROM pickup_persons p
        WHERE p.school_id = $1 AND p.student_id = $2
        ORDER BY (p.authorization_status = 'AUTHORIZED') DESC, p.name ASC`,
      [schoolId, studentId],
    );
  }

  async findPersonDTO(schoolId: string, id: string): Promise<PickupPersonDTO | null> {
    const rows: PickupPersonDTO[] = await this.repo.query(
      `SELECT ${PERSON_PROJECTION} FROM pickup_persons p WHERE p.school_id = $1 AND p.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async createPerson(data: DeepPartial<PickupPerson>): Promise<PickupPerson> {
    const repo = this.repo.manager.getRepository(PickupPerson);
    return repo.save(repo.create(data));
  }

  async updatePerson(schoolId: string, id: string, patch: DeepPartial<PickupPerson>): Promise<void> {
    await this.repo.manager.getRepository(PickupPerson).update({ id, schoolId }, patch as never);
  }

  /* -- Collection events ----------------------------------------------------- */

  async fetchEvents(schoolId: string, filter: EventFilter): Promise<Paginated<CollectionEventDTO>> {
    if (filter.visibleIds && filter.visibleIds.length === 0) {
      return paginatedResult<CollectionEventDTO>([], filter.page, filter.pageSize, 0);
    }

    const params: unknown[] = [schoolId];
    const where = ['e.school_id = $1'];
    if (filter.studentId) {
      params.push(filter.studentId);
      where.push(`e.student_id = $${params.length}`);
    }
    if (filter.visibleIds) {
      params.push(filter.visibleIds);
      where.push(`e.student_id = ANY($${params.length}::uuid[])`);
    }
    if (filter.search) {
      params.push(`%${filter.search}%`);
      const i = params.length;
      where.push(
        `(st.first_name ILIKE $${i} OR st.last_name ILIKE $${i} OR st.admission_no ILIKE $${i} OR e.pickup_person_name ILIKE $${i})`,
      );
    }
    const whereSql = where.join(' AND ');

    const [countRow] = await this.repo.query(
      `SELECT COUNT(*)::int AS total ${EVENT_FROM} WHERE ${whereSql}`,
      params,
    );
    const rows: CollectionEventDTO[] = await this.repo.query(
      `SELECT ${EVENT_PROJECTION} ${EVENT_FROM}
        WHERE ${whereSql}
        ORDER BY e.released_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.pageSize, (filter.page - 1) * filter.pageSize],
    );
    return paginatedResult(rows, filter.page, filter.pageSize, Number(countRow?.total ?? 0));
  }

  async recentForStudent(schoolId: string, studentId: string, limit: number): Promise<CollectionEventDTO[]> {
    return this.repo.query(
      `SELECT ${EVENT_PROJECTION} ${EVENT_FROM}
        WHERE e.school_id = $1 AND e.student_id = $2
        ORDER BY e.released_at DESC
        LIMIT $3`,
      [schoolId, studentId, limit],
    );
  }

  async findEventDTO(schoolId: string, id: string): Promise<CollectionEventDTO | null> {
    const rows: CollectionEventDTO[] = await this.repo.query(
      `SELECT ${EVENT_PROJECTION} ${EVENT_FROM} WHERE e.school_id = $1 AND e.id = $2`,
      [schoolId, id],
    );
    return rows[0] ?? null;
  }

  async createEvent(data: DeepPartial<CollectionEvent>): Promise<CollectionEvent> {
    return this.repo.save(this.repo.create(data));
  }

  async markParentNotified(schoolId: string, id: string): Promise<void> {
    await this.repo.update({ id, schoolId }, { parentNotified: true });
  }
}
