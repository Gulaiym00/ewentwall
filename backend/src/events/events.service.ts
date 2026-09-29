import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import type { Env } from '../config/env.js';
import type { Event, Prisma } from '../generated/prisma/client.js';
import { Prisma as PrismaNs } from '../generated/prisma/client.js';
import type { AuthUser } from '../common/auth.js';
import { fileUrl, lower, upper } from '../common/serialize.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { eventFileKeys } from '../storage/cleanup.js';
import type { CreateEventDto, UpdateEventDto } from './events.dto.js';

export interface EventStats { photos: number; pendingPhotos: number; guests: number; reactions: number }
const EMPTY_STATS: EventStats = { photos: 0, pendingPhotos: 0, guests: 0, reactions: 0 };

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ә: 'a', ө: 'o', ү: 'u', ң: 'n', ғ: 'g', қ: 'q', һ: 'h', і: 'i',
};

/** "Свадьба Анны & Тимура" → "svadba-anny-timura-k3x9q2" (random suffix makes links unguessable). */
export function makeSlug(name: string): string {
  const base = name.toLowerCase().split('').map(c => TRANSLIT[c] ?? c).join('')
    .normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'event';
  return `${base}-${randomBytes(4).toString('hex').slice(0, 6)}`;
}

/** Status of a new event: upcoming until its start date, otherwise live right away. */
const initialStatus = (startsAt?: string) =>
  startsAt && new Date(startsAt).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0) ? 'UPCOMING' : 'ACTIVE';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  joinUrl(slug: string) {
    return `${this.config.get('FRONTEND_URL', { infer: true })}/e/${slug}`;
  }

  toDto(event: Event, stats: EventStats = EMPTY_STATS) {
    return {
      id: event.id,
      slug: event.slug,
      joinUrl: this.joinUrl(event.slug),
      name: event.name,
      type: event.type,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: event.location,
      welcomeMessage: event.welcomeMessage,
      coverUrl: fileUrl(this.storage, event.coverUrl),
      language: lower(event.language),
      status: lower(event.status),
      settings: {
        premoderation: event.premoderation,
        allowComments: event.allowComments,
        allowReactions: event.allowReactions,
        askGuestName: event.askGuestName,
        allowDownloads: event.allowDownloads,
        pinRequired: event.pinHash !== null,
      },
      stats,
      createdAt: event.createdAt,
    };
  }

  /** Photo/guest/reaction counters for several events in three queries. */
  async stats(eventIds: string[]): Promise<Map<string, EventStats>> {
    const result = new Map(eventIds.map(id => [id, { ...EMPTY_STATS }]));
    if (!eventIds.length) return result;
    const [photos, guests, reactions] = await Promise.all([
      this.prisma.photo.groupBy({ by: ['eventId', 'status'], where: { eventId: { in: eventIds } }, _count: { _all: true } }),
      this.prisma.guest.groupBy({ by: ['eventId'], where: { eventId: { in: eventIds } }, _count: { _all: true } }),
      this.prisma.$queryRaw<{ eventId: string; count: bigint }[]>`
        SELECT p."eventId", COUNT(*) AS count FROM "Reaction" r
        JOIN "Photo" p ON p.id = r."photoId"
        WHERE p."eventId" IN (${PrismaNs.join(eventIds.map(id => PrismaNs.sql`${id}::uuid`))})
        GROUP BY p."eventId"`,
    ]);
    for (const p of photos) {
      const s = result.get(p.eventId)!;
      if (p.status === 'PUBLISHED') s.photos += p._count._all;
      if (p.status === 'PENDING') s.pendingPhotos += p._count._all;
    }
    for (const g of guests) result.get(g.eventId)!.guests = g._count._all;
    for (const r of reactions) result.get(r.eventId)!.reactions = Number(r.count);
    return result;
  }

  async listMine(user: AuthUser) {
    const events = await this.prisma.event.findMany({ where: { organizerId: user.id }, orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }] });
    const stats = await this.stats(events.map(e => e.id));
    return events.map(e => this.toDto(e, stats.get(e.id)));
  }

  /** Loads an event the user may manage: its organizer, or any admin. */
  async findManageable(user: AuthUser, id: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.organizerId !== user.id && user.role !== 'ADMIN') throw new ForbiddenException('This is not your event');
    return event;
  }

  async getOne(user: AuthUser, id: string) {
    const event = await this.findManageable(user, id);
    return this.toDto(event, (await this.stats([id])).get(id));
  }

  private async data(dto: CreateEventDto | UpdateEventDto): Promise<Prisma.EventUncheckedUpdateInput> {
    return {
      name: dto.name,
      type: dto.type,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      location: dto.location,
      welcomeMessage: dto.welcomeMessage,
      language: dto.language ? upper(dto.language) : undefined,
      premoderation: dto.premoderation,
      allowComments: dto.allowComments,
      allowReactions: dto.allowReactions,
      askGuestName: dto.askGuestName,
      allowDownloads: dto.allowDownloads,
      pinHash: dto.pin === undefined ? undefined : dto.pin === null ? null : await argon2.hash(dto.pin),
    };
  }

  async create(user: AuthUser, dto: CreateEventDto) {
    const event = await this.prisma.event.create({
      data: {
        ...(await this.data(dto)) as Prisma.EventUncheckedCreateInput,
        name: dto.name,
        slug: makeSlug(dto.name),
        organizerId: user.id,
        status: initialStatus(dto.startsAt),
      },
    });
    return this.toDto(event);
  }

  async update(user: AuthUser, id: string, dto: UpdateEventDto) {
    const current = await this.findManageable(user, id);
    // Organizers can't lift an admin flag by editing the event.
    const status = dto.status && current.status !== 'FLAGGED' ? upper(dto.status) : undefined;
    const event = await this.prisma.event.update({ where: { id }, data: { ...(await this.data(dto)), status } });
    return this.toDto(event, (await this.stats([id])).get(id));
  }

  async remove(user: AuthUser, id: string) {
    await this.findManageable(user, id);
    const keys = await eventFileKeys(this.prisma, [id]);
    await this.prisma.event.delete({ where: { id } });
    await this.storage.deleteMany(keys);
  }

  async setCover(user: AuthUser, id: string, key: string) {
    const current = await this.findManageable(user, id);
    const event = await this.prisma.event.update({ where: { id }, data: { coverUrl: key } });
    if (current.coverUrl && !/^https?:\/\//.test(current.coverUrl)) await this.storage.delete(current.coverUrl);
    return this.toDto(event, (await this.stats([id])).get(id));
  }
}
