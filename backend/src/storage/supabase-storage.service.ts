import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { StorageService } from './storage.service.js';

/**
 * Stores files in a public Supabase Storage bucket (STORAGE_DRIVER=supabase).
 * Used in production, where the server's disk is not persistent.
 * Talks to the Storage REST API with the service-role key, so no extra dependency is needed.
 */
@Injectable()
export class SupabaseStorageService extends StorageService implements OnModuleInit {
  private readonly log = new Logger(SupabaseStorageService.name);
  private readonly api: string;
  private readonly bucket: string;
  private readonly key: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.api = `${config.get('SUPABASE_URL', { infer: true })}/storage/v1`;
    this.bucket = config.get('SUPABASE_BUCKET', { infer: true });
    this.key = config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }) ?? '';
  }

  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.key}`, apikey: this.key, ...extra };
  }

  /** Creates the public bucket on first start; an existing bucket is left as is. */
  async onModuleInit() {
    const res = await fetch(`${this.api}/bucket`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: this.bucket, name: this.bucket, public: true }),
    });
    if (res.ok) this.log.log(`Created public bucket "${this.bucket}"`);
    else if (res.status !== 400 && res.status !== 409) {
      this.log.warn(`Could not check bucket "${this.bucket}": ${res.status} ${await res.text()}`);
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const res = await fetch(`${this.api}/object/${this.bucket}/${key}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': contentType, 'Cache-Control': 'max-age=2592000', 'x-upsert': 'true' }),
      body: new Uint8Array(body),
    });
    if (!res.ok) throw new Error(`Storage upload failed: ${res.status} ${await res.text()}`);
  }

  async delete(key: string): Promise<void> {
    await this.deleteMany([key]);
  }

  override async deleteMany(keys: string[]): Promise<void> {
    if (!keys.length) return;
    const res = await fetch(`${this.api}/object/${this.bucket}`, {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: keys }),
    });
    if (!res.ok) this.log.warn(`Storage delete failed: ${res.status} ${await res.text()}`);
  }

  url(key: string): string {
    return `${this.api}/object/public/${this.bucket}/${key}`;
  }
}
