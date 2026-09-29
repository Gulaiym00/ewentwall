// Phone photos are 3–12 MB; the wall only needs a couple of megapixels. Shrinking them
// on the phone before upload saves the guest's mobile data and makes the wall load faster.

const MAX_SIDE = 2048;
const QUALITY = 0.85;
const SMALL_ENOUGH = 600 * 1024; // already small: leave as is

/** Returns a smaller JPEG of the photo, or the original file if shrinking can't help. */
export async function compressImage(file: File): Promise<File> {
  // GIFs may be animated; small files are not worth re-encoding.
  if (file.type === 'image/gif' || file.size <= SMALL_ENOUGH) return file;

  let bitmap: ImageBitmap;
  try {
    // 'from-image' applies the EXIF rotation, so portrait shots stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // a format the browser can't decode (e.g. HEIC on Android): upload as is
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); return file; }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob || blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]*$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
}
