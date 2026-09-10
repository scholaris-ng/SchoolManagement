import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/baseEntity';
import { School } from './school.entity';

export interface SocialLink {
  platform: string;
  url: string;
}

export interface Testimonial {
  id: string;
  author: string;
  role: string;
  quote: string;
}

export interface GalleryImage {
  id: string;
  url: string;
  caption?: string | null;
}

/** The school's public marketing page (spec section 31). One row per school. */
@Entity('website_content')
export class WebsiteContent extends BaseEntity {
  @Column({ name: 'school_id', type: 'uuid', unique: true })
  @Index()
  schoolId: string;

  @OneToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'varchar', length: 120 })
  @Index()
  slug: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  tagline: string;

  @Column({ type: 'text', default: '' })
  about: string;

  @Column({ type: 'text', nullable: true })
  mission: string | null;

  @Column({ type: 'text', nullable: true })
  vision: string | null;

  @Column({ type: 'varchar', name: 'hero_image_url', length: 500, nullable: true })
  heroImageUrl: string | null;

  @Column({ name: 'admissions_intro', type: 'text', nullable: true })
  admissionsIntro: string | null;

  @Column({ type: 'boolean', name: 'admissions_open', default: false })
  admissionsOpen: boolean;

  @Column({ type: 'varchar', name: 'contact_email', length: 160, default: '' })
  contactEmail: string;

  @Column({ type: 'varchar', name: 'contact_phone', length: 40, default: '' })
  contactPhone: string;

  @Column({ type: 'text', default: '' })
  address: string;

  // Ordered presentation lists edited as a whole and never queried across
  // schools, so a relational table would buy nothing here.
  @Column({ name: 'social_links', type: 'jsonb', default: [] })
  socialLinks: SocialLink[];

  @Column({ type: 'jsonb', default: [] })
  testimonials: Testimonial[];

  @Column({ type: 'jsonb', default: [] })
  gallery: GalleryImage[];
}
