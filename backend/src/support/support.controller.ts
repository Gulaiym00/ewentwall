import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { clientIp, CurrentUser, Public, Roles, type AuthUser } from '../common/auth.js';
import { fileUrl, lower, upper } from '../common/serialize.js';
import { byIp } from '../common/throttle.js';
import type { SupportMessage, SupportTicket, User } from '../generated/prisma/client.js';
import { AuditService } from '../platform/audit.service.js';
import { MailService } from '../platform/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { imageKey, StorageService } from '../storage/storage.service.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

const TOPICS = ['password', 'account', 'event', 'other'] as const;
const STATUSES = ['open', 'resolved'] as const;

class CreateTicketDto {
  @ApiProperty() @Transform(trimLower) @IsEmail() @MaxLength(254)
  email: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(80)
  name?: string;

  @ApiProperty({ enum: TOPICS }) @IsIn(TOPICS)
  topic: (typeof TOPICS)[number];

  @ApiProperty({ minLength: 5, maxLength: 2000 }) @Transform(trim) @IsString() @Length(5, 2000)
  message: string;
}

const IMAGE_MAX_MB = 10;
/** A message is text, an image (photo, GIF, sticker) or both; sent as multipart with the file in "image". */
const IMAGE_UPLOAD = FileInterceptor('image', { limits: { fileSize: IMAGE_MAX_MB * 1024 * 1024, files: 1 } });
const MESSAGE_BODY = {
  schema: { type: 'object', properties: { text: { type: 'string', maxLength: 2000 }, image: { type: 'string', format: 'binary' } } },
} as const;

class SendMessageDto {
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @Transform(trim) @IsString() @MaxLength(2000)
  text?: string;
}

class EmailDto {
  @ApiProperty({ maxLength: 150 }) @Transform(trim) @IsString() @Length(1, 150)
  subject: string;

  @ApiProperty({ maxLength: 5000 }) @Transform(trim) @IsString() @Length(1, 5000)
  text: string;
}

class TicketsQuery {
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}

class UpdateTicketDto {
  @ApiProperty({ enum: STATUSES }) @IsIn(STATUSES)
  status: (typeof STATUSES)[number];
}

type TicketRow = SupportTicket & {
  user: Pick<User, 'id' | 'name' | 'role' | 'status' | 'passwordHash' | 'googleId'> | null;
  messages: SupportMessage[];
};

const messageDto = (storage: StorageService) => (m: SupportMessage) => ({
  id: m.id, fromAdmin: m.fromAdmin, authorName: m.authorName, text: m.text, imageUrl: fileUrl(storage, m.imageKey), createdAt: m.createdAt,
});

/** Stores the attached image, if any. A message needs text, an image or both. */
async function messageContent(storage: StorageService, dto: SendMessageDto, file?: Express.Multer.File) {
  const text = dto.text ?? '';
  if (!text && !file) throw new BadRequestException('Write a message or attach an image');
  if (!file) return { text, imageKey: null };
  const { key, mime } = imageKey('support', file, IMAGE_MAX_MB);
  await storage.put(key, file.buffer, mime);
  return { text, imageKey: key };
}

/** Admin view: the conversation plus the account with this email (to reset its password from the chat). */
const ticketDto = (storage: StorageService) => (t: TicketRow) => ({
  id: t.id,
  email: t.email,
  name: t.name,
  topic: lower(t.topic),
  status: lower(t.status),
  createdAt: t.createdAt,
  resolvedAt: t.resolvedAt,
  lastMessageAt: t.lastMessageAt,
  unread: t.adminUnread,
  user: t.user && {
    id: t.user.id, name: t.user.name, role: lower(t.user.role), status: lower(t.user.status),
    hasPassword: !!t.user.passwordHash, google: !!t.user.googleId,
  },
  messages: t.messages.map(messageDto(storage)),
});

const USER_SELECT = { select: { id: true, name: true, role: true, status: true, passwordHash: true, googleId: true } } as const;
const ALL_MESSAGES = { orderBy: { createdAt: 'asc' } } as const;
const LAST_MESSAGE = { orderBy: { createdAt: 'desc' }, take: 1 } as const;

/**
 * Support chat between organizers and admins. Updates are fetched by polling (the chat page asks
 * every few seconds), so it works behind any proxy and with several API instances.
 */
