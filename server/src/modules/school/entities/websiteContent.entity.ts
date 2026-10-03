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

export interface Founder {
  name: string;
  role: string;
  photoUrl?: string | null;
}

/** One line of what the school stands for — "Integrity", "Excellence" — paired with a picker icon. */
export interface SiteValue {
  name: string;
  icon: string;
}

export interface LeadershipMember {
  id: string;
  name: string;
  role: string;
  photoUrl?: string | null;
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

  // The school's own to change (unlike `School.slug`) — this is the address
  // its public site is reachable at, spec section 31 — so it needs its own
  // uniqueness independent of the school's fixed tenant slug.
  @Column({ type: 'varchar', length: 120, unique: true })
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

  /**
   * The school's own proprietor or founder — a single, prominent figure, the
   * way AB.10's page features theirs. Nullable rather than a zero-value
   * object: nothing on the public page should claim a school has a named
   * founder until one has actually been entered.
   */
  @Column({ type: 'jsonb', nullable: true })
  founder: Founder | null;

  @Column({ type: 'jsonb', default: [] })
  values: SiteValue[];

  @Column({ type: 'jsonb', default: [] })
  leadership: LeadershipMember[];
}
