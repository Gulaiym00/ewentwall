// Validates process.env once at startup (ConfigModule `validate`), so a missing
// secret fails fast with a clear message instead of at the first request.

import { networkInterfaces } from 'node:os';

export interface Env {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  FRONTEND_URL: string;
  /** Extra origins allowed by CORS (FRONTEND_URL is always allowed). */
  CORS_ORIGINS: string[];
  API_URL: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_GUEST_SECRET: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL_DAYS: number;
  GUEST_TOKEN_TTL_DAYS: number;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  STORAGE_DRIVER: 'local' | 'supabase';
  UPLOAD_DIR: string;
  STORAGE_QUOTA_GB: number;
  /** Supabase Storage (STORAGE_DRIVER=supabase): project URL, service-role key and a public bucket. */
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_BUCKET: string;
  /** Outgoing email (Admin → Support → Email). Off unless SMTP_USER and SMTP_PASS are set. */
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  MAIL_FROM?: string;
}

/** This computer's LAN IPv4 (home Wi-Fi first), for FRONTEND_URL/API_URL=auto in local development. */
export function lanAddress(): string {
  const ips = Object.values(networkInterfaces()).flat()
    .filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a!.address);
  return ips.find(ip => ip.startsWith('192.168.')) ?? ips.find(ip => ip.startsWith('10.')) ?? ips[0] ?? 'localhost';
}

const WEAK_SECRETS = new Set(['', 'change-me', 'secret', 'changeme']);

export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];
  const str = (key: string, fallback?: string): string => {
    const v = raw[key];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
    if (fallback !== undefined) return fallback;
    errors.push(`${key} is required`);
    return '';
  };
  const int = (key: string, fallback: number): number => {
    const v = raw[key];
    if (v === undefined || v === '') return fallback;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) errors.push(`${key} must be a positive integer`);
    return n;
  };
  const secret = (key: string): string => {
    const v = str(key);
    if (v && (WEAK_SECRETS.has(v) || v.length < 32)) errors.push(`${key} must be a random string of at least 32 characters`);
    return v;
  };

  const nodeEnv = str('NODE_ENV', 'development');
  const port = int('PORT', 8000);
  // "auto": http://<LAN IP>:<port>, so QR links and photo URLs follow the computer's current IP.
  const url = (key: string, fallback: string, autoPort: number) => {
    const v = str(key, fallback).replace(/\/$/, '');
    return v === 'auto' ? `http://${lanAddress()}:${autoPort}` : v;
  };
  const env: Env = {
    NODE_ENV: (['development', 'production', 'test'].includes(nodeEnv) ? nodeEnv : 'development') as Env['NODE_ENV'],
    PORT: port,
    FRONTEND_URL: url('FRONTEND_URL', 'http://localhost:3000', 3000),
    CORS_ORIGINS: str('CORS_ORIGINS', '').split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean),
    API_URL: url('API_URL', 'http://localhost:8000', port),
    DATABASE_URL: str('DATABASE_URL'),
    JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
    JWT_GUEST_SECRET: secret('JWT_GUEST_SECRET'),
    ACCESS_TOKEN_TTL: str('ACCESS_TOKEN_TTL', '15m'),
    REFRESH_TOKEN_TTL_DAYS: int('REFRESH_TOKEN_TTL_DAYS', 30),
    GUEST_TOKEN_TTL_DAYS: int('GUEST_TOKEN_TTL_DAYS', 30),
    GOOGLE_CLIENT_ID: str('GOOGLE_CLIENT_ID', '') || undefined,
    GOOGLE_CLIENT_SECRET: str('GOOGLE_CLIENT_SECRET', '') || undefined,
    STORAGE_DRIVER: 'local',
    SUPABASE_URL: str('SUPABASE_URL', '').replace(/\/$/, '') || undefined,
    SUPABASE_SERVICE_ROLE_KEY: str('SUPABASE_SERVICE_ROLE_KEY', '') || undefined,
    SUPABASE_BUCKET: str('SUPABASE_BUCKET', 'photos'),
    UPLOAD_DIR: str('UPLOAD_DIR', './uploads'),
    STORAGE_QUOTA_GB: int('STORAGE_QUOTA_GB', 1000),
    SMTP_HOST: str('SMTP_HOST', 'smtp.gmail.com'),
    SMTP_PORT: int('SMTP_PORT', 465),
    SMTP_USER: str('SMTP_USER', '') || undefined,
    // Gmail shows app passwords in groups of four; the spaces are not part of it.
    SMTP_PASS: str('SMTP_PASS', '').replace(/\s/g, '') || undefined,
    MAIL_FROM: str('MAIL_FROM', '') || undefined,
  };

  const driver = str('STORAGE_DRIVER', 'local');
  if (driver === 'supabase') {
    env.STORAGE_DRIVER = 'supabase';
    if (!env.SUPABASE_URL) errors.push('SUPABASE_URL is required when STORAGE_DRIVER=supabase');
    if (!env.SUPABASE_SERVICE_ROLE_KEY) errors.push('SUPABASE_SERVICE_ROLE_KEY is required when STORAGE_DRIVER=supabase');
  } else if (driver !== 'local') errors.push(`STORAGE_DRIVER "${driver}" is not supported (use "local" or "supabase")`);

  if (errors.length) throw new Error(`Invalid environment:\n  - ${errors.join('\n  - ')}\nSee backend/.env.example`);
  return env;
}
