import {
  BadRequestException, Body, ConflictException, Controller, Delete, HttpCode, Patch, Post, UnauthorizedException, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { upper, userDto } from '../common/serialize.js';
import { hashPassword } from '../auth/auth.service.js';
import { TokensService } from '../auth/tokens.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isStorageKey, userFileKeys } from '../storage/cleanup.js';
import { imageKey, StorageService } from '../storage/storage.service.js';
import { ChangePasswordDto, UpdateMeDto } from './me.dto.js';

const AVATAR_MAX_MB = 5;

/** The signed-in user's own account (organizer profile page). */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tokens: TokensService,
  ) {}

  @Patch()
  @ApiOperation({ summary: 'Update profile and notification preferences' })
  async update(@CurrentUser() me: AuthUser, @Body() dto: UpdateMeDto) {
    if (dto.email && dto.email !== me.email) {
      const taken = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
      if (taken) throw new ConflictException('This email is already used by another account');
    }
    const n = dto.notifications;
    const user = await this.prisma.user.update({
      where: { id: me.id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        city: dto.city,
        language: dto.language ? upper(dto.language) : undefined,
        notifyNewPhotos: n?.newPhotos,
        notifyDailySummary: n?.dailySummary,
        notifyReports: n?.reports,
        notifyProduct: n?.product,
      },
    });
    return userDto(user, this.storage);
  }

  @Post('password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Change (or set, for Google accounts) the password; signs out other devices' })
  async changePassword(@CurrentUser() me: AuthUser, @Body() dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { passwordHash: true } });
    if (user.passwordHash) {
      if (!dto.currentPassword || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
        throw new UnauthorizedException('Current password is wrong');
      }
      if (dto.currentPassword === dto.newPassword) throw new BadRequestException('New password must be different');
    }
    await this.prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(dto.newPassword) } });
    await this.tokens.revokeAll(me.id);
  }

  @Post('avatar')
  @ApiOperation({ summary: `Upload a profile photo (JPEG/PNG/WebP/GIF, up to ${AVATAR_MAX_MB} MB)` })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_MB * 1024 * 1024, files: 1 } }))
  async avatar(@CurrentUser() me: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach an image in the "file" field');
    const { key, mime } = imageKey(`avatars/${me.id}`, file, AVATAR_MAX_MB);
    await this.storage.put(key, file.buffer, mime);

    const old = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { avatarUrl: true } });
    const user = await this.prisma.user.update({ where: { id: me.id }, data: { avatarUrl: key } });
    if (isStorageKey(old.avatarUrl)) await this.storage.delete(old.avatarUrl);
    return userDto(user, this.storage);
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Remove the profile photo' })
  async removeAvatar(@CurrentUser() me: AuthUser) {
    const old = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { avatarUrl: true } });
    const user = await this.prisma.user.update({ where: { id: me.id }, data: { avatarUrl: null } });
    if (isStorageKey(old.avatarUrl)) await this.storage.delete(old.avatarUrl);
    return userDto(user, this.storage);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete the account with all events and photos' })
  async remove(@CurrentUser() me: AuthUser) {
    if (me.role === 'ADMIN') {
      const admins = await this.prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      if (admins <= 1) throw new BadRequestException('You are the last admin — assign another admin first');
    }
    const keys = await userFileKeys(this.prisma, me.id);
    await this.prisma.user.delete({ where: { id: me.id } }); // cascades to events, photos, tokens
    await this.storage.deleteMany(keys);
  }
}
