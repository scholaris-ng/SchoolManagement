import type { ScalePoint } from '../entities/behaviourScale.entity';
import type { TraitCategory } from '../entities/behaviourTrait.entity';
import type { HousePointReason } from '../entities/housePointAward.entity';

/** Wire shapes, mirroring `client/src/types/behaviour.ts`. */

export interface BehaviourScaleDTO {
  id: string;
  schoolId: string;
  name: string;
  min: number;
  max: number;
  points: ScalePoint[];
}

export interface BehaviourTraitDTO {
  id: string;
  schoolId: string;
  name: string;
  category: TraitCategory;
  description: string | null;
  scaleId: string;
  scaleName: string;
  levelIds: string[];
  appearsOnReportCard: boolean;
  sequence: number;
  isActive: boolean;
}

export interface BehaviourObservationDTO {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  traitId: string;
  traitName: string;
  termId: string;
  rating: number;
  scaleMax: number;
  note: string | null;
  observedByName: string;
  observedAt: string;
}

/** One trait's standing for one pupil over a term — the report card's row. */
export interface BehaviourTermRatingDTO {
  traitId: string;
  traitName: string;
  category: TraitCategory;
  observationCount: number;
  averageRating: number;
  scaleMax: number;
  label: string;
  trend: { date: string; rating: number }[];
}

export interface HousePointAwardDTO {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  houseId: string;
  houseName: string;
  houseColor: string;
  points: number;
  reason: HousePointReason;
  note: string | null;
  awardedByName: string;
  awardedAt: string;
  termId: string;
}

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
