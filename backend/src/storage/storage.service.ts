import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/**
 * File storage used for photos, covers and avatars.
 * Implementations: LocalStorageService (disk). An S3/R2/Supabase Storage driver
 * only needs to implement these three methods and be selected in storage.module.ts.
 */
export abstract class StorageService {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract delete(key: string): Promise<void>;
  /** Public URL a browser can load the file from. */
  abstract url(key: string): string;

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.allSettled(keys.map(k => this.delete(k)));
  }
}

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', ext: 'jpg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', test: b => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
  { mime: 'image/gif', ext: 'gif', test: b => b.subarray(0, 4).toString('ascii') === 'GIF8' },
];

/**
 * Detects the real image type from the file's first bytes (the client-sent
 * Content-Type can't be trusted) and builds a unique storage key.
 */
export function imageKey(prefix: string, file: { buffer: Buffer; size: number }, maxMb: number): { key: string; mime: string } {
  if (file.size > maxMb * 1024 * 1024) throw new BadRequestException(`Each image must be under ${maxMb} MB`);
  const type = SIGNATURES.find(s => s.test(file.buffer));
  if (!type) throw new BadRequestException('Only JPEG, PNG, WebP and GIF images are supported');
  return { key: `${prefix}/${randomUUID()}.${type.ext}`, mime: type.mime };
}
