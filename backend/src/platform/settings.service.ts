import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Platform-wide settings edited in Admin → Settings. Same shape as the frontend. */
export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultLocale: 'en' | 'ru';
  maxPhotoMb: number;
  maxPerUpload: number;
  retentionMonths: number;
  aiModeration: boolean;
  aiThreshold: number;
  profanityFilter: boolean;
  autoHideReports: number;
  require2fa: boolean;
  sessionHours: number;
  allowSignups: boolean;
  maintenance: boolean;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: 'EventWall',
  supportEmail: 'support@eventwall.com',
  defaultLocale: 'en',
  maxPhotoMb: 15,
  maxPerUpload: 10,
  retentionMonths: 12,
  aiModeration: true,
  aiThreshold: 70,
  profanityFilter: true,
  autoHideReports: 5,
  require2fa: true,
  sessionHours: 12,
  allowSignups: true,
  maintenance: false,
};

const CACHE_MS = 10_000;

@Injectable()
export class SettingsService {
  private cache?: { value: PlatformSettings; at: number };

  constructor(private readonly prisma: PrismaService) {}

  /** Read often (every upload/sign-up), so it is cached for a few seconds. */
  async get(): Promise<PlatformSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const row = await this.prisma.platformSettings.findUnique({ where: { id: 1 } });
    const value = { ...DEFAULT_SETTINGS, ...(row?.data as Partial<PlatformSettings> | undefined) };
    this.cache = { value, at: Date.now() };
    return value;
  }

  /** Saves a partial update and returns the full settings plus the list of changed keys. */
  async update(patch: Partial<PlatformSettings>): Promise<{ settings: PlatformSettings; changed: (keyof PlatformSettings)[] }> {
    const current = await this.get();
    const next = { ...current, ...patch };
    const changed = (Object.keys(patch) as (keyof PlatformSettings)[]).filter(k => patch[k] !== undefined && patch[k] !== current[k]);
    const data = next as unknown as Prisma.InputJsonValue;
    await this.prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, data }, update: { data } });
    this.cache = { value: next, at: Date.now() };
    return { settings: next, changed };
  }
}
