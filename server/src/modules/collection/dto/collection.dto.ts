import type { AuthorizationStatus } from '../entities/pickupPerson.entity';
import type { CollectionMethod } from '../entities/collectionEvent.entity';

/** Wire shapes, mirroring `PickupPerson` and `CollectionEvent` in `client/src/types/people.ts`. */

export interface PickupPersonDTO {
  id: string;
  schoolId: string;
  studentId: string;
  name: string;
  relationship: string;
  phone: string;
  photoUrl: string | null;
  authorizationStatus: AuthorizationStatus;
  authorizedByName: string | null;
  authorizedAt: string | null;
  note: string | null;
}

export interface CollectionEventDTO {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  studentAdmissionNo: string;
  className: string | null;
  pickupPersonId: string | null;
  pickupPersonName: string;
  relationship: string;
  releasedByStaffId: string;
  releasedByName: string;
  releasedAt: string;
  method: CollectionMethod;
  parentNotified: boolean;
  note: string | null;
}

/** Mirrors `StudentPickupResult` in `client/src/features/students/students.types.ts`. */
export interface StudentPickupDTO {
  persons: PickupPersonDTO[];
  recentEvents: CollectionEventDTO[];
}
