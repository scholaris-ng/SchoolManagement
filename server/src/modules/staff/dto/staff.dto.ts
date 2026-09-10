/**
 * One employee, mirroring `StaffMember` in `client/src/types/people.ts`.
 *
 * Unlike the analytics payloads next door, none of this is a placeholder: the
 * staff table, its teaching assignments and its form-teacher links all exist
 * and are seeded, so every field here is read from the database.
 */
export interface TeachingAssignmentPairDTO {
  classId: string;
  subjectId: string;
}

export interface StaffMemberDTO {
  id: string;
  schoolId: string;
  userId: string | null;
  staffNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  gender: 'MALE' | 'FEMALE';
  photoUrl: string | null;
  designation: string;
  department: string | null;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
  employmentDate: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'EXITED';
  roleNames: string[];
  subjectIds: string[];
  subjectNames: string[];
  classIds: string[];
  classNames: string[];
  teachingAssignments: TeachingAssignmentPairDTO[];
  isFormTeacher: boolean;
  createdAt: string;
  version: number;
}
