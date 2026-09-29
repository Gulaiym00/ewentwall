import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import type { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { bearerToken, IS_PUBLIC, ROLES, type AppRequest } from './auth.js';

export interface AccessPayload { sub: string; role: UserRole }
export interface GuestPayload { sub: string; eid: string }

/**
 * Global guard: every route needs a valid access token unless marked @Public().
 * The user is re-read from the database on each request, so blocking a user or
 * changing their role in the admin panel takes effect immediately.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const token = bearerToken(req);
    if (!token) throw new UnauthorizedException('Missing access token');

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        audience: 'access',
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (user.status === 'BLOCKED') throw new ForbiddenException('Account is blocked');

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    return true;
  }
}

/** Global guard that enforces @Roles(...). Runs after AccessTokenGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest<AppRequest>().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Not enough permissions');
    return true;
  }
}

async function resolveGuest(
  req: AppRequest,
  jwt: JwtService,
  prisma: PrismaService,
  secret: string,
): Promise<AppRequest['guest']> {
  const token = bearerToken(req);
  if (!token) return undefined;
  try {
    const payload = await jwt.verifyAsync<GuestPayload>(token, { secret, audience: 'guest' });
    const guest = await prisma.guest.findUnique({ where: { id: payload.sub }, select: { id: true, eventId: true, name: true } });
    return guest ?? undefined;
  } catch {
    return undefined;
  }
}

/** Requires a guest token (issued by POST /e/:slug/join). */
@Injectable()
export class GuestTokenGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService, private readonly config: ConfigService<Env, true>) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    req.guest = await resolveGuest(req, this.jwt, this.prisma, this.config.get('JWT_GUEST_SECRET', { infer: true }));
    if (!req.guest) throw new UnauthorizedException('Join the event first');
    return true;
  }
}

/** Attaches the guest when a valid guest token is present, but never blocks the request. */
@Injectable()
export class OptionalGuestGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService, private readonly config: ConfigService<Env, true>) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    req.guest = await resolveGuest(req, this.jwt, this.prisma, this.config.get('JWT_GUEST_SECRET', { infer: true }));
    return true;
  }
}
