import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Res,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import QRCode from 'qrcode';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { upper } from '../common/serialize.js';
import type { PhotoStatus } from '../generated/prisma/client.js';
import { photoDto, photoInclude } from '../photos/photo.serializer.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { imageKey, StorageService } from '../storage/storage.service.js';
import { CreateEventDto, ModeratePhotoDto, UpdateEventDto } from './events.dto.js';
import { EventsService } from './events.service.js';

const COVER_MAX_MB = 10;
const PHOTO_STATUSES = ['pending', 'published', 'hidden', 'removed'] as const;

/** Organizer's own events (dashboard, create-event wizard). Admins can manage any event. */
@ApiTags('events (organizer)')
@ApiBearerAuth()
@Roles('ORGANIZER', 'ADMIN')
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'My events with photo / guest / reaction counters' })
  list(@CurrentUser() user: AuthUser) {
    return this.events.listMine(user);
  }

  @Post()
  @ApiOperation({ summary: 'Create an event (steps 1–3 of the wizard)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.events.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.getOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit details and guest settings, or open/close the event' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto) {
    return this.events.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete the event with all its photos' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.events.remove(user, id);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'QR code that opens the guest page (step 4 of the wizard)' })
  @ApiQuery({ name: 'format', enum: ['png', 'svg'], required: false })
  @ApiQuery({ name: 'download', type: Boolean, required: false })
  async qr(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: 'png' | 'svg' = 'png',
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    const event = await this.events.findManageable(user, id);
    const url = this.events.joinUrl(event.slug);
    const options = { margin: 2, errorCorrectionLevel: 'M' as const, color: { dark: '#111111', light: '#ffffff' } };
    if (download !== undefined) res.attachment(`${event.slug}-qr.${format === 'svg' ? 'svg' : 'png'}`);
    if (format === 'svg') {
      res.type('image/svg+xml').send(await QRCode.toString(url, { ...options, type: 'svg' }));
    } else {
      res.type('image/png').send(await QRCode.toBuffer(url, { ...options, width: 1024 }));
    }
  }

  @Post(':id/cover')
  @ApiOperation({ summary: `Upload the cover photo (up to ${COVER_MAX_MB} MB)` })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: COVER_MAX_MB * 1024 * 1024, files: 1 } }))
  async cover(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach an image in the "file" field');
    await this.events.findManageable(user, id);
    const { key, mime } = imageKey(`covers/${id}`, file, COVER_MAX_MB);
    await this.storage.put(key, file.buffer, mime);
    return this.events.setCover(user, id, key);
  }

  @Get(':id/photos')
  @ApiOperation({ summary: 'Photos of the event for moderation (e.g. status=pending with premoderation)' })
  @ApiQuery({ name: 'status', enum: PHOTO_STATUSES, required: false })
  async photos(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('status') status?: string) {
    await this.events.findManageable(user, id);
    const filter = PHOTO_STATUSES.includes(status as never) ? (upper(status!) as PhotoStatus) : undefined;
    const photos = await this.prisma.photo.findMany({
      where: { eventId: id, status: filter },
      include: photoInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return photos.map(p => photoDto(p, this.storage));
  }

  @Patch(':id/photos/:photoId')
  @ApiOperation({ summary: 'Approve (published) or remove a photo of this event' })
  async moderate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Body() dto: ModeratePhotoDto,
  ) {
    await this.events.findManageable(user, id);
    const existing = await this.prisma.photo.findFirst({ where: { id: photoId, eventId: id } });
    if (!existing) throw new NotFoundException('Photo not found in this event');
    const photo = await this.prisma.photo.update({ where: { id: photoId }, data: { status: upper(dto.status) }, include: photoInclude });
    const out = photoDto(photo, this.storage);
    this.realtime.publish({ eventId: id, type: dto.status === 'published' ? 'photo.published' : 'photo.removed', data: out });
    return out;
  }
}
