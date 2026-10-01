import { Logger } from '@nestjs/common';
import sharp from 'sharp';

// The wall shows photos in columns about 300 px wide; 640 px stays sharp on retina and big screens.
const THUMB_SIDE = 640;

// Free hosting has ~512 MB of RAM: no libvips cache, one image at a time.
sharp.cache(false);
sharp.concurrency(1);

const log = new Logger('Thumbnail');

/**
 * Small WebP copy of a photo for the wall grid, or null when it isn't worth making one
 * (GIFs may be animated) or the image can't be decoded. The original stays the full-size view.
 */
export async function makeThumbnail(image: Buffer, mime: string): Promise<Buffer | null> {
  if (mime === 'image/gif') return null;
  try {
    return await sharp(image)
      .rotate() // apply EXIF orientation before the metadata is dropped
      .resize(THUMB_SIDE, THUMB_SIDE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
  } catch (err) {
    log.warn(`Could not make a thumbnail: ${(err as Error).message}`);
    return null;
  }
}

/** "events/1/abc.jpg" → "events/1/abc.thumb.webp" */
export const thumbKeyFor = (key: string) => key.replace(/\.[^./]+$/, '') + '.thumb.webp';
