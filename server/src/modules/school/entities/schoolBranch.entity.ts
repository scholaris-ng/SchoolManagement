import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../shared/entities/baseEntity';
import { School } from './school.entity';

/**
 * A physical site within a school (spec section 4).
 *
 * Records that are branch-specific carry `branchId` alongside `schoolId`; the
 * data model supports one owner running several branches without a schema
 * change later.
 */
@Entity('school_branches')
@Index(['schoolId', 'code'], { unique: true })
export class SchoolBranch extends SoftDeletableEntity {
  @Column({ name: 'school_id', type: 'uuid' })
  @Index()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 80 })
  city: string;

  @Column({ type: 'varchar', length: 80 })
  state: string;

  @Column({ type: 'boolean', name: 'is_head_office', default: false })
  isHeadOffice: boolean;
}
