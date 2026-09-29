import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { REACTION_EMOJIS } from '../photos/photo.serializer.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class JoinEventDto {
  @ApiPropertyOptional({ example: 'Aigerim', description: 'Shown next to the guest’s photos and comments' })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40)
  name?: string;

  @ApiPropertyOptional({ example: '2468' })
  @IsOptional() @Matches(/^\d{4,6}$/, { message: 'PIN must be 4–6 digits' })
  pin?: string;
}

export class ListPhotosQuery {
  @ApiPropertyOptional({ enum: ['newest', 'popular', 'mine'] })
  @IsOptional() @IsIn(['newest', 'popular', 'mine'])
  sort?: 'newest' | 'popular' | 'mine' = 'newest';

  @ApiPropertyOptional({ description: 'Id of the last photo from the previous page' })
  @IsOptional() @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 40 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 40;
}

export class UploadCaptionDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  caption?: string;
}

export class ReactDto {
  @ApiProperty({ enum: REACTION_EMOJIS })
  @IsIn(REACTION_EMOJIS as unknown as string[])
  emoji: string;
}

export class CommentDto {
  @ApiProperty({ maxLength: 500 })
  @Transform(trim) @IsString() @Length(1, 500)
  text: string;
}

export class ReportDto {
  @ApiProperty({ enum: ['inappropriate', 'spam', 'copyright', 'privacy', 'violence'] })
  @IsIn(['inappropriate', 'spam', 'copyright', 'privacy', 'violence'])
  reason: 'inappropriate' | 'spam' | 'copyright' | 'privacy' | 'violence';
}
