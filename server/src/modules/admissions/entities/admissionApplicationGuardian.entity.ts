import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { Guardian } from '../../guardians/entities/guardian.entity';
import { AdmissionApplication } from './admissionApplication.entity';

export type ApplicationGuardianRelationship = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'SPONSOR' | 'OTHER';

/**
 * An existing `Guardian` row attached to an application before enrollment —
 * typically a family the school already knows, such as a sibling already on
 * roll, rather than a stranger who filled in a form.
 *
 * Deliberately separate from `contacts`: that column holds whatever a walk-in
 * or a web visitor typed, unverified, and only becomes real people at
 * `AdmissionsService.convert`. A row here instead points at a `Guardian` the
 * school already has, so attaching one grants nothing by itself — no portal
 * access, no billing, no directory listing — but does carry that person's real
 * record onto the application. At conversion, a linked guardian is joined to
 * the new student directly rather than matched or recreated from JSON.
 */
@Entity('admission_application_guardians')
@Index(['applicationId', 'guardianId'], { unique: true })
@Index(['schoolId', 'applicationId'])
@Index(['schoolId', 'guardianId'])
export class AdmissionApplicationGuardian extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @Column({ name: 'application_id', type: 'uuid' })
  @Index()
  applicationId: string;

  @ManyToOne(() => AdmissionApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: AdmissionApplication;

  @Column({ name: 'guardian_id', type: 'uuid' })
  @Index()
  guardianId: string;

  @ManyToOne(() => Guardian, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guardian_id' })
  guardian?: Guardian;

  @Column({ type: 'varchar', length: 16, default: 'GUARDIAN' })
  relationship: ApplicationGuardianRelationship;

  /** Who the school writes to first. At most one per application, enforced in the service. */
  @Column({ type: 'boolean', name: 'is_primary_contact', default: false })
  isPrimaryContact: boolean;
}
