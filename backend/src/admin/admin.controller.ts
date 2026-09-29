import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { clientIp, CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { upper } from '../common/serialize.js';
import {
  AuditQuery, EventsQuery, InviteUserDto, ReportsQuery, ResolveReportsDto, ReviewsQuery, SiteContentDto, UpdateEventStatusDto,
  UpdateReviewDto, UpdateSettingsDto, UpdateUserDto, UsersQuery,
} from './admin.dto.js';
import { AdminService } from './admin.service.js';

const locale = (value: string) => {
  if (!['en', 'ru'].includes(value)) throw new NotFoundException('Supported locales: en, ru');
  return upper(value as 'en' | 'ru');
};

/** Admin console API (/admin/*). Every change is written to the audit log. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard KPIs, 14-day uploads, pending counters' })
  stats() {
    return this.admin.stats();
  }

  // Users
  @Get('users') users(@Query() q: UsersQuery) { return this.admin.users(q); }

  @Post('users/invite')
  @ApiOperation({ summary: 'Create a pending account; the person completes it by registering with this email' })
  invite(@CurrentUser() me: AuthUser, @Body() dto: InviteUserDto, @Req() req: Request) {
    return this.admin.inviteUser(me, dto, clientIp(req));
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Change role or block/unblock (blocking ends their sessions)' })
  updateUser(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @Req() req: Request) {
    return this.admin.updateUser(me, id, dto, clientIp(req));
  }

  @Delete('users/:id') @HttpCode(204)
  deleteUser(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.admin.deleteUser(me, id, clientIp(req));
  }

  // Events
  @Get('events') events(@Query() q: EventsQuery) { return this.admin.eventsList(q); }

  @Patch('events/:id')
  @ApiOperation({ summary: 'Close, flag or clear the flag of an event' })
  setEventStatus(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventStatusDto, @Req() req: Request) {
    return this.admin.setEventStatus(me, id, dto.status, clientIp(req));
  }

  @Delete('events/:id') @HttpCode(204)
  deleteEvent(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.admin.deleteEvent(me, id, clientIp(req));
  }

  // Moderation
  @Get('reports')
  @ApiOperation({ summary: 'Reported photos grouped per photo' })
  reports(@Query() q: ReportsQuery) { return this.admin.reports(q); }

  @Post('reports/resolve') @HttpCode(200)
  @ApiOperation({ summary: 'Keep, remove or reopen one or many reported photos' })
  resolve(@CurrentUser() me: AuthUser, @Body() dto: ResolveReportsDto, @Req() req: Request) {
    return this.admin.resolveReports(me, dto, clientIp(req));
  }

  // Reviews
  @Get('reviews') reviews(@Query() q: ReviewsQuery) { return this.admin.reviews(q); }

  @Patch('reviews/:id')
  @ApiOperation({ summary: 'Publish / hide a review, feature it on the landing page (max 3)' })
  updateReview(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReviewDto, @Req() req: Request) {
    return this.admin.updateReview(me, id, dto, clientIp(req));
  }

  @Delete('reviews/:id') @HttpCode(204)
  deleteReview(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.admin.deleteReview(me, id, clientIp(req));
  }

  // Website content
  @Get('content/:locale') getContent(@Param('locale') l: string) { return this.admin.getContent(locale(l)); }

  @Put('content/:locale')
  @ApiOperation({ summary: 'Replace landing texts for one language' })
  setContent(@CurrentUser() me: AuthUser, @Param('locale') l: string, @Body() dto: SiteContentDto, @Req() req: Request) {
    return this.admin.setContent(me, locale(l), dto, clientIp(req));
  }

  // Settings
  @Get('settings') getSettings() { return this.admin.getSettings(); }

  @Patch('settings')
  @ApiOperation({ summary: 'Change platform settings (only the sent fields)' })
  updateSettings(@CurrentUser() me: AuthUser, @Body() dto: UpdateSettingsDto, @Req() req: Request) {
    return this.admin.updateSettings(me, dto, clientIp(req));
  }

  // Audit log
  @Get('audit')
  @ApiOperation({ summary: 'Audit log, newest first, with cursor pagination' })
  audit(@Query() q: AuditQuery) { return this.admin.auditLog(q); }
}
