import { createParamDecorator, ExecutionContext, SetMetadata, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/client.js';

/** Signed-in organizer or admin, attached to the request by AccessTokenGuard. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/** Anonymous guest who joined an event through its QR link (GuestTokenGuard). */
export interface AuthGuest {
  id: string;
  eventId: string;
  name: string | null;
}

export type AppRequest = Request & { user?: AuthUser; guest?: AuthGuest };

export const IS_PUBLIC = 'isPublic';
/** Skip the global access-token check (landing content, guest endpoints, login…). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** Restrict a route to these roles, e.g. `@Roles('ADMIN')`. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AppRequest>().user;
  if (!user) throw new UnauthorizedException();
  return user;
});

export const CurrentGuest = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthGuest => {
  const guest = ctx.switchToHttp().getRequest<AppRequest>().guest;
  if (!guest) throw new UnauthorizedException('Join the event first');
  return guest;
});

/** Guest if a valid guest token was sent, otherwise undefined (for optional personalisation). */
export const OptionalGuest = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthGuest | undefined => ctx.switchToHttp().getRequest<AppRequest>().guest,
);

export function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

export function clientIp(req: Request): string | undefined {
  return req.ip ?? req.socket.remoteAddress ?? undefined;
}
