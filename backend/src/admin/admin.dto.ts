import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PageQuery {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number = 50;

  @ApiPropertyOptional({ description: 'Search text' }) @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  query?: string;
}

export class UsersQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['guest', 'organizer', 'admin'] }) @IsOptional() @IsIn(['guest', 'organizer', 'admin'])
  role?: 'guest' | 'organizer' | 'admin';

  @ApiPropertyOptional({ enum: ['active', 'pending', 'blocked'] }) @IsOptional() @IsIn(['active', 'pending', 'blocked'])
  status?: 'active' | 'pending' | 'blocked';
}

export class InviteUserDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(80)
  name?: string;

  @ApiProperty() @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail()
  email: string;

  @ApiProperty({ enum: ['guest', 'organizer', 'admin'] }) @IsIn(['guest', 'organizer', 'admin'])
  role: 'guest' | 'organizer' | 'admin';
}

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: ['guest', 'organizer', 'admin'] }) @IsOptional() @IsIn(['guest', 'organizer', 'admin'])
  role?: 'guest' | 'organizer' | 'admin';

  @ApiPropertyOptional({ enum: ['active', 'blocked'] }) @IsOptional() @IsIn(['active', 'blocked'])
  status?: 'active' | 'blocked';
}

export class EventsQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['upcoming', 'active', 'closed', 'flagged'] }) @IsOptional() @IsIn(['upcoming', 'active', 'closed', 'flagged'])
  status?: 'upcoming' | 'active' | 'closed' | 'flagged';
}

export class UpdateEventStatusDto {
  @ApiProperty({ enum: ['upcoming', 'active', 'closed', 'flagged'] }) @IsIn(['upcoming', 'active', 'closed', 'flagged'])
  status: 'upcoming' | 'active' | 'closed' | 'flagged';
}

export class ReportsQuery {
  @ApiPropertyOptional({ enum: ['pending', 'approved', 'removed'], default: 'pending' })
  @IsOptional() @IsIn(['pending', 'approved', 'removed'])
  status?: 'pending' | 'approved' | 'removed' = 'pending';

  @ApiPropertyOptional({ enum: ['ai', 'reports', 'recent'], default: 'ai' })
  @IsOptional() @IsIn(['ai', 'reports', 'recent'])
  sort?: 'ai' | 'reports' | 'recent' = 'ai';
}

export class ResolveReportsDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID('all', { each: true })
  photoIds: string[];

  @ApiProperty({ enum: ['keep', 'remove', 'reopen'] }) @IsIn(['keep', 'remove', 'reopen'])
  action: 'keep' | 'remove' | 'reopen';
}

export class ReviewsQuery {
  @ApiPropertyOptional({ enum: ['pending', 'published', 'hidden'] }) @IsOptional() @IsIn(['pending', 'published', 'hidden'])
  status?: 'pending' | 'published' | 'hidden';
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ enum: ['pending', 'published', 'hidden'] }) @IsOptional() @IsIn(['pending', 'published', 'hidden'])
  status?: 'pending' | 'published' | 'hidden';

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  featured?: boolean;
}

class FaqItemDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 200) q: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 1000) a: string;
}

export class SiteContentDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 60) heroTitle: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 160) heroSubtitle: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 28) ctaPrimary: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 28) ctaSecondary: string;

  @ApiProperty({ type: [FaqItemDto] })
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => FaqItemDto)
  faq: FaqItemDto[];
}

export class UpdateSettingsDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(1, 60) platformName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() supportEmail?: string;
  @ApiPropertyOptional({ enum: ['en', 'ru'] }) @IsOptional() @IsIn(['en', 'ru']) defaultLocale?: 'en' | 'ru';
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(50) maxPhotoMb?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(50) maxPerUpload?: number;
  @ApiPropertyOptional({ enum: [3, 6, 12, 24] }) @IsOptional() @IsIn([3, 6, 12, 24]) retentionMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() aiModeration?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(40) @Max(95) aiThreshold?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() profanityFilter?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(50) autoHideReports?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() require2fa?: boolean;
  @ApiPropertyOptional({ enum: [1, 4, 12, 24] }) @IsOptional() @IsIn([1, 4, 12, 24]) sessionHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowSignups?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() maintenance?: boolean;
}

export class AuditQuery {
  @ApiPropertyOptional({ enum: ['auth', 'user', 'event', 'moderation', 'content', 'settings'] })
  @IsOptional() @IsIn(['auth', 'user', 'event', 'moderation', 'content', 'settings'])
  category?: 'auth' | 'user' | 'event' | 'moderation' | 'content' | 'settings';

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  query?: string;

  @ApiPropertyOptional({ description: 'Id of the last entry from the previous page' }) @IsOptional() @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ default: 100, maximum: 500 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500)
  limit?: number = 100;
}
