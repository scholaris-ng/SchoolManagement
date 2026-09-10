import type { RequestContext } from '../../../shared/types/context';
import { HouseRepository } from '../../academics/repositories/facility.repository';
import type { LeaderboardDTO } from '../dto/behaviour.dto';

/**
 * The house leaderboard.
 *
 * Houses are real — a school sets them up in academics, pupils belong to them,
 * and each carries a points total. What does not exist is the award: no table
 * records who gave a house points, for what, or when. So the standings are
 * built from real houses and their real totals, and the per-pupil ranking below
 * them is empty, because that one can only be assembled from the awards.
 *
 * Returning no houses at all would have been the easier answer and the wrong
 * one: it would tell a school that has four houses that it has none.
 */
export class LeaderboardService {
  static Instance = new LeaderboardService();

  private constructor(private readonly houses = HouseRepository.Instance) {}

  async fetch(context: RequestContext): Promise<LeaderboardDTO> {
    const houses = await this.houses.fetchForSchool(context.schoolId);

    // Ranked here rather than in SQL because the row also needs an average the
    // query does not carry, and four houses is not a sort worth pushing down.
    const ranked = [...houses].sort(
      (a, b) => b.points - a.points || a.name.localeCompare(b.name),
    );

    return {
      houses: ranked.map((house, index) => ({
        houseId: house.id,
        houseName: house.name,
        color: house.color,
        points: house.points,
        memberCount: house.memberCount,
        // A house of forty cannot be compared with a house of four on totals
        // alone. Guarded because an empty house would divide by nothing.
        averagePerStudent:
          house.memberCount > 0 ? Math.round((house.points / house.memberCount) * 10) / 10 : 0,
        rank: index + 1,
      })),

      // Behaviour module: no house-point award table, so no pupil has a total
      // and there is nobody to rank.
      students: [],
    };
  }
}
