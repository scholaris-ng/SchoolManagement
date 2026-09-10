import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { SchoolMembership } from '../../auth/entities/schoolMembership.entity';
import { Role } from './role.entity';

/**
 * Which roles a membership holds. A person can hold several — a form teacher
 * who also runs admissions — and their effective permissions are the union.
 */
@Entity('membership_roles')
@Index(['membershipId', 'roleId'], { unique: true })
export class MembershipRole extends BaseEntity {
  @Column({ name: 'membership_id', type: 'uuid' })
  @Index()
  membershipId: string;

  @ManyToOne(() => SchoolMembership, (membership) => membership.roleLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'membership_id' })
  membership?: SchoolMembership;

  @Column({ name: 'role_id', type: 'uuid' })
  @Index()
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role?: Role;
}
