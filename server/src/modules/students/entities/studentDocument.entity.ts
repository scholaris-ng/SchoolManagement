import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { Student } from './student.entity';

export type StudentDocumentCategory =
  | 'BIRTH_CERTIFICATE'
  | 'PREVIOUS_RESULT'
  | 'MEDICAL'
  | 'PHOTO'
  | 'TRANSFER'
  | 'OTHER';

/**
 * A file attached to a pupil's record (spec section 3).
 *
 * The bytes live in Firebase Storage; this row is the metadata and the
 * authorisation record. Keeping `storagePath` in PostgreSQL is what lets the
 * API decide who may read the object, rather than relying on an unguessable URL.
 */
@Entity('student_documents')
@Index(['schoolId', 'studentId'])
@Index(['schoolId', 'category'])
export class StudentDocument extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  @Index()
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 32, default: 'OTHER' })
  category: StudentDocumentCategory;

  /** Path within the storage bucket — needed to delete or re-sign the object. */
  @Column({ type: 'varchar', name: 'storage_path', length: 500 })
  storagePath: string;

  @Column({ type: 'varchar', name: 'download_url', length: 1000, nullable: true })
  downloadUrl: string | null;

  @Column({ type: 'varchar', name: 'mime_type', length: 120 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'bigint', default: 0 })
  sizeBytes: string;

  /**
   * Captured at upload time. The entry must still read correctly after the
   * member of staff who uploaded it has left.
   */
  @Column({ type: 'varchar', name: 'uploaded_by_name', length: 160 })
  uploadedByName: string;

  @Column({ name: 'uploaded_by_user_id', type: 'uuid', nullable: true })
  uploadedByUserId: string | null;
}
