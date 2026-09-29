import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Env } from '../config/env.js';
import { clientIp, CurrentUser, Public, type AuthUser } from '../common/auth.js';
import { LoginDto, RefreshDto, RegisterDto } from './auth.dto.js';
import { AuthService, type SessionMeta } from './auth.service.js';
import { GoogleService } from './google.service.js';

const STATE_COOKIE = 'g_state';
const meta = (req: Request): SessionMeta => ({ userAgent: req.headers['user-agent'], ip: clientIp(req) });

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

const sameString = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

@ApiTags('auth')
@Controller('auth')
// Brute-force protection: at most 10 auth requests per minute per IP.
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an organizer account' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, meta(req));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with email and password' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, meta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair (the old one stops working)' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, meta(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a refresh token (sign out on this device)' })
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Get('google/status')
  @ApiOperation({ summary: 'Whether Google sign-in is configured (to show or hide the button)' })
  googleStatus() {
    return { enabled: this.google.enabled };
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Start Google sign-in (redirects to Google)' })
  googleStart(@Res() res: Response) {
    const state = randomBytes(24).toString('base64url');
    const url = this.google.authorizeUrl(state);
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      maxAge: 10 * 60_000,
      path: '/api/auth/google',
    });
    res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google redirects here; we redirect to the frontend with tokens in the URL fragment' })
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response) {
    const frontend = this.config.get('FRONTEND_URL', { infer: true });
    const expected = readCookie(req, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, { path: '/api/auth/google' });

    try {
      // The state must match the cookie set when this browser started the flow (CSRF protection).
      if (!code || !state || !expected || !sameString(state, expected)) throw new Error('Invalid sign-in state, please try again');
      const result = await this.auth.googleSignIn(await this.google.exchange(code), meta(req));
      // Tokens go in the fragment: it is never sent to servers or written to access logs.
      const fragment = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: String(result.expiresIn),
      });
      res.redirect(`${frontend}/auth/callback#${fragment}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      res.redirect(`${frontend}/login?error=${encodeURIComponent(message)}`);
    }
  }
}
