import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { CurrentUser, Public, Roles, type AuthUser } from '../common/auth.js';
import { fileUrl, lower, upper } from '../common/serialize.js';
import { ContentService } from '../platform/content.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @Type(() => Number) @IsInt() @Min(1) @Max(5)
  rating: number;

  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @Length(10, 1000)
  text: string;

  @ApiPropertyOptional({ description: 'Which of your events this is about' }) @IsOptional() @IsUUID()
  eventId?: string;
}

/** Organizer reviews → admin moderation (Admin → Reviews) → landing page. */
@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Reviews shown on the landing page (published and featured, max 3)' })
  async featured() {
    const reviews = await this.prisma.review.findMany({
      where: { status: 'PUBLISHED', featured: true },
      include: { organizer: { select: { name: true, avatarUrl: true } }, event: { select: { type: true, location: true } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    return reviews.map(r => ({
      id: r.id,
      name: r.organizer.name,
      avatarUrl: fileUrl(this.storage, r.organizer.avatarUrl),
      event: [r.event?.type, r.event?.location].filter(Boolean).join(', ') || null,
      rating: r.rating,
      text: r.text,
      createdAt: r.createdAt,
    }));
  }

  @Post()
  @Roles('ORGANIZER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a review about the service; it appears after admin approval' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    if (dto.eventId) {
      const own = await this.prisma.event.findFirst({ where: { id: dto.eventId, organizerId: user.id }, select: { id: true } });
      if (!own) throw new NotFoundException('Event not found');
    }
    const r = await this.prisma.review.create({ data: { organizerId: user.id, eventId: dto.eventId, rating: dto.rating, text: dto.text } });
    return { id: r.id, rating: r.rating, text: r.text, status: lower(r.status), createdAt: r.createdAt };
  }

  @Get('mine')
  @Roles('ORGANIZER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My reviews and their moderation status' })
  async mine(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.review.findMany({ where: { organizerId: user.id }, orderBy: { createdAt: 'desc' } });
    return rows.map(r => ({ id: r.id, eventId: r.eventId, rating: r.rating, text: r.text, status: lower(r.status), createdAt: r.createdAt }));
  }
}

/** Landing page texts in the chosen language (edited in Admin → Website content). */
@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get(':locale')
  @ApiOperation({ summary: 'Landing texts: hero, buttons, FAQ' })
  get(@Param('locale') locale: string) {
    if (!['en', 'ru'].includes(locale)) throw new NotFoundException('Supported locales: en, ru');
    return this.content.get(upper(locale as 'en' | 'ru'));
  }
}

