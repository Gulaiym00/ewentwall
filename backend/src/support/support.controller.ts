import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { clientIp, CurrentUser, Public, Roles, type AuthUser } from '../common/auth.js';
import { lower, upper } from '../common/serialize.js';
import { byIp } from '../common/throttle.js';
import type { SupportTicket, User } from '../generated/prisma/client.js';
import { AuditService } from '../platform/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

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

class TicketsQuery {
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}

class UpdateTicketDto {
  @ApiProperty({ enum: STATUSES }) @IsIn(STATUSES)
  status: (typeof STATUSES)[number];
}

type TicketRow = SupportTicket & { user: Pick<User, 'id' | 'name' | 'role' | 'status' | 'passwordHash' | 'googleId'> | null };

const ticketDto = (t: TicketRow) => ({
  id: t.id,
  email: t.email,
  name: t.name,
  topic: lower(t.topic),
  message: t.message,
  status: lower(t.status),
  createdAt: t.createdAt,
  resolvedAt: t.resolvedAt,
  // The account with this email, so the admin can reset its password right from the ticket.
  user: t.user && {
    id: t.user.id, name: t.user.name, role: lower(t.user.role), status: lower(t.user.status),
    hasPassword: !!t.user.passwordHash, google: !!t.user.googleId,
  },
});

const USER_SELECT = { select: { id: true, name: true, role: true, status: true, passwordHash: true, googleId: true } } as const;

/** Support form on the site → Admin → Support. No email is sent; the admin answers from the ticket. */
@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post()
  @Throttle({ default: { limit: 5, ttl: 3_600_000, getTracker: byIp } })
  @ApiOperation({ summary: 'Send a message to support (works without signing in, e.g. forgot password)' })
  async create(@Body() dto: CreateTicketDto, @Req() req: Request) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true, name: true } });
    const ticket = await this.prisma.supportTicket.create({
      data: { email: dto.email, name: dto.name || user?.name, userId: user?.id, topic: upper(dto.topic), message: dto.message, ip: clientIp(req) },
    });
    return { id: ticket.id, createdAt: ticket.createdAt };
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/support')
export class AdminSupportController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Support tickets, newest first, with counts per status' })
  async list(@Query() q: TicketsQuery) {
    const [rows, groups] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { status: q.status ? upper(q.status) : undefined }, include: { user: USER_SELECT }, orderBy: { createdAt: 'desc' }, take: 200,
      }),
      this.prisma.supportTicket.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      counts: Object.fromEntries(groups.map(g => [lower(g.status), g._count])),
      items: rows.map(ticketDto),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mark a ticket resolved or reopen it' })
  async update(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto, @Req() req: Request) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const status = upper(dto.status);
    const updated = await this.prisma.supportTicket.update({
      where: { id }, data: { status, resolvedAt: status === 'RESOLVED' ? new Date() : null }, include: { user: USER_SELECT },
    });
    await this.audit.log(me, 'USER', status === 'RESOLVED' ? 'Resolved support ticket' : 'Reopened support ticket', ticket.email, clientIp(req));
    return ticketDto(updated);
  }

  @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    await this.prisma.supportTicket.delete({ where: { id } });
    await this.audit.log(me, 'USER', 'Deleted support ticket', ticket.email, clientIp(req));
  }
}
