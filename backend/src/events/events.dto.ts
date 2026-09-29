import { ApiPropertyOptional, ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, Length, Matches, MaxLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateEventDto {
  @ApiProperty({ example: 'Anna & Timur Wedding' })
  @Transform(trim) @IsString() @Length(1, 120)
  name: string;

  @ApiPropertyOptional({ example: 'Wedding' })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40)
  type?: string;

  @ApiPropertyOptional({ example: '2026-09-25' }) @IsOptional() @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-09-26' }) @IsOptional() @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(160)
  location?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(1000)
  welcomeMessage?: string;

  @ApiPropertyOptional({ enum: ['en', 'ru'] }) @IsOptional() @IsIn(['en', 'ru'])
  language?: 'en' | 'ru';

  @ApiPropertyOptional() @IsOptional() @IsBoolean() premoderation?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowComments?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowReactions?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() askGuestName?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowDownloads?: boolean;

  @ApiPropertyOptional({ description: '4–6 digit PIN guests must enter; null removes it', nullable: true, example: '2468' })
  @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^\d{4,6}$/, { message: 'PIN must be 4–6 digits' })
  pin?: string | null;
}

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({ enum: ['upcoming', 'active', 'closed'], description: 'Organizers can open or close their event' })
  @IsOptional() @IsIn(['upcoming', 'active', 'closed'])
  status?: 'upcoming' | 'active' | 'closed';
}

export class ModeratePhotoDto {
  @ApiProperty({ enum: ['published', 'removed'] })
  @IsIn(['published', 'removed'])
  status: 'published' | 'removed';
}
