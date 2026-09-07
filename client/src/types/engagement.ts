export type NotificationChannel = 'IN_APP' | 'PUSH' | 'EMAIL' | 'SMS';

export type NotificationCategory =
  | 'ATTENDANCE'
  | 'RESULT'
  | 'FEE'
  | 'ADMISSION'
  | 'CALENDAR'
  | 'MESSAGE'
  | 'BEHAVIOUR'
  | 'COLLECTION'
  | 'ANNOUNCEMENT'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  schoolId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  actionUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  entityType?: string | null;
  entityId?: string | null;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SKIPPED';
  attemptedAt?: string | null;
  failureReason?: string | null;
  recipientLabel: string;
}

export interface NotificationPreference {
  category: NotificationCategory;
  channels: Record<NotificationChannel, boolean>;
}

export interface Announcement {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  audience: 'EVERYONE' | 'STAFF' | 'PARENTS' | 'STUDENTS' | 'CLASSES';
  classIds: string[];
  publishAt: string;
  expiresAt?: string | null;
  pinned: boolean;
  authorName: string;
  channels: NotificationChannel[];
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED';
  readCount: number;
  recipientCount: number;
}

export interface NewsPost {
  id: string;
  schoolId: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string | null;
  gallery: { id: string; url: string; caption?: string | null }[];
  category: 'NEWS' | 'EVENT' | 'ACHIEVEMENT' | 'GALLERY';
  audience: 'PUBLIC' | 'PARENTS' | 'STAFF' | 'STUDENTS';
  publishedAt?: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  authorName: string;
  /** Blocks publishing photographs of students without consent on file. */
  containsStudentPhotos: boolean;
  likeCount: number;
  commentCount: number;
}

export interface ConversationParticipant {
  userId: string;
  name: string;
  role: string;
  photoUrl?: string | null;
}

export interface Conversation {
  id: string;
  schoolId: string;
  subject: string;
  /** The child the conversation is about — parents may only start threads here. */
  studentId?: string | null;
  studentName?: string | null;
  participants: ConversationParticipant[];
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'OPEN' | 'CLOSED';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderPhotoUrl?: string | null;
  body: string;
  sentAt: string;
  readBy: string[];
  attachments: { id: string; name: string; url: string; mimeType: string; sizeBytes: number }[];
  /** Local-only until the write is acknowledged by Firestore. */
  pending?: boolean;
  failed?: boolean;
}

export interface WebsiteContent {
  schoolId: string;
  enabled: boolean;
  slug: string;
  tagline: string;
  about: string;
  mission?: string | null;
  vision?: string | null;
  heroImageUrl?: string | null;
  admissionsIntro?: string | null;
  admissionsOpen: boolean;
  contactEmail: string;
  contactPhone: string;
  address: string;
  socialLinks: { platform: string; url: string }[];
  testimonials: { id: string; author: string; role: string; quote: string }[];
  gallery: { id: string; url: string; caption?: string | null }[];
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  schoolId: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  occurredAt: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}