@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  @Public()
  @Post()
  @Throttle({ default: { limit: 5, ttl: 3_600_000, getTracker: byIp } })
  @ApiOperation({ summary: 'Start a conversation with support without signing in (e.g. forgot password)' })
  async create(@Body() dto: CreateTicketDto, @Req() req: Request) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true, name: true } });
    const name = dto.name || user?.name;
    const ticket = await this.prisma.supportTicket.create({
      data: {
        email: dto.email, name, userId: user?.id, topic: upper(dto.topic), ip: clientIp(req), adminUnread: 1,
        messages: { create: { authorName: name || dto.email, text: dto.message } },
      },
    });
    return { id: ticket.id, createdAt: ticket.createdAt };
  }

  /** The organizer's chat is their most recent conversation; a new one starts with the first message. */
  private latest(userId: string) {
    return this.prisma.supportTicket.findFirst({ where: { userId }, orderBy: { lastMessageAt: 'desc' } });
  }

  @Get('chat')
  @Roles('ORGANIZER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My chat with support (marks admin replies as read)' })
  async chat(@CurrentUser() user: AuthUser) {
    const ticket = await this.latest(user.id);
    if (!ticket) return { status: null, messages: [] };
    const messages = await this.prisma.supportMessage.findMany({ where: { ticketId: ticket.id }, orderBy: { createdAt: 'asc' } });
    if (ticket.userUnread > 0) await this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { userUnread: 0 } });
    return { status: lower(ticket.status), messages: messages.map(messageDto(this.storage)) };
  }

  @Get('chat/unread')
  @Roles('ORGANIZER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Number of unread support replies (for the menu badge)' })
  async unread(@CurrentUser() user: AuthUser) {
    const sum = await this.prisma.supportTicket.aggregate({ where: { userId: user.id }, _sum: { userUnread: true } });
    return { count: sum._sum.userUnread ?? 0 };
  }

  @Post('chat')
  @Roles('ORGANIZER', 'ADMIN')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: `Send text and/or an image (JPEG/PNG/WebP/GIF, up to ${IMAGE_MAX_MB} MB) to support; reopens a resolved conversation` })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody(MESSAGE_BODY)
  @UseInterceptors(IMAGE_UPLOAD)
  async send(@CurrentUser() user: AuthUser, @Body() dto: SendMessageDto, @UploadedFile() file?: Express.Multer.File) {
    const content = await messageContent(this.storage, dto, file);
    const now = new Date();
    const current = await this.latest(user.id);
    const message = { authorId: user.id, authorName: user.name, ...content, createdAt: now };
    const ticket = current
      ? await this.prisma.supportTicket.update({
        where: { id: current.id },
        data: { status: 'OPEN', resolvedAt: null, lastMessageAt: now, adminUnread: { increment: 1 }, messages: { create: message } },
      })
      : await this.prisma.supportTicket.create({
        data: { email: user.email, name: user.name, userId: user.id, lastMessageAt: now, adminUnread: 1, messages: { create: message } },
      });
    const messages = await this.prisma.supportMessage.findMany({ where: { ticketId: ticket.id }, orderBy: { createdAt: 'asc' } });
    return { status: lower(ticket.status), messages: messages.map(messageDto(this.storage)) };
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/support')
export class AdminSupportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Conversations, latest activity first, each with its last message' })
  async list(@Query() q: TicketsQuery) {
    const [rows, groups] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { status: q.status ? upper(q.status) : undefined },
        include: { user: USER_SELECT, messages: LAST_MESSAGE }, orderBy: { lastMessageAt: 'desc' }, take: 200,
      }),
      this.prisma.supportTicket.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      counts: Object.fromEntries(groups.map(g => [lower(g.status), g._count])),
      items: rows.map(ticketDto(this.storage)),
      emailEnabled: this.mail.enabled,
    };
  }

  @Post(':id/email')
  @ApiOperation({ summary: 'Email the person from the server (SMTP); the email is also kept in the conversation' })
  async email(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EmailDto, @Req() req: Request) {
    const current = await this.prisma.supportTicket.findUnique({ where: { id }, select: { email: true } });
    if (!current) throw new NotFoundException('Conversation not found');
    await this.mail.send(current.email, dto.subject, dto.text);
    const now = new Date();
    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        lastMessageAt: now, adminUnread: 0, userUnread: { increment: 1 },
        messages: { create: { fromAdmin: true, authorId: me.id, authorName: me.name, text: `✉️ ${dto.subject}\n\n${dto.text}`, createdAt: now } },
      },
      include: { user: USER_SELECT, messages: ALL_MESSAGES },
    });
    await this.audit.log(me, 'USER', 'Emailed support reply', current.email, clientIp(req));
    return ticketDto(this.storage)(ticket);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One conversation with all messages (marks it read)' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: { user: USER_SELECT, messages: ALL_MESSAGES } });
    if (!ticket) throw new NotFoundException('Conversation not found');
    if (ticket.adminUnread > 0) await this.prisma.supportTicket.update({ where: { id }, data: { adminUnread: 0 } });
    return ticketDto(this.storage)({ ...ticket, adminUnread: 0 });
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Reply with text and/or an image; the organizer sees it in Dashboard → Support' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody(MESSAGE_BODY)
  @UseInterceptors(IMAGE_UPLOAD)
  async reply(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto, @UploadedFile() file?: Express.Multer.File) {
    if (!(await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Conversation not found');
    const content = await messageContent(this.storage, dto, file);
    const now = new Date();
    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        lastMessageAt: now, adminUnread: 0, userUnread: { increment: 1 },
        messages: { create: { fromAdmin: true, authorId: me.id, authorName: me.name, ...content, createdAt: now } },
      },
      include: { user: USER_SELECT, messages: ALL_MESSAGES },
    });
    return ticketDto(this.storage)(ticket);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mark a conversation resolved or reopen it' })
  async update(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto, @Req() req: Request) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Conversation not found');
    const status = upper(dto.status);
    const updated = await this.prisma.supportTicket.update({
      where: { id }, data: { status, resolvedAt: status === 'RESOLVED' ? new Date() : null }, include: { user: USER_SELECT, messages: ALL_MESSAGES },
    });
    await this.audit.log(me, 'USER', status === 'RESOLVED' ? 'Resolved support ticket' : 'Reopened support ticket', ticket.email, clientIp(req));
    return ticketDto(this.storage)(updated);
  }

  @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Conversation not found');
    const images = await this.prisma.supportMessage.findMany({ where: { ticketId: id, imageKey: { not: null } }, select: { imageKey: true } });
    await this.prisma.supportTicket.delete({ where: { id } });
    await this.storage.deleteMany(images.map(m => m.imageKey!));
    await this.audit.log(me, 'USER', 'Deleted support ticket', ticket.email, clientIp(req));
  }
}
