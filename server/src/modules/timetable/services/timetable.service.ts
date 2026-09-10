import type { RequestContext } from '../../../shared/types/context';
import { AppError } from '../../../shared/errors/AppError';
import { PeriodRepository } from '../../academics/repositories/facility.repository';
import { TermRepository } from '../../academics/repositories/term.repository';
import type { TimetableDTO } from '../dto/timetable.dto';

/**
 * The current term's timetable.
 *
 * The periods are real: a school defines its bell times in academics, and they
 * are what the grid is drawn from — without them the page has no rows and
 * cannot render at all. The term is real too. What does not exist is the
 * timetable itself: there is no table holding a saved grid, and none holding
 * the entries that fill it.
 *
 * So this answers with a real, empty timetable — the school's own periods,
 * against its current term, with nothing yet scheduled into them. That is what
 * a school sees before anybody has timetabled a single lesson, and it is the
 * truth rather than a placeholder.
 *
 * `id` is deliberately blank. No timetable record exists, so there is no id to
 * give, and the routes that would save an entry against one are not built. A
 * fabricated id would let the client address a grid that is not there.
 */
export class TimetableService {
  static Instance = new TimetableService();

  private constructor(
    private readonly periods = PeriodRepository.Instance,
    private readonly terms = TermRepository.Instance,
  ) {}

  async fetchCurrent(context: RequestContext): Promise<TimetableDTO> {
    const { schoolId } = context;

    const [periods, terms] = await Promise.all([
      this.periods.fetchForSchool(schoolId),
      this.terms.fetchForSchool(schoolId),
    ]);

    const current = terms.find((term) => term.isCurrent);
    // Without a current term there is no "current timetable" to ask for, and
    // saying so is more useful than an object with empty term fields.
    if (!current) throw AppError.notFound('Current term');

    return {
      id: '',
      schoolId,
      name: `${current.name} timetable`,
      sessionId: current.sessionId,
      termId: current.id,
      termName: `${current.name}, ${current.sessionName}`,
      status: 'DRAFT',
      periods,

      // Timetable module: no entry table, so no lesson has been scheduled.
      entries: [],
      version: 0,
    };
  }
}
