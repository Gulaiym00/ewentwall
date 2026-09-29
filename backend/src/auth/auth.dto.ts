import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterDto {
  @ApiProperty({ example: 'Anna Ivanova' })
  @Transform(trim) @IsString() @Length(1, 80)
  name: string;

  @ApiProperty({ example: 'anna@example.com' })
  @Transform(trimLower) @IsEmail() @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 8, example: 'correct-horse-battery' })
  @IsString() @MinLength(8) @MaxLength(128)
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'anna@example.com' })
  @Transform(trimLower) @IsEmail()
  email: string;

  @ApiProperty()
  @IsString() @MaxLength(128)
  password: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token from login/register/refresh' })
  @IsString() @Length(20, 200)
  refreshToken: string;
}
