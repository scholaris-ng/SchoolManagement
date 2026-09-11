import { DashboardService } from '../services/dashboard.service';
import type { RequestContext } from '../../../shared/types/context';

/**
 * Every field here answers a module with no table yet, so the contract this
 * test protects is the honest-absence shape itself: empty arrays and zero,
 * never a fabricated lesson, register or class.
 */
describe('DashboardService.fetchTeacher', () => {
  it('answers an empty to-do list rather than 404ing or fabricating data', async () => {
    const result = await DashboardService.Instance.fetchTeacher({} as RequestContext);

    expect(result).toEqual({
      todayClasses: [],
      pendingAttendance: [],
      pendingScoreEntry: [],
      lessonNotesDue: [],
      upcomingAssessments: [],
      unreadMessages: 0,
      curriculumCoverage: [],
    });
  });
});
