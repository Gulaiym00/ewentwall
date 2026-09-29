import {
  Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentGuest, OptionalGuest, Public, type AuthGuest } from '../common/auth.js';
import { GuestTokenGuard, OptionalGuestGuard } from '../common/guards.js';
import { upper } from '../common/serialize.js';
import { Prisma } from '../generated/prisma/client.js';
import { loadPhotoDto } from '../photos/photo.serializer.js';
import { AuditService } from '../platform/audit.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CommentDto, ReactDto, ReportDto } from './guest.dto.js';

// Minimal word list; replace with a proper moderation service when AI moderation is added.
const BLOCKLIST = /\b(fuck\w*|shit\w*|bitch\w*|бля\w*|сук[аи]\w*|хуй\w*|пизд\w*|еба\w*|ёба\w*)\b/giu;
const mask = (text: string) => text.replace(BLOCKLIST, w => w[0] + '*'.repeat(w.length - 1));

/** Reactions, comments and reports on a photo (live wall viewer). */
@ApiTags('guest')
@Public()
@Controller('photos/:id')
export class PhotosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
  ) {}

  /** A published photo from the guest's own event. */
  private async photoForGuest(id: string, guest: AuthGuest) {
    const photo = await this.prisma.photo.findUnique({ where: { id }, include: { event: true } });
    if (!photo || photo.eventId !== guest.eventId) throw new NotFoundException('Photo not found');
    return photo;
  }

  @Post('reactions')
  @UseGuards(GuestTokenGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'React with an emoji; the same emoji again removes it, another one replaces it' })
  async react(@Param('id', ParseUUIDPipe) id: string, @CurrentGuest() guest: AuthGuest, @Body() dto: ReactDto) {
    const photo = await this.photoForGuest(id, guest);
    if (photo.status !== 'PUBLISHED') throw new NotFoundException('Photo not found');
    if (!photo.event.allowReactions) throw new ForbiddenException('Reactions are turned off for this event');

    const key = { photoId_guestId: { photoId: id, guestId: guest.id } };
    const existing = await this.prisma.reaction.findUnique({ where: key });
    if (existing?.emoji === dto.emoji) await this.prisma.reaction.delete({ where: key });
    else await this.prisma.reaction.upsert({ where: key, create: { photoId: id, guestId: guest.id, emoji: dto.emoji }, update: { emoji: dto.emoji } });

    return loadPhotoDto(this.prisma, this.storage, id, guest.id);
  }

  @Get('comments')
  @UseGuards(OptionalGuestGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Comments on a published photo, newest first (private events need a guest token)' })
  async comments(@Param('id', ParseUUIDPipe) id: string, @OptionalGuest() guest?: AuthGuest) {
    const photo = await this.prisma.photo.findUnique({ where: { id }, select: { status: true, eventId: true, event: { select: { pinHash: true } } } });
    if (!photo || photo.status !== 'PUBLISHED') throw new NotFoundException('Photo not found');
    if (photo.event.pinHash && guest?.eventId !== photo.eventId) throw new NotFoundException('Photo not found');
    const rows = await this.prisma.comment.findMany({ where: { photoId: id }, orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map(c => ({ id: c.id, author: c.authorName, text: c.text, createdAt: c.createdAt }));
  }

  @Post('comments')
  @UseGuards(GuestTokenGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Add a comment' })
  async comment(@Param('id', ParseUUIDPipe) id: string, @CurrentGuest() guest: AuthGuest, @Body() dto: CommentDto) {
    const photo = await this.photoForGuest(id, guest);
    if (photo.status !== 'PUBLISHED') throw new NotFoundException('Photo not found');
    if (!photo.event.allowComments) throw new ForbiddenException('Comments are turned off for this event');

    const { profanityFilter } = await this.settings.get();
    const c = await this.prisma.comment.create({
      data: { photoId: id, guestId: guest.id, authorName: guest.name ?? 'Guest', text: profanityFilter ? mask(dto.text) : dto.text },
    });
    return { id: c.id, author: c.authorName, text: c.text, createdAt: c.createdAt };
  }

  @Post('reports')
  @UseGuards(GuestTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report a photo; after N reports (Admin → Settings) it is hidden until reviewed' })
  async report(@Param('id', ParseUUIDPipe) id: string, @CurrentGuest() guest: AuthGuest, @Body() dto: ReportDto) {
    const photo = await this.photoForGuest(id, guest);
    try {
      await this.prisma.report.create({ data: { photoId: id, guestId: guest.id, reason: upper(dto.reason) } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException('You already reported this photo');
      throw err;
    }

    const [{ autoHideReports }, pending] = await Promise.all([
      this.settings.get(),
      this.prisma.report.count({ where: { photoId: id, status: 'PENDING' } }),
    ]);
    if (photo.status === 'PUBLISHED' && pending >= autoHideReports) {
      await this.prisma.photo.update({ where: { id }, data: { status: 'HIDDEN' } });
      this.realtime.publish({ eventId: photo.eventId, type: 'photo.removed', data: { id } });
      await this.audit.log('system', 'MODERATION', `Auto-hid photo after ${pending} reports`, photo.event.name);
    }
    return { reported: true };
  }

  @Delete()
  @UseGuards(GuestTokenGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete your own photo' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentGuest() guest: AuthGuest) {
    const photo = await this.photoForGuest(id, guest);
    if (photo.guestId !== guest.id) throw new ForbiddenException('You can only delete your own photos');
    await this.prisma.photo.delete({ where: { id } });
    await this.storage.delete(photo.storageKey);
    this.realtime.publish({ eventId: photo.eventId, type: 'photo.removed', data: { id } });
  }
}
