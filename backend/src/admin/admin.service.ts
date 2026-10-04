import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { AuthUser } from '../common/auth.js';
import { fileUrl, lower, upper, userDto } from '../common/serialize.js';
import type { Locale, Prisma, ReportReason, ReportStatus } from '../generated/prisma/client.js';
import { hashPassword } from '../auth/auth.service.js';
import { TokensService } from '../auth/tokens.service.js';
import { EventsService } from '../events/events.service.js';
import { AuditService } from '../platform/audit.service.js';
import { ContentService, type SiteContent } from '../platform/content.service.js';
import { SettingsService, type PlatformSettings } from '../platform/settings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { eventFileKeys, userFileKeys } from '../storage/cleanup.js';
import { StorageService } from '../storage/storage.service.js';
import type {
  AuditQuery, EventsQuery, InviteUserDto, ReportsQuery, ResolveReportsDto, ReviewsQuery, UpdateReviewDto, UpdateUserDto, UsersQuery,
} from './admin.dto.js';

const MAX_FEATURED = 3;
const DAY = 86_400_000;

const pctChange = (now: number, before: number) => (before === 0 ? (now > 0 ? 100 : 0) : Math.round(((now - before) / before) * 1000) / 10);
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly content: ContentService,
    private readonly events: EventsService,
    private readonly tokens: TokensService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  async stats() {
    const now = Date.now();
    const today = startOfDay();
    const yesterday = new Date(today.getTime() - DAY);
    const since14 = new Date(today.getTime() - 13 * DAY);

    const [users, newUsers7, newUsersPrev7, activeEvents, events7, eventsPrev7, photosToday, photosYesterday, storage, uploads, pendingReports, pendingReviews] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { createdAt: { gte: new Date(now - 7 * DAY) } } }),
        this.prisma.user.count({ where: { createdAt: { gte: new Date(now - 14 * DAY), lt: new Date(now - 7 * DAY) } } }),
        this.prisma.event.count({ where: { status: 'ACTIVE' } }),
        this.prisma.event.count({ where: { createdAt: { gte: new Date(now - 7 * DAY) } } }),
        this.prisma.event.count({ where: { createdAt: { gte: new Date(now - 14 * DAY), lt: new Date(now - 7 * DAY) } } }),
        this.prisma.photo.count({ where: { createdAt: { gte: today } } }),
        this.prisma.photo.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
        this.prisma.photo.aggregate({ _sum: { size: true } }),
        this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
          SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count FROM "Photo"
          WHERE "createdAt" >= ${since14} GROUP BY 1 ORDER BY 1`,
        this.prisma.photo.count({ where: { reports: { some: { status: 'PENDING' } } } }),
        this.prisma.review.count({ where: { status: 'PENDING' } }),
      ]);

    // Fill days without uploads with zeros so the chart has all 14 bars.
    const byDay = new Map(uploads.map(u => [startOfDay(new Date(u.day)).getTime(), Number(u.count)]));
    const uploads14d = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(since14.getTime() + i * DAY);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { date: iso, uploads: byDay.get(d.getTime()) ?? 0 };
    });

    return {
      users,
      usersDelta: pctChange(newUsers7, newUsersPrev7),
      activeEvents,
      activeEventsDelta: pctChange(events7, eventsPrev7),
      photosToday,
      photosDelta: pctChange(photosToday, photosYesterday),
      storageUsedGb: Math.round(((storage._sum.size ?? 0) / 1e9) * 100) / 100,
      storageTotalGb: this.config.get('STORAGE_QUOTA_GB', { infer: true }),
      uploads14d,
      pendingReports,
      pendingReviews,
    };
  }

  // ─── Users ──────────────────────────────────────────────────────────────────

  async users(q: UsersQuery) {
    const where: Prisma.UserWhereInput = {
      role: q.role ? upper(q.role) : undefined,
      status: q.status ? upper(q.status) : undefined,
      ...(q.query ? { OR: [{ name: { contains: q.query, mode: 'insensitive' } }, { email: { contains: q.query, mode: 'insensitive' } }] } : {}),
    };
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { _count: { select: { events: true } } },
      }),
    ]);
    return { total, page, pageSize, items: rows.map(u => ({ ...userDto(u, this.storage), events: u._count.events })) };
  }

  async inviteUser(admin: AuthUser, dto: InviteUserDto, ip?: string) {
    if (await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } })) {
      throw new ConflictException('A user with this email already exists');
    }
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name || dto.email.split('@')[0], role: upper(dto.role), status: 'PENDING' },
    });
    await this.audit.log(admin, 'USER', `Invited ${dto.role}`, dto.email, ip);
    // The invitee finishes sign-up by registering (or signing in with Google) with this email.
    return { ...userDto(user, this.storage), events: 0 };
  }

  private async assertNotLastAdmin(userId: string) {
    const others = await this.prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE', id: { not: userId } } });
    if (others === 0) throw new BadRequestException('This is the last active admin');
  }

  async updateUser(admin: AuthUser, id: string, dto: UpdateUserDto, ip?: string) {
    if (id === admin.id) throw new BadRequestException('You cannot change your own role or status');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const role = dto.role ? upper(dto.role) : undefined;
    const status = dto.status ? upper(dto.status) : undefined;
    if (user.role === 'ADMIN' && ((role && role !== 'ADMIN') || status === 'BLOCKED')) await this.assertNotLastAdmin(id);

    const updated = await this.prisma.user.update({ where: { id }, data: { role, status } });
    if (status === 'BLOCKED') await this.tokens.revokeAll(id); // end their sessions right away

    if (role && role !== user.role) await this.audit.log(admin, 'USER', `Changed role ${lower(user.role)} → ${dto.role}`, user.email, ip);
    if (status && status !== user.status) await this.audit.log(admin, 'USER', status === 'BLOCKED' ? 'Blocked user' : 'Unblocked user', user.email, ip);
    return userDto(updated, this.storage);
  }

  /** Passwords are stored only as argon2 hashes, so the admin can't read one — only set a new one. */
  async setUserPassword(admin: AuthUser, id: string, password: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id },
      // A pending invite becomes a working account once it has a password.
      data: { passwordHash: await hashPassword(password), status: user.status === 'PENDING' ? 'ACTIVE' : undefined },
    });
    await this.tokens.revokeAll(id); // old sessions end; the user signs in with the new password
    await this.audit.log(admin, 'USER', 'Reset password', user.email, ip);
  }

  async deleteUser(admin: AuthUser, id: string, ip?: string) {
    if (id === admin.id) throw new BadRequestException('You cannot delete your own account here');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') await this.assertNotLastAdmin(id);

    const keys = await userFileKeys(this.prisma, id);
    await this.prisma.user.delete({ where: { id } });
    await this.storage.deleteMany(keys);
    await this.audit.log(admin, 'USER', 'Deleted user', user.email, ip);
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  async eventsList(q: EventsQuery) {
    const where: Prisma.EventWhereInput = {
      status: q.status ? upper(q.status) : undefined,
      ...(q.query ? {
        OR: [
          { name: { contains: q.query, mode: 'insensitive' } },
          { location: { contains: q.query, mode: 'insensitive' } },
          { organizer: { name: { contains: q.query, mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const [total, rows, counts] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { organizer: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.event.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const ids = rows.map(e => e.id);
    const [stats, reports] = await Promise.all([
      this.events.stats(ids),
      this.prisma.report.groupBy({ by: ['photoId'], where: { status: 'PENDING', photo: { eventId: { in: ids } } }, _count: { _all: true } }),
    ]);
    const reportPhotos = await this.prisma.photo.findMany({ where: { id: { in: reports.map(r => r.photoId) } }, select: { id: true, eventId: true } });
    const reportsByEvent = new Map<string, number>();
    for (const r of reports) {
      const eventId = reportPhotos.find(p => p.id === r.photoId)?.eventId;
      if (eventId) reportsByEvent.set(eventId, (reportsByEvent.get(eventId) ?? 0) + r._count._all);
    }

    return {
      total, page, pageSize,
      counts: Object.fromEntries(counts.map(c => [lower(c.status), c._count._all])),
      items: rows.map(e => ({
        ...this.events.toDto(e, stats.get(e.id)),
        organizer: e.organizer,
        reports: reportsByEvent.get(e.id) ?? 0,
      })),
    };
  }

  async setEventStatus(admin: AuthUser, id: string, status: 'upcoming' | 'active' | 'closed' | 'flagged', ip?: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const updated = await this.prisma.event.update({ where: { id }, data: { status: upper(status) } });
    const action = status === 'closed' ? 'Closed event'
      : status === 'flagged' ? 'Flagged event'
      : event.status === 'FLAGGED' ? 'Cleared flag' : `Set status ${status}`;
    await this.audit.log(admin, 'EVENT', action, event.name, ip);
    return this.events.toDto(updated, (await this.events.stats([id])).get(id));
  }

  async deleteEvent(admin: AuthUser, id: string, ip?: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const keys = await eventFileKeys(this.prisma, [id]);
    await this.prisma.event.delete({ where: { id } });
    await this.storage.deleteMany(keys);
    await this.audit.log(admin, 'EVENT', 'Deleted event', event.name, ip);
  }

  // ─── Moderation ─────────────────────────────────────────────────────────────

  /** Reports grouped per photo — the unit the admin keeps or removes. */
  async reports(q: ReportsQuery) {
    const status = upper(q.status ?? 'pending') as ReportStatus;
    const rows = await this.prisma.report.findMany({
      where: { status },
      include: { photo: { include: { event: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const groups = new Map<string, typeof rows>();
    for (const r of rows) groups.set(r.photoId, [...(groups.get(r.photoId) ?? []), r]);

    const items = [...groups.values()].map(list => {
      const { photo } = list[0];
      const reasons = new Map<ReportReason, number>();
      for (const r of list) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
      const reason = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return {
        photoId: photo.id,
        photoUrl: this.storage.url(photo.storageKey),
        photoStatus: lower(photo.status),
        event: photo.event,
        author: photo.authorName ?? 'Guest',
        reason: lower(reason),
        reports: list.length,
        aiScore: photo.aiScore,
        reportedAt: list[0].createdAt,
        status: lower(status),
      };
    });

    const sort = q.sort ?? 'ai';
    items.sort((a, b) =>
      sort === 'reports' ? b.reports - a.reports
      : sort === 'recent' ? +b.reportedAt - +a.reportedAt
      : (b.aiScore ?? -1) - (a.aiScore ?? -1) || b.reports - a.reports);

    const counts = await this.prisma.report.groupBy({ by: ['status'], _count: { photoId: true } });
    return { counts: Object.fromEntries(counts.map(c => [lower(c.status), c._count.photoId])), items };
  }

  async resolveReports(admin: AuthUser, dto: ResolveReportsDto, ip?: string) {
    const photos = await this.prisma.photo.findMany({ where: { id: { in: dto.photoIds } }, include: { event: { select: { name: true } } } });
    if (!photos.length) throw new NotFoundException('Photos not found');
    const ids = photos.map(p => p.id);

    const reportStatus: ReportStatus = dto.action === 'keep' ? 'APPROVED' : dto.action === 'remove' ? 'REMOVED' : 'PENDING';
    await this.prisma.$transaction([
      this.prisma.report.updateMany({
        where: { photoId: { in: ids } },
        data: { status: reportStatus, resolvedAt: dto.action === 'reopen' ? null : new Date(), resolvedById: dto.action === 'reopen' ? null : admin.id },
      }),
      this.prisma.photo.updateMany({
        where: { id: { in: ids } },
        data: { status: dto.action === 'keep' ? 'PUBLISHED' : dto.action === 'remove' ? 'REMOVED' : 'HIDDEN' },
      }),
    ]);

    for (const p of photos) {
      this.realtime.publish({
        eventId: p.eventId,
        type: dto.action === 'keep' ? 'photo.published' : 'photo.removed',
        data: { id: p.id },
      });
    }
    const what = ids.length > 1 ? `${ids.length} photos` : 'photo';
    const verb = dto.action === 'keep' ? 'Kept' : dto.action === 'remove' ? 'Removed' : 'Reopened';
    await this.audit.log(admin, 'MODERATION', `${verb} ${what}`, [...new Set(photos.map(p => p.event.name))].join(', '), ip);
    return { updated: ids.length };
  }

  // ─── Reviews ────────────────────────────────────────────────────────────────

  private reviewDto(r: Prisma.ReviewGetPayload<{ include: { organizer: true; event: true } }>) {
    return {
      id: r.id,
      name: r.organizer.name,
      email: r.organizer.email,
      avatarUrl: fileUrl(this.storage, r.organizer.avatarUrl),
      event: r.event ? [r.event.type, r.event.location].filter(Boolean).join(', ') || r.event.name : null,
      rating: r.rating,
      text: r.text,
      status: lower(r.status),
      featured: r.featured,
      createdAt: r.createdAt,
    };
  }

  async reviews(q: ReviewsQuery) {
    const [rows, counts] = await Promise.all([
      this.prisma.review.findMany({
        where: { status: q.status ? upper(q.status) : undefined },
        include: { organizer: true, event: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.review.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return { counts: Object.fromEntries(counts.map(c => [lower(c.status), c._count._all])), items: rows.map(r => this.reviewDto(r)) };
  }

  async updateReview(admin: AuthUser, id: string, dto: UpdateReviewDto, ip?: string) {
    const review = await this.prisma.review.findUnique({ where: { id }, include: { organizer: true } });
    if (!review) throw new NotFoundException('Review not found');

    const status = dto.status ? upper(dto.status) : review.status;
    // Only published reviews can stay on the landing page.
    const featured = status !== 'PUBLISHED' ? false : (dto.featured ?? review.featured);
    if (featured && !review.featured) {
      const count = await this.prisma.review.count({ where: { featured: true, id: { not: id } } });
      if (count >= MAX_FEATURED) throw new ConflictException(`Only ${MAX_FEATURED} reviews can be featured`);
    }

    const updated = await this.prisma.review.update({ where: { id }, data: { status, featured }, include: { organizer: true, event: true } });
    const action = dto.status === 'published' ? 'Published review'
      : dto.status === 'hidden' ? 'Hid review'
      : featured !== review.featured ? (featured ? 'Featured review on landing' : 'Removed review from landing')
      : 'Updated review';
    await this.audit.log(admin, 'CONTENT', action, review.organizer.name, ip);
    return this.reviewDto(updated);
  }

  async deleteReview(admin: AuthUser, id: string, ip?: string) {
    const review = await this.prisma.review.findUnique({ where: { id }, include: { organizer: true } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.review.delete({ where: { id } });
    await this.audit.log(admin, 'CONTENT', 'Deleted review', review.organizer.name, ip);
  }

  // ─── Content & settings ─────────────────────────────────────────────────────

  getContent(locale: Locale) {
    return this.content.get(locale);
  }

  async setContent(admin: AuthUser, locale: Locale, content: SiteContent, ip?: string) {
    const saved = await this.content.set(locale, content);
    await this.audit.log(admin, 'CONTENT', `Updated landing content (${locale})`, 'Website content', ip);
    return saved;
  }

  getSettings() {
    return this.settings.get();
  }

  async updateSettings(admin: AuthUser, patch: Partial<PlatformSettings>, ip?: string) {
    const { settings, changed } = await this.settings.update(patch);
    if (changed.includes('maintenance')) {
      await this.audit.log(admin, 'SETTINGS', settings.maintenance ? 'Enabled maintenance mode' : 'Disabled maintenance mode', 'Platform settings', ip);
    }
    const rest = changed.filter(k => k !== 'maintenance');
    if (rest.length) await this.audit.log(admin, 'SETTINGS', `Changed ${rest.join(', ')}`, 'Platform settings', ip);
    return settings;
  }

  // ─── Audit ──────────────────────────────────────────────────────────────────

  async auditLog(q: AuditQuery) {
    const limit = q.limit ?? 100;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        category: q.category ? upper(q.category) : undefined,
        ...(q.query ? {
          OR: (['actorName', 'action', 'target', 'ip'] as const).map(field => ({ [field]: { contains: q.query, mode: 'insensitive' } })),
        } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map(a => ({
        id: a.id, at: a.createdAt, actor: a.actorName, actorRole: a.actorRole, category: lower(a.category),
        action: a.action, target: a.target, ip: a.ip ?? '—',
      })),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }
}
