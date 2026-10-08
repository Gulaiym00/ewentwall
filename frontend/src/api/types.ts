// Response shapes of the backend API (backend/src/**/serialize, *.service.ts).
// Enums are lower-case, dates are ISO strings, files are absolute URLs.

export type Role = 'guest' | 'organizer' | 'admin';
export type UserStatus = 'active' | 'pending' | 'blocked';
export type Language = 'en' | 'ru';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  phone: string | null;
  city: string | null;
  language: Language;
  hasPassword: boolean;
  googleLinked: boolean;
  notifications: { newPhotos: boolean; dailySummary: boolean; reports: boolean; product: boolean };
  createdAt: string;
  lastSeenAt: string | null;
}

export interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number }
export interface AuthResult extends TokenPair { user: User }

// ─── Events ───────────────────────────────────────────────────────────────────

export type EventStatus = 'upcoming' | 'active' | 'closed' | 'flagged';

export interface EventSettings {
  premoderation: boolean;
  allowComments: boolean;
  allowReactions: boolean;
  askGuestName: boolean;
  allowDownloads: boolean;
  pinRequired: boolean;
}

export interface EventStats { photos: number; pendingPhotos: number; guests: number; reactions: number }

export interface OrganizerEvent {
  id: string;
  slug: string;
  joinUrl: string;
  name: string;
  type: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  welcomeMessage: string | null;
  coverUrl: string | null;
  language: Language;
  status: EventStatus;
  settings: EventSettings;
  stats: EventStats;
  createdAt: string;
}

export interface EventInput {
  name?: string;
  type?: string;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  welcomeMessage?: string;
  language?: Language;
  premoderation?: boolean;
  allowComments?: boolean;
  allowReactions?: boolean;
  askGuestName?: boolean;
  allowDownloads?: boolean;
  pin?: string | null;
  status?: 'upcoming' | 'active' | 'closed';
}

// ─── Guest side ───────────────────────────────────────────────────────────────

export interface PublicEvent {
  slug: string;
  name: string;
  type: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  welcomeMessage: string | null;
  coverUrl: string | null;
  language: Language;
  status: EventStatus;
  settings: Omit<EventSettings, 'pinRequired'> & { pinRequired: boolean };
  stats: { photos: number; guests: number; reactions: number };
}

export type PhotoStatus = 'pending' | 'published' | 'hidden' | 'removed';

export interface Photo {
  id: string;
  eventId: string;
  url: string;
  /** Small WebP for grids; the same as `url` for photos without a thumbnail. */
  thumbUrl: string;
  author: string;
  caption: string | null;
  status: PhotoStatus;
  createdAt: string;
  reactions: Record<string, number>;
  totalReactions: number;
  myReaction: string | null;
  commentCount: number;
  mine: boolean;
}

export interface Page<T> { items: T[]; nextCursor: string | null }

export interface Comment { id: string; author: string; text: string; createdAt: string }

/** One guest's reaction on a photo; author is null when the guest didn't give a name. */
export interface Reactor { id: string; emoji: string; author: string | null; mine: boolean; createdAt: string }

export type ReportReason = 'inappropriate' | 'spam' | 'copyright' | 'privacy' | 'violence';

// ─── Content & reviews ────────────────────────────────────────────────────────

export interface SiteContent {
  heroTitle: string;
  heroSubtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  faq: { q: string; a: string }[];
}

export interface FeaturedReview {
  id: string;
  name: string;
  avatarUrl: string | null;
  event: string | null;
  rating: number;
  text: string;
  createdAt: string;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  users: number;
  usersDelta: number;
  activeEvents: number;
  activeEventsDelta: number;
  photosToday: number;
  photosDelta: number;
  storageUsedGb: number;
  storageTotalGb: number;
  uploads14d: { date: string; uploads: number }[];
  pendingReports: number;
  pendingReviews: number;
}

export interface AdminUser extends User { events: number }

export interface AdminEvent extends OrganizerEvent {
  organizer: { id: string; name: string; email: string };
  reports: number;
}

export interface Paged<T> { total: number; page: number; pageSize: number; items: T[] }

export type ReportStatus = 'pending' | 'approved' | 'removed';

export interface ReportGroup {
  photoId: string;
  photoUrl: string;
  photoStatus: PhotoStatus;
  event: { id: string; name: string };
  author: string;
  reason: ReportReason;
  reports: number;
  aiScore: number | null;
  reportedAt: string;
  status: ReportStatus;
}

export type ReviewStatus = 'pending' | 'published' | 'hidden';

export interface AdminReview {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  event: string | null;
  rating: number;
  text: string;
  status: ReviewStatus;
  featured: boolean;
  createdAt: string;
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultLocale: Language;
  maxPhotoMb: number;
  maxPerUpload: number;
  retentionMonths: number;
  aiModeration: boolean;
  aiThreshold: number;
  profanityFilter: boolean;
  autoHideReports: number;
  require2fa: boolean;
  sessionHours: number;
  allowSignups: boolean;
  maintenance: boolean;
}

export type AuditCategory = 'auth' | 'user' | 'event' | 'moderation' | 'content' | 'settings';

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  actorRole: string;
  category: AuditCategory;
  action: string;
  target: string;
  ip: string;
}
