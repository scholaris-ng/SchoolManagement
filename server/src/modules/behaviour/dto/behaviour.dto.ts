/**
 * Mirrors `Leaderboard` and its rows in `client/src/types/behaviour.ts`.
 */

export interface HouseLeaderboardRowDTO {
  houseId: string;
  houseName: string;
  color: string;
  points: number;
  memberCount: number;
  averagePerStudent: number;
  rank: number;
}

export interface StudentPointsRowDTO {
  studentId: string;
  studentName: string;
  admissionNo: string;
  className?: string | null;
  houseName?: string | null;
  houseColor?: string | null;
  points: number;
  rank: number;
}

export interface LeaderboardDTO {
  houses: HouseLeaderboardRowDTO[];
  students: StudentPointsRowDTO[];
}
