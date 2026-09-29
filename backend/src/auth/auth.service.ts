import { ConflictException, ForbiddenException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../platform/audit.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { StorageService } from '../storage/storage.service.js';
import { userDto, type UserDto } from '../common/serialize.js';
import { TokensService, type TokenPair } from './tokens.service.js';
import type { LoginDto, RegisterDto } from './auth.dto.js';

export interface SessionMeta { userAgent?: string; ip?: string }
export interface AuthResult extends TokenPair { user: UserDto }

export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });

@Injectable()
export class AuthService implements OnModuleInit {
  /** Verified against when the email is unknown, so response time doesn't reveal which emails exist. */
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await hashPassword('timing-safe-placeholder');
  }

  private async session(user: User, meta: SessionMeta): Promise<AuthResult> {
    const [tokens] = await Promise.all([
      this.tokens.issue(user, meta),
      this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }),
    ]);
    if (user.role === 'ADMIN') {
      await this.audit.log({ id: user.id, name: user.name, role: user.role }, 'AUTH', 'Signed in', 'Admin console', meta.ip);
    }
    return { ...tokens, user: userDto(user, this.storage) };
  }

  async register(dto: RegisterDto, meta: SessionMeta): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // An admin invite creates a PENDING user without a password: registering claims it.
    if (existing && !(existing.status === 'PENDING' && !existing.passwordHash)) {
      throw new ConflictException('An account with this email already exists');
    }
    if (!existing && !(await this.settings.get()).allowSignups) {
      throw new ForbiddenException('Registration is currently closed');
    }

    const passwordHash = await hashPassword(dto.password);
    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data: { name: dto.name, passwordHash, status: 'ACTIVE' } })
      : await this.prisma.user.create({ data: { name: dto.name, email: dto.email, passwordHash, role: 'ORGANIZER' } });
    return this.session(user, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = await argon2.verify(user?.passwordHash ?? this.dummyHash, dto.password);

    if (!user || !valid) {
      if (user?.role === 'ADMIN') await this.audit.log('system', 'AUTH', 'Failed admin sign-in', user.email, meta.ip);
      // Google-only accounts land here too; the message covers both cases.
      throw new UnauthorizedException('Wrong email or password');
    }
    if (user.status === 'BLOCKED') throw new ForbiddenException('Account is blocked');
    return this.session(user, meta);
  }

  /** Called after Google confirmed the identity (see google.service.ts). */
  async googleSignIn(profile: { googleId: string; email: string; name: string; picture?: string }, meta: SessionMeta): Promise<AuthResult> {
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } })
      ?? await this.prisma.user.findUnique({ where: { email: profile.email } });

    if (user) {
      if (user.status === 'BLOCKED') throw new ForbiddenException('Account is blocked');
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.googleId,
          status: 'ACTIVE',
          avatarUrl: user.avatarUrl ?? profile.picture,
        },
      });
    } else {
      if (!(await this.settings.get()).allowSignups) throw new ForbiddenException('Registration is currently closed');
      user = await this.prisma.user.create({
        data: { email: profile.email, name: profile.name, googleId: profile.googleId, avatarUrl: profile.picture, role: 'ORGANIZER' },
      });
    }
    return this.session(user, meta);
  }

  refresh(refreshToken: string, meta: SessionMeta): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken, meta);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return userDto(user, this.storage);
  }
}
