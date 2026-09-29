import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, MinLength, ValidateNested } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class NotificationsDto {
  @IsOptional() @IsBoolean() newPhotos?: boolean;
  @IsOptional() @IsBoolean() dailySummary?: boolean;
  @IsOptional() @IsBoolean() reports?: boolean;
  @IsOptional() @IsBoolean() product?: boolean;
}

export class UpdateMeDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(1, 80)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail()
  email?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ enum: ['en', 'ru'] }) @IsOptional() @IsIn(['en', 'ru'])
  language?: 'en' | 'ru';

  @ApiPropertyOptional({ type: NotificationsDto }) @IsOptional() @ValidateNested() @Type(() => NotificationsDto)
  notifications?: NotificationsDto;
}

export class ChangePasswordDto {
  @ApiPropertyOptional({ description: 'Required when the account already has a password' })
  @IsOptional() @IsString() @MaxLength(128)
  currentPassword?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsString() @MinLength(8) @MaxLength(128)
  newPassword: string;
}
