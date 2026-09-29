import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Env } from '../config/env.js';
import { StorageService } from './storage.service.js';

/** Stores files on disk under UPLOAD_DIR; main.ts serves them at {API_URL}/uploads. */
@Injectable()
export class LocalStorageService extends StorageService {
  readonly root: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.root = resolve(config.get('UPLOAD_DIR', { infer: true }));
    this.baseUrl = `${config.get('API_URL', { infer: true })}/uploads`;
  }

  private path(key: string): string {
    const full = resolve(this.root, key);
    // Keys are generated server-side, but never let one escape the upload folder.
    if (!full.startsWith(this.root + sep)) throw new Error(`Invalid storage key: ${key}`);
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const full = this.path(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, body);
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  url(key: string): string {
    return `${this.baseUrl}/${key}`;
  }
}
