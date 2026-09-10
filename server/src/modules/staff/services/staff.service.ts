import type { RequestContext } from '../../../shared/types/context';
import { AppError } from '../../../shared/errors/AppError';
import type { Paginated } from '../../../shared/response/apiResponse';
import { StaffRepository } from '../repositories/staff.repository';
import type { StaffMemberDTO } from '../dto/staff.dto';
import type { FetchStaffQuery } from '../validators/staff.schema';

/**
 * Reading the staff roster.
 *
 * `staff.read` is the whole gate here, and it is deliberately not held by a
 * teacher: a colleague's phone number, salary grade and employment history are
 * not theirs to browse. There is no per-row narrowing the way students have,
 * because there is no role that may see some employees and not others.
 */
export class StaffService {
  static Instance = new StaffService();

  private constructor(private readonly staff = StaffRepository.Instance) {}

  async fetchAll(
    context: RequestContext,
    query: FetchStaffQuery,
  ): Promise<Paginated<StaffMemberDTO>> {
    return this.staff.fetchPaginated(context.schoolId, query);
  }

  async fetchOne(context: RequestContext, id: string): Promise<StaffMemberDTO> {
    const member = await this.staff.findOneDTO(context.schoolId, id);
    // Scoped by school before it is looked up, so an id from another tenant is
    // a plain not-found rather than a hint that the record exists elsewhere.
    if (!member) throw AppError.notFound('Staff member');
    return member;
  }
}
