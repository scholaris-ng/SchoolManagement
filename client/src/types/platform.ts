/** One school on the platform, as the Schools screen lists it. Mirrors `PlatformSchoolDTO` on the server. */
export interface PlatformSchool {
  id: string;
  name: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  plan: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  /** ISO timestamp of the moment the school's access ends. */
  endsAt: string;
  expired: boolean;
  daysLeft: number;
  lastActivatedAt: string | null;
  lastActivatedBy: string | null;
  createdAt: string;
}
