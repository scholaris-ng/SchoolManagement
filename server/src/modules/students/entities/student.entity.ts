import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import { SchoolClass } from '../../academics/entities/schoolClass.entity';
import { House } from '../../academics/entities/house.entity';

export type Gender = 'MALE' | 'FEMALE';

export type StudentStatus =
  | 'ACTIVE'
  | 'GRADUATED'
  | 'TRANSFERRED'
  | 'WITHDRAWN'
  | 'SUSPENDED'
  | 'ALUMNI';

/**
 * A pupil (spec section 7).
 *
 * Soft delete is mandatory here, not optional: a student who leaves must still
 * appear on last year's report cards, in the audit trail and on their own
 * transcript. Removing the row would rewrite history.
 */
@Entity('students')
@Index(['schoolId', 'admissionNo'], { unique: true })
@Index(['schoolId', 'status'])
@Index(['schoolId', 'currentClassId'])
@Index(['schoolId', 'lastName'])
@Index(['schoolId', 'createdAt'])
export class Student extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  /** Unique per school, never globally — two schools may both use "001". */
  @Column({ type: 'varchar', name: 'admission_no', length: 32 })
  admissionNo: string;

  @Column({ type: 'varchar', name: 'first_name', length: 60 })
  firstName: string;

  @Column({ type: 'varchar', name: 'middle_name', length: 60, nullable: true })
  middleName: string | null;

  @Column({ type: 'varchar', name: 'last_name', length: 60 })
  lastName: string;

  @Column({ type: 'varchar', length: 10 })
  gender: Gender;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: string;

  @Column({ type: 'varchar', name: 'photo_url', length: 500, nullable: true })
  photoUrl: string | null;

  /** Kept so the object can be deleted from storage when the photo changes. */
  @Column({ type: 'varchar', name: 'photo_storage_path', length: 500, nullable: true })
  photoStoragePath: string | null;

  /**
   * Explicit, and false until somebody actively says yes (spec section 41).
   * Nothing publishes a child's photograph without this.
   */
  @Column({ type: 'boolean', name: 'photo_consent', default: false })
  photoConsent: boolean;

  @Column({ name: 'admission_date', type: 'date' })
  admissionDate: string;

  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' })
  status: StudentStatus;

  /**
   * Where the pupil sits today. The full history lives in `student_enrollments`
   * — this is a denormalised pointer so a class register is one query, not a
   * walk through every enrolment the pupil has ever had.
   */
  @Column({ name: 'current_class_id', type: 'uuid', nullable: true })
  currentClassId: string | null;

  @ManyToOne(() => SchoolClass, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'current_class_id' })
  currentClass?: SchoolClass | null;

  @Column({ name: 'house_id', type: 'uuid', nullable: true })
  houseId: string | null;

  @ManyToOne(() => House, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'house_id' })
  house?: House | null;

  // ── Welfare. Sensitive, and only ever returned to staff with student.read ──
  @Column({ type: 'varchar', name: 'blood_group', length: 8, nullable: true })
  bloodGroup: string | null;

  @Column({ type: 'text', name: 'medical_notes', nullable: true })
  medicalNotes: string | null;

  @Column({ type: 'varchar', name: 'emergency_contact_name', length: 120, nullable: true })
  emergencyContactName: string | null;

  @Column({ type: 'varchar', name: 'emergency_contact_phone', length: 20, nullable: true })
  emergencyContactPhone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  nationality: string | null;

  @Column({ type: 'varchar', name: 'state_of_origin', length: 60, nullable: true })
  stateOfOrigin: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  religion: string | null;

  /**
   * School-defined extras. Genuinely dynamic per tenant, which is what
   * spec section 42 permits jsonb for.
   */
  @Column({ name: 'custom_fields', type: 'jsonb', default: {} })
  customFields: Record<string, string | number | boolean | null>;

  /** Optimistic lock — two offices editing one pupil must not clobber (section 34). */
  @VersionColumn()
  version: number;
}
