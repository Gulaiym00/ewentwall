// Validates process.env once at startup (ConfigModule `validate`), so a missing
// secret fails fast with a clear message instead of at the first request.

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
  STORAGE_DRIVER: 'local';
  UPLOAD_DIR: string;
  STORAGE_QUOTA_GB: number;
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
  const env: Env = {
    NODE_ENV: (['development', 'production', 'test'].includes(nodeEnv) ? nodeEnv : 'development') as Env['NODE_ENV'],
    PORT: int('PORT', 8000),
    FRONTEND_URL: str('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, ''),
    CORS_ORIGINS: str('CORS_ORIGINS', '').split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean),
    API_URL: str('API_URL', 'http://localhost:8000').replace(/\/$/, ''),
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
    UPLOAD_DIR: str('UPLOAD_DIR', './uploads'),
    STORAGE_QUOTA_GB: int('STORAGE_QUOTA_GB', 1000),
  };

  const driver = str('STORAGE_DRIVER', 'local');
  if (driver !== 'local') errors.push(`STORAGE_DRIVER "${driver}" is not supported yet (only "local")`);

  if (errors.length) throw new Error(`Invalid environment:\n  - ${errors.join('\n  - ')}\nSee backend/.env.example`);
  return env;
}
