import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Env } from '../config/env.js';
import type { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessPayload, GuestPayload } from '../common/guards.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

interface SessionMeta { userAgent?: string; ip?: string }

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

function ttlSeconds(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 900;
  return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd'];
}

/**
 * Access tokens: short-lived JWTs sent as `Authorization: Bearer`.
 * Refresh tokens: random opaque strings, stored only as SHA-256 hashes and rotated
 * on every refresh. Presenting an already-rotated token means it was stolen, so the
 * whole session family is revoked.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get accessTtl() { return this.config.get('ACCESS_TOKEN_TTL', { infer: true }); }
  private get refreshTtlMs() { return this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400_000; }

  private async signAccess(userId: string, role: UserRole): Promise<string> {
    const payload: AccessPayload = { sub: userId, role };
    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: ttlSeconds(this.accessTtl),
      audience: 'access',
    });
  }

  private async createRefresh(userId: string, familyId: string, meta: SessionMeta): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId, familyId, tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        userAgent: meta.userAgent?.slice(0, 300), ip: meta.ip,
      },
    });
    return token;
  }

  /** New session (login, register, Google sign-in). */
  async issue(user: { id: string; role: UserRole }, meta: SessionMeta = {}): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccess(user.id, user.role),
      this.createRefresh(user.id, randomUUID(), meta),
    ]);
    return { accessToken, refreshToken, expiresIn: ttlSeconds(this.accessTtl) };
  }

  /** Exchanges a refresh token for a new pair (rotation with reuse detection). */
  async rotate(refreshToken: string, meta: SessionMeta = {}): Promise<TokenPair> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: { select: { id: true, role: true, status: true } } },
    });
    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    if (stored.revokedAt) {
      // Reuse of a rotated token: assume theft and end every session in this family.
      await this.prisma.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Refresh token was already used — please sign in again');
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Session expired — please sign in again');
    if (stored.user.status === 'BLOCKED') throw new UnauthorizedException('Account is blocked');

    // Revoke only if still active, so two parallel refreshes can't both succeed.
    const { count } = await this.prisma.refreshToken.updateMany({ where: { id: stored.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (count === 0) throw new UnauthorizedException('Refresh token was already used — please sign in again');

    const [accessToken, newRefresh] = await Promise.all([
      this.signAccess(stored.user.id, stored.user.role),
      this.createRefresh(stored.user.id, stored.familyId, meta),
    ]);
    return { accessToken, refreshToken: newRefresh, expiresIn: ttlSeconds(this.accessTtl) };
  }

  /** Sign out of this device. Unknown tokens are ignored so logout is idempotent. */
  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Sign out everywhere (password change, block, delete). */
  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Guest token payload, or null if invalid/expired (for places without the guard, e.g. SSE ?token=). */
  async verifyGuest(token: string): Promise<GuestPayload | null> {
    try {
      return await this.jwt.verifyAsync<GuestPayload>(token, { secret: this.config.get('JWT_GUEST_SECRET', { infer: true }), audience: 'guest' });
    } catch {
      return null;
    }
  }

  signGuest(guestId: string, eventId: string): Promise<string> {
    const payload: GuestPayload = { sub: guestId, eid: eventId };
    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_GUEST_SECRET', { infer: true }),
      expiresIn: this.config.get('GUEST_TOKEN_TTL_DAYS', { infer: true }) * 86_400,
      audience: 'guest',
    });
  }
}
