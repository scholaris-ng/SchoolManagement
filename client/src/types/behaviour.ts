export interface BehaviourTrait {
  id: string;
  schoolId: string;
  name: string;
  category: 'AFFECTIVE' | 'PSYCHOMOTOR' | 'SKILL' | 'OTHER';
  description?: string | null;
  scaleId: string;
  scaleName: string;
  levelIds: string[];
  appearsOnReportCard: boolean;
  sequence: number;
  isActive: boolean;
}

export interface BehaviourScale {
  id: string;
  schoolId: string;
  name: string;
  min: number;
  max: number;
  points: { value: number; label: string }[];
}

/** Recorded continuously through the term, not guessed at the end of it. */
export interface BehaviourObservation {
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
  note?: string | null;
  observedByName: string;
  observedAt: string;
}

export interface BehaviourTermRating {
  traitId: string;
  traitName: string;
  category: string;
  observationCount: number;
  averageRating: number;
  scaleMax: number;
  label: string;
  trend: { date: string; rating: number }[];
}

export type HousePointReason =
  | 'ACADEMIC'
  | 'BEHAVIOUR'
  | 'READING'
  | 'SPORTS'
  | 'PUNCTUALITY'
  | 'SERVICE'
  | 'PENALTY'
  | 'OTHER';

export interface HousePointAward {
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
  note?: string | null;
  awardedByName: string;
  awardedAt: string;
  termId: string;
}

export interface HouseLeaderboardRow {
  houseId: string;
  houseName: string;
  color: string;
  points: number;
  memberCount: number;
  averagePerStudent: number;
  rank: number;
}

export interface StudentPointsRow {
  studentId: string;
  studentName: string;
  admissionNo: string;
  className?: string | null;
  houseName?: string | null;
  houseColor?: string | null;
  points: number;
  rank: number;
}

export type IncidentStatus =
  | 'REPORTED'
  | 'REFERRED'
  | 'UNDER_REVIEW'
  | 'ACTION_TAKEN'
  | 'RESOLVED'
  | 'DISMISSED';

export type IncidentSeverity = 'MINOR' | 'MODERATE' | 'MAJOR' | 'SEVERE';

export interface DisciplineAction {
  id: string;
  type: 'WARNING' | 'DETENTION' | 'SUSPENSION' | 'PARENT_MEETING' | 'COUNSELLING' | 'OTHER';
  description: string;
  startDate?: string | null;
  endDate?: string | null;
  issuedByName: string;
  issuedAt: string;
}

export interface DisciplineTimelineEvent {
  id: string;
  status: IncidentStatus;
  actorName: string;
  occurredAt: string;
  note?: string | null;
}

export interface DisciplineIncident {
  id: string;
  schoolId: string;
  referenceNo: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  className?: string | null;
  category: string;
  severity: IncidentSeverity;
  description: string;
  occurredAt: string;
  location?: string | null;
  reportedByName: string;
  reportedById: string;
  status: IncidentStatus;
  referredToName?: string | null;
  reviewerName?: string | null;
  reviewNote?: string | null;
  resolution?: string | null;
  resolvedAt?: string | null;
  evidence: { id: string; name: string; downloadUrl?: string | null; mimeType: string }[];
  actions: DisciplineAction[];
  timeline: DisciplineTimelineEvent[];
  guardianNotified: boolean;
  version: number;
}
