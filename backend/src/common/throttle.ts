import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard, type ThrottlerModuleOptions, type ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Env } from '../config/env.js';
import { bearerToken, clientIp } from './auth.js';

/** Rate-limit by IP only: for sign-in, where a token must not buy extra attempts. */
export const byIp = (req: Record<string, unknown>) => Promise.resolve(clientIp(req as unknown as Request) ?? 'unknown');

/**
 * Rate limits count per signed-in user or guest when the request carries a valid token, otherwise per IP.
 * At an event every guest on the venue Wi-Fi shares one public IP, so per-IP limits alone would make
 * the whole room share one budget of uploads and reactions. Tokens are verified, so they can't be made up.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {
    super(options, storage, reflector);
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const token = bearerToken(req as unknown as Request);
    if (token) {
      for (const [audience, secret] of [['guest', 'JWT_GUEST_SECRET'], ['access', 'JWT_ACCESS_SECRET']] as const) {
        try {
          const { sub } = await this.jwt.verifyAsync<{ sub: string }>(token, { secret: this.config.get(secret, { infer: true }), audience });
          return `${audience}:${sub}`;
        } catch { /* not this kind of token */ }
      }
    }
    return byIp(req);
  }
}
