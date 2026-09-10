import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from '../../school/entities/school.entity';
import type { Permission } from '../../../config/constants';

/**
 * A named bundle of permissions (spec section 5).
 *
 * Role names are convenience only — every authorisation decision in the API is
 * made against a permission, so a school that invents "Head of Year" gets
 * correct access without any code change.
 */
@Entity('roles')
@Index(['schoolId', 'key'], { unique: true })
export class Role extends SoftDeletableEntity {
  /**
   * Null for the platform-wide seed roles that every school starts from; set
   * once a school takes its own copy.
   */
  @Column({ name: 'school_id', type: 'uuid', nullable: true })
  @Index()
  schoolId: string | null;

  @ManyToOne(() => School, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'school_id' })
  school?: School | null;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** Stable identifier the code matches on — `TEACHER`, `BURSAR`, `head_of_year`. */
  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  /**
   * Built-in roles may have their permissions edited but not their name or key,
   * so seeding stays recognisable after a school customises it.
   */
  @Column({ type: 'boolean', name: 'is_system', default: false })
  isSystem: boolean;

  /**
   * The permission set, validated against `PERMISSIONS` before it is written.
   * A separate `role_permissions` table was considered and rejected: the set is
   * always read and written whole, never joined or filtered on, so a row per
   * permission would add a join to every request and buy nothing.
   */
  @Column({ type: 'jsonb', default: [] })
  permissions: Permission[];
}
