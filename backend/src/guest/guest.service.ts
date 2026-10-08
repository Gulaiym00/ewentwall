import {
  BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { open, readFile, rm } from 'node:fs/promises';
import type { Event, Prisma } from '../generated/prisma/client.js';
import type { AuthGuest } from '../common/auth.js';
import { fileUrl, lower } from '../common/serialize.js';
import { TokensService } from '../auth/tokens.service.js';
import { EventsService } from '../events/events.service.js';
import { photoDto, photoInclude } from '../photos/photo.serializer.js';
import { makeThumbnail, thumbKeyFor } from '../photos/thumbnail.js';
import { SettingsService } from '../platform/settings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { imageKey, StorageService } from '../storage/storage.service.js';
import type { JoinEventDto, ListPhotosQuery } from './guest.dto.js';

// PIN guessing: at most this many wrong PINs per IP and event in the window (a venue shares one IP, so not too strict).
const PIN_MAX_FAILS = 20;
const PIN_WINDOW_MS = 10 * 60_000;

/** First bytes of a file: enough to recognise the image type. */
async function readHead(path: string): Promise<Buffer> {
  const file = await open(path, 'r');
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(16), 0, 16, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

@Injectable()
export class GuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tokens: TokensService,
    private readonly events: EventsService,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Wrong PIN attempts per "ip|eventId" (in memory: the API runs as one instance). */
  private readonly pinFails = new Map<string, { count: number; resetAt: number }>();

  private checkPinAttempts(key: string) {
    const entry = this.pinFails.get(key);
    if (entry && entry.resetAt > Date.now() && entry.count >= PIN_MAX_FAILS) {
      throw new HttpException('Too many wrong PINs — try again in a few minutes', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordPinFail(key: string) {
    const now = Date.now();
    if (this.pinFails.size > 10_000) for (const [k, v] of this.pinFails) if (v.resetAt <= now) this.pinFails.delete(k);
    const entry = this.pinFails.get(key);
    if (!entry || entry.resetAt <= now) this.pinFails.set(key, { count: 1, resetAt: now + PIN_WINDOW_MS });
    else entry.count++;
  }

  async eventBySlug(slug: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Event not found — check the QR code or link');
    return event;
  }

  /** What a guest sees: no organizer data, no PIN hash. */
  async publicEvent(slug: string) {
    const event = await this.eventBySlug(slug);
    const stats = (await this.events.stats([event.id])).get(event.id)!;
    return {
      slug: event.slug,
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
        askGuestName: event.askGuestName,
        pinRequired: event.pinHash !== null,
        allowComments: event.allowComments,
        allowReactions: event.allowReactions,
        allowDownloads: event.allowDownloads,
        premoderation: event.premoderation,
      },
      stats: { photos: stats.photos, guests: stats.guests, reactions: stats.reactions },
    };
  }

  async join(slug: string, dto: JoinEventDto, ip = 'unknown') {
    const event = await this.eventBySlug(slug);
    if (event.pinHash) {
      const key = `${ip}|${event.id}`;
      this.checkPinAttempts(key);
      if (!dto.pin || !(await argon2.verify(event.pinHash, dto.pin))) {
        this.recordPinFail(key);
        throw new UnauthorizedException('Wrong PIN');
      }
    }
    const guest = await this.prisma.guest.create({ data: { eventId: event.id, name: dto.name || null } });
    return {
      guestToken: await this.tokens.signGuest(guest.id, event.id),
      guest: { id: guest.id, name: guest.name },
    };
  }

  /** Wall feed with cursor pagination. Guests also see their own photos that await approval. */
  async photos(slug: string, q: ListPhotosQuery, guest?: AuthGuest) {
    const event = await this.eventBySlug(slug);
    const viewer = guest?.eventId === event.id ? guest.id : undefined;
    // A PIN makes the whole event private, not just uploads.
    if (event.pinHash && !viewer) throw new UnauthorizedException('Enter the event PIN to see photos');
    if (q.sort === 'mine' && !viewer) throw new UnauthorizedException('Join the event to see your photos');

    const where: Prisma.PhotoWhereInput = q.sort === 'mine'
      ? { eventId: event.id, guestId: viewer, status: { in: ['PUBLISHED', 'PENDING'] } }
      : { eventId: event.id, status: 'PUBLISHED' };
    const orderBy: Prisma.PhotoOrderByWithRelationInput[] = q.sort === 'popular'
      ? [{ reactions: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }]
      : [{ createdAt: 'desc' }, { id: 'desc' }];
    const limit = q.limit ?? 40;

    const rows = await this.prisma.photo.findMany({
      where, orderBy, include: photoInclude,
      take: limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map(p => photoDto(p, this.storage, viewer)),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }

  /** Files arrive as temp files on disk (see guest.controller.ts); they are always removed afterwards. */
  async upload(slug: string, guest: AuthGuest, files: Express.Multer.File[], caption?: string) {
    try {
      return await this.saveUpload(slug, guest, files, caption);
    } finally {
      await Promise.allSettled((files ?? []).map(f => rm(f.path, { force: true })));
    }
  }

  private async saveUpload(slug: string, guest: AuthGuest, files: Express.Multer.File[], caption?: string) {
    const event = await this.eventBySlug(slug);
    if (guest.eventId !== event.id) throw new ForbiddenException('You joined a different event');

    const settings = await this.settings.get();
    if (settings.maintenance) throw new ServiceUnavailableException('Uploads are paused for maintenance, please try again later');
    if (event.status === 'CLOSED') throw new ForbiddenException('This event is closed — uploads are no longer accepted');
    if (!files?.length) throw new BadRequestException('Attach at least one photo in the "files" field');
    if (files.length > settings.maxPerUpload) throw new BadRequestException(`Up to ${settings.maxPerUpload} photos per upload`);

    // Validate everything before writing anything, so a bad file doesn't leave a half upload.
    const validated = await Promise.all(files.map(async f => ({
      file: f,
      ...imageKey(`events/${event.id}`, { buffer: await readHead(f.path), size: f.size }, settings.maxPhotoMb),
    })));
    // One photo in memory at a time: the free server has ~512 MB of RAM.
    const prepared: (typeof validated[number] & { thumbKey: string | null })[] = [];
    const keys: string[] = [];
    try {
      for (const p of validated) {
        const body = await readFile(p.file.path);
        const thumb = await makeThumbnail(body, p.mime);
        const thumbKey = thumb ? thumbKeyFor(p.key) : null;
        keys.push(p.key, ...(thumbKey ? [thumbKey] : []));
        await Promise.all([
          this.storage.put(p.key, body, p.mime),
          ...(thumb && thumbKey ? [this.storage.put(thumbKey, thumb, 'image/webp')] : []),
        ]);
        prepared.push({ ...p, thumbKey });
      }
    } catch (err) {
      await this.storage.deleteMany(keys);
      throw err;
    }

    const status = event.premoderation ? 'PENDING' : 'PUBLISHED';
    try {
      const created = await this.prisma.$transaction(prepared.map(p => this.prisma.photo.create({
        data: {
          eventId: event.id, guestId: guest.id, authorName: guest.name, caption: caption || null,
          storageKey: p.key, thumbKey: p.thumbKey, mimeType: p.mime, size: p.file.size, status,
        },
        include: photoInclude,
      })));
      const dtos = created.map(p => photoDto(p, this.storage, guest.id));
      if (status === 'PUBLISHED') for (const d of dtos) this.realtime.publish({ eventId: event.id, type: 'photo.published', data: d });
      return { photos: dtos, awaitingApproval: status === 'PENDING' };
    } catch (err) {
      await this.storage.deleteMany(keys);
      throw err;
    }
  }

  /** Live wall stream; private (PIN) events need a guest token passed as ?token= (EventSource can't send headers). */
  async streamFor(slug: string, token?: string) {
    const event = await this.eventBySlug(slug);
    if (event.pinHash) {
      const payload = token ? await this.tokens.verifyGuest(token) : null;
      if (payload?.eid !== event.id) throw new UnauthorizedException('Enter the event PIN to see photos');
    }
    return this.realtime.stream(event.id);
  }
}
