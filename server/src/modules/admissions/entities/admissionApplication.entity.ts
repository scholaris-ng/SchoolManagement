import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { AcademicSession } from '../../academics/entities/academicSession.entity';
import { SchoolLevel } from '../../academics/entities/schoolLevel.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { Student } from '../../students/entities/student.entity';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SCREENING'
  | 'SHORTLISTED'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

/** Who filled the form in — a parent for their child, or the student themselves. */
export type ApplicantType = 'GUARDIAN' | 'SELF';

/** Where it came from. A school treats a walk-in and a web form differently. */
export type ApplicationSource = 'OFFICE' | 'WEBSITE' | 'IMPORT';

export type ContactRelationship = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'SPONSOR' | 'OTHER';

/**
 * A person the school may contact about this application.
 *
 * Deliberately NOT a row in `guardians`, and that is the whole point of the
 * column. Anyone can fill in the public form; a guardian record carries a
 * portal login, appears in the parent directory, is billed for fees and is one
 * invitation away from reading a child's file. None of that may follow from an
 * unverified stranger typing their name into a marketing page.
 *
 * So the people on an application live here as plain JSON for as long as the
 * application is only an application. `AdmissionsService.convert` is the single
 * place that promotes them into real `Guardian` rows, and it runs only once the
 * school has accepted the child — after screening, and after whatever else the
 * school requires of a family before it calls them its own.
 */
export interface ApplicationContact {
  title: string | null;
  firstName: string;
  lastName: string;
  relationship: ContactRelationship;
  email: string;
  phone: string;
  occupation: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  /** Who the school writes to about the decision. Exactly one, held by the service. */
  isPrimaryContact: boolean;
}

/**
 * An application for a place (spec section 10).
 *
 * One row per child: a parent applying for three children files three of
 * these, sharing one set of contacts, because each child is screened, offered
 * and enrolled on their own terms.
 */
@Entity('admission_applications')
@Index(['schoolId', 'applicationNo'], { unique: true })
@Index(['schoolId', 'status'])
@Index(['schoolId', 'sessionId'])
@Index(['schoolId', 'levelId'])
@Index(['schoolId', 'createdAt'])
export class AdmissionApplication extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  /** Human-readable and quotable over the phone — `APP/2025-2026/0007`. */
  @Column({ type: 'varchar', name: 'application_no', length: 40 })
  applicationNo: string;

  /**
   * Position within the school's session, and the source of `applicationNo`.
   * Stored rather than counted, so deleting an application never hands its
   * number to the next one.
   */
  @Column({ type: 'int' })
  sequence: number;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => AcademicSession, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'session_id' })
  session?: AcademicSession;

  @Column({ name: 'level_id', type: 'uuid' })
  levelId: string;

  @ManyToOne(() => SchoolLevel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'level_id' })
  level?: SchoolLevel;

  @Column({ type: 'varchar', name: 'applicant_type', length: 16, default: 'GUARDIAN' })
  applicantType: ApplicantType;

  @Column({ type: 'varchar', length: 16, default: 'OFFICE' })
  source: ApplicationSource;

  // ── The applicant ─────────────────────────────────────────────────────────
  @Column({ type: 'varchar', name: 'first_name', length: 60 })
  firstName: string;

  @Column({ type: 'varchar', name: 'middle_name', length: 60, nullable: true })
  middleName: string | null;

  @Column({ type: 'varchar', name: 'last_name', length: 60 })
  lastName: string;

  @Column({ type: 'varchar', length: 10 })
  gender: 'MALE' | 'FEMALE';

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: string;

  @Column({ type: 'varchar', name: 'photo_url', length: 500, nullable: true })
  photoUrl: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  nationality: string | null;

  @Column({ type: 'varchar', name: 'state_of_origin', length: 60, nullable: true })
  stateOfOrigin: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  /** The home address broken out for anything that reads it structured — a bus route, a mailing list. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', name: 'previous_school', length: 160, nullable: true })
  previousSchool: string | null;

  @Column({ type: 'varchar', name: 'previous_class', length: 80, nullable: true })
  previousClass: string | null;

  @Column({ type: 'varchar', name: 'blood_group', length: 8, nullable: true })
  bloodGroup: string | null;

  @Column({ type: 'text', name: 'medical_notes', nullable: true })
  medicalNotes: string | null;

  /**
   * How to reach the applicant directly. Filled only when they applied for
   * themselves — a seven-year-old has no email address, and a column the
   * office is tempted to fill with a parent's would defeat `contacts`.
   */
  @Column({ type: 'varchar', name: 'applicant_email', length: 160, nullable: true })
  applicantEmail: string | null;

  @Column({ type: 'varchar', name: 'applicant_phone', length: 20, nullable: true })
  applicantPhone: string | null;

  /** Parents, guardians, next of kin — see `ApplicationContact`. */
  @Column({ type: 'jsonb', default: '[]' })
  contacts: ApplicationContact[];

  // ── Progress ──────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status: ApplicationStatus;

  /** `numeric` reaches the driver as a string; the DTO layer is where it becomes a number. */
  @Column({ name: 'screening_score', type: 'numeric', precision: 5, scale: 2, nullable: true })
  screeningScore: string | null;

  @Column({ name: 'interview_date', type: 'timestamptz', nullable: true })
  interviewDate: Date | null;

  @Column({ type: 'text', name: 'interview_note', nullable: true })
  interviewNote: string | null;

  @Column({ type: 'text', name: 'decision_note', nullable: true })
  decisionNote: string | null;

  @Column({ name: 'offered_class_id', type: 'uuid', nullable: true })
  offeredClassId: string | null;

  @ManyToOne(() => SchoolClass, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'offered_class_id' })
  offeredClass?: SchoolClass | null;

  @Column({ name: 'offer_expires_on', type: 'date', nullable: true })
  offerExpiresOn: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  /**
   * Set once the applicant has become a pupil. It is also the flag that says
   * the contacts above have been promoted to guardian records, so a second
   * conversion cannot create a second set of them.
   */
  @Column({ name: 'converted_student_id', type: 'uuid', nullable: true })
  convertedStudentId: string | null;

  @ManyToOne(() => Student, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'converted_student_id' })
  convertedStudent?: Student | null;

  @VersionColumn()
  version: number;
}
