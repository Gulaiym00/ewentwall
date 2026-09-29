import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

interface GoogleProfile { googleId: string; email: string; name: string; picture?: string }

/**
 * Google sign-in (OAuth 2.0 authorization code flow) without passport:
 * GET /auth/google → Google consent screen → GET /auth/google/callback.
 */
@Injectable()
export class GoogleService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return !!(this.config.get('GOOGLE_CLIENT_ID', { infer: true }) && this.config.get('GOOGLE_CLIENT_SECRET', { infer: true }));
  }

  private get redirectUri() {
    return `${this.config.get('API_URL', { infer: true })}/api/auth/google/callback`;
  }

  private assertEnabled() {
    if (!this.enabled) throw new ServiceUnavailableException('Google sign-in is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
  }

  authorizeUrl(state: string): string {
    this.assertEnabled();
    const params = new URLSearchParams({
      client_id: this.config.get('GOOGLE_CLIENT_ID', { infer: true })!,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchange(code: string): Promise<GoogleProfile> {
    this.assertEnabled();
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.get('GOOGLE_CLIENT_ID', { infer: true })!,
        client_secret: this.config.get('GOOGLE_CLIENT_SECRET', { infer: true })!,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new UnauthorizedException('Google sign-in failed');
    const { access_token } = (await tokenRes.json()) as { access_token?: string };

    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new UnauthorizedException('Google sign-in failed');
    const info = (await infoRes.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

    // Only trust addresses Google has verified — they are used to link existing accounts.
    if (!info.email || !info.email_verified) throw new UnauthorizedException('Your Google email is not verified');
    return {
      googleId: info.sub,
      email: info.email.toLowerCase(),
      name: info.name ?? info.email.split('@')[0],
      picture: info.picture,
    };
  }
}
