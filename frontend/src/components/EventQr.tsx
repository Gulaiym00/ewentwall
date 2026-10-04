'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import type { OrganizerEvent } from '@/api/types';
import { useToast } from '@/components/Toast';
import { Button, Modal } from '@/ui';
import { Icon } from '@/ui/icons';
import { Spinner } from '@/ui/loader';
import { formatLongDate } from '@/utils/format';
import { eventTypeLabel } from '@/utils/labels';
import { useT, type Translate } from '@/utils/locale';

// Every event has its own slug, so its QR (and this poster) is unique to it.

type QrEvent = Pick<OrganizerEvent, 'id' | 'slug' | 'name' | 'type' | 'startsAt' | 'joinUrl'>;

const ACCENT = '#E11D48';
const ACCENT_DARK = '#9F1239';

const TYPE_EMOJI: Record<string, string> = {
  Wedding: '💍', Birthday: '🎂', Corporate: '💼', Concert: '🎤', Anniversary: '🥂', Party: '🎉', 'Private Party': '🎉',
  Private: '🎉', Conference: '🎙️', Graduation: '🎓', Other: '✨',
};

const typeTitle = (t: Translate, type: string) => `${TYPE_EMOJI[type] ?? '✨'} ${eventTypeLabel(t, type)}`;
const tagline = (t: Translate) => t('Share the moments', 'Поделитесь моментами');
const scanHint = (t: Translate) => t('Scan with your phone camera', 'Наведите камеру телефона на QR-код');

const QR_OPTIONS = { margin: 2, errorCorrectionLevel: 'M' as const, color: { dark: '#111111', light: '#ffffff' } };

/** QR of the guest link, drawn in the browser: no API round trip, so it shows even while the server wakes up. */
export function qrDataUrl(joinUrl: string, format: 'png' | 'svg' = 'png'): Promise<string> {
  if (format === 'svg') {
    return QRCode.toString(joinUrl, { ...QR_OPTIONS, type: 'svg' })
      .then(svg => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  }
  return QRCode.toDataURL(joinUrl, { ...QR_OPTIONS, width: 1024 });
}

/** Saves the plain QR (for printing) as a PNG or SVG file. */
async function downloadQr(event: QrEvent, format: 'png' | 'svg') {
  const href = await qrDataUrl(event.joinUrl, format);
  Object.assign(document.createElement('a'), { href, download: `${event.slug}-qr.${format}` }).click();
}

/** QR image of the event's guest link as a data URL. */
export function useEventQr(joinUrl: string | undefined) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!joinUrl) return;
    let alive = true;
    qrDataUrl(joinUrl).then(u => { if (alive) setQrUrl(u); }, () => undefined);
    return () => { alive = false; setQrUrl(null); };
  }, [joinUrl]);
  return qrUrl;
}

/** The printable card: event type, name, QR and "Share the moments". Always light so the QR scans. */
export function QrPoster({ event, qrUrl }: { event: QrEvent; qrUrl: string | null }) {
  const t = useT();
  return (
    <div style={{ width: '100%', maxWidth: 340, margin: '0 auto', borderRadius: 24, overflow: 'hidden', background: '#fff', color: '#111', boxShadow: '0 18px 50px rgba(17,17,17,0.14)', border: '1px solid rgba(17,17,17,0.06)', textAlign: 'center' }}>
      <div style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, padding: '22px 22px 92px', color: '#fff' }}>
        <span style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 100, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {typeTitle(t, event.type)}
        </span>
        <p className="font-serif" style={{ margin: '12px 0 0', fontSize: 24, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{event.name}</p>
        {event.startsAt && <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.85 }}>{formatLongDate(event.startsAt)}</p>}
      </div>
      <div style={{ margin: '-76px auto 0', width: 200, height: 200, padding: 10, background: '#fff', borderRadius: 18, boxShadow: '0 10px 30px rgba(17,17,17,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {qrUrl
          ? <img src={qrUrl} alt={t(`QR code for ${event.name}`, `QR-код: ${event.name}`)} width={180} height={180} style={{ display: 'block' }} />
          : <Spinner />}
      </div>
      <div style={{ padding: '18px 20px 20px' }}>
        <p className="font-serif" style={{ margin: 0, fontSize: 22, fontWeight: 700, color: ACCENT, letterSpacing: '-0.01em' }}>{tagline(t)}</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b6b6b' }}>{scanHint(t)}</p>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed rgba(17,17,17,0.12)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#111' }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, background: ACCENT, display: 'inline-block' }} /> EventWall
        </div>
      </div>
    </div>
  );
}

// ─── Image version of the poster (for sharing / saving) ─────────────────────

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

async function renderPoster(event: QrEvent, qrUrl: string, t: Translate): Promise<Blob> {
  await document.fonts?.ready;
  const css = getComputedStyle(document.documentElement);
  const serif = `${css.getPropertyValue('--font-playfair').trim() || 'Georgia'}, Georgia, serif`;
  const sans = `${css.getPropertyValue('--font-inter').trim() || 'system-ui'}, system-ui, sans-serif`;

  const qr = new Image();
  qr.src = qrUrl;
  await qr.decode();

  const W = 1080, H = 1500, BAND = 640, QR = 600, PAD = 40;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, W, BAND);
  grad.addColorStop(0, ACCENT);
  grad.addColorStop(1, ACCENT_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, BAND);

  // Event type pill
  ctx.font = `700 34px ${sans}`;
  const pill = typeTitle(t, event.type).toUpperCase();
  const pillW = ctx.measureText(pill).width + 64;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, (W - pillW) / 2, 70, pillW, 64, 32);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(pill, W / 2, 114);

  // Event name
  ctx.font = `700 76px ${serif}`;
  const nameLines = wrap(ctx, event.name, W - 160, 2);
  nameLines.forEach((l, i) => ctx.fillText(l, W / 2, 230 + i * 88));
  if (event.startsAt) {
    ctx.font = `500 34px ${sans}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(formatLongDate(event.startsAt), W / 2, 230 + nameLines.length * 88 + 8);
  }

  // QR card overlapping the band
  const cardX = (W - QR - PAD * 2) / 2, cardY = BAND - 220;
  ctx.save();
  ctx.shadowColor = 'rgba(17,17,17,0.18)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#fff';
  roundRect(ctx, cardX, cardY, QR + PAD * 2, QR + PAD * 2, 48);
  ctx.fill();
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, cardX + PAD, cardY + PAD, QR, QR);

  // Tagline
  const textY = cardY + QR + PAD * 2 + 110;
  ctx.fillStyle = ACCENT;
  ctx.font = `700 72px ${serif}`;
  ctx.fillText(tagline(t), W / 2, textY);
  ctx.fillStyle = '#6b6b6b';
  ctx.font = `500 34px ${sans}`;
  ctx.fillText(scanHint(t), W / 2, textY + 60);

  // Footer: link + brand
  ctx.font = `500 28px ${sans}`;
  ctx.fillStyle = '#9a9a9a';
  ctx.fillText(wrap(ctx, event.joinUrl.replace(/^https?:\/\//, ''), W - 160, 1)[0], W / 2, H - 110);
  ctx.font = `700 34px ${sans}`;
  ctx.fillStyle = '#111';
  const brandW = ctx.measureText('EventWall').width;
  ctx.fillText('EventWall', W / 2 + 22, H - 56);
  ctx.fillStyle = ACCENT;
  roundRect(ctx, W / 2 - brandW / 2 - 22, H - 82, 30, 30, 8);
  ctx.fill();

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render the image'))), 'image/png'));
}

/** Copies text; falls back to a hidden textarea where the Clipboard API is blocked (in-app browsers, older phones). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* not supported */ }
    area.remove();
    return ok;
  }
}

function saveFile(file: File) {
  const href = URL.createObjectURL(file);
  Object.assign(document.createElement('a'), { href, download: file.name }).click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/**
 * The poster as a PNG, rendered as soon as the QR is loaded. Phones only open the share
 * sheet right after a tap, so the image must be ready before "Share photo" is pressed.
 */
export function useQrPoster(event: QrEvent | null, qrUrl: string | null) {
  const t = useT();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!event || !qrUrl) return;
    let alive = true;
    renderPoster(event, qrUrl, t)
      .then(blob => { if (alive) setFile(new File([blob], `${event.slug}-qr.png`, { type: 'image/png' })); })
      .catch(() => undefined);
    return () => { alive = false; setFile(null); };
  }, [event, qrUrl, t]);

  const share = async () => {
    if (!event || !file) return;
    const text = `${tagline(t)}: ${event.joinUrl}`;
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: event.name, text });
      // Browsers that can't share images still share the link instead of silently downloading
      else if (navigator.share) await navigator.share({ title: event.name, text, url: event.joinUrl });
      else {
        saveFile(file);
        toast(t('Sharing isn’t supported here — the image was saved instead', 'Здесь нельзя поделиться — картинка сохранена'), 'success');
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return; // closed the share sheet
      toast(t('Could not open sharing — try “Download photo”', 'Не удалось открыть «Поделиться» — попробуйте «Скачать фото»'), 'danger');
    }
  };

  const download = () => {
    if (!file) return;
    saveFile(file);
  };

  return { ready: !!file, share, download };
}

/**
 * Share / download / copy buttons under a QR. "Download" opens a format choice:
 * the poster (PNG) or the plain QR as PNG or SVG.
 */
export function QrActions({ event, qrUrl, onCopy }: { event: QrEvent; qrUrl: string | null; onCopy: () => void }) {
  const t = useT();
  const poster = useQrPoster(event, qrUrl);
  const [formatsOpen, setFormatsOpen] = useState(false);

  const formats: { label: string; hint: string; ext: string; disabled?: boolean; save: () => void }[] = [
    { label: t('Poster', 'Постер'), hint: t('QR with the event name and date', 'QR с названием и датой события'), ext: 'PNG', disabled: !poster.ready, save: poster.download },
    { label: t('QR code only', 'Только QR-код'), hint: t('Image for messengers and sites', 'Картинка для мессенджеров и сайтов'), ext: 'PNG', save: () => downloadQr(event, 'png') },
    { label: t('QR code only', 'Только QR-код'), hint: t('Vector — prints sharp at any size', 'Вектор — чёткая печать любого размера'), ext: 'SVG', save: () => downloadQr(event, 'svg') },
  ];

  return (
    <div className="mt-4 space-y-2">
      <Button variant="primary" className="w-full" icon="share" disabled={!poster.ready} onClick={poster.share}>
        {poster.ready ? t('Share photo', 'Поделиться фото') : t('Preparing…', 'Готовим…')}
      </Button>
      <Button className="w-full" icon="download" aria-expanded={formatsOpen} onClick={() => setFormatsOpen(v => !v)}>
        {t('Download', 'Скачать')}
        <Icon name="chevronDown" size={16} className={formatsOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </Button>
      {formatsOpen && (
        <div className="overflow-hidden rounded-xl border border-line">
          {formats.map(f => (
            <button key={f.label + f.ext} type="button" disabled={f.disabled} onClick={() => { f.save(); setFormatsOpen(false); }}
              className="flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-bg disabled:opacity-50">
              <span className="w-11 shrink-0 rounded-md bg-accent/10 py-1 text-center text-xs font-bold text-accent">{f.ext}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{f.label}</span>
                <span className="block text-xs text-muted">{f.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <Button className="w-full" icon="external" onClick={onCopy}>{t('Copy link', 'Скопировать ссылку')}</Button>
    </div>
  );
}

/** Quick access to an event's QR from the event lists. */
export function EventQrModal({ event, onClose }: { event: QrEvent | null; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const qrUrl = useEventQr(event?.joinUrl);
  if (!event) return null;

  const copy = async () => {
    if (await copyText(event.joinUrl)) toast(t('Link copied', 'Ссылка скопирована'), 'success');
    else toast(t('Copy failed — tap the link below to select it', 'Не удалось скопировать — нажмите на ссылку ниже, чтобы выделить её'), 'danger');
  };

  return (
    <Modal open onClose={onClose} title={t('Event QR code', 'QR-код события')}>
      <QrPoster event={event} qrUrl={qrUrl} />
      <p className="mt-3 text-center text-xs break-all text-muted select-all">{event.joinUrl}</p>
      <div className="mx-auto max-w-[340px] pb-2"><QrActions event={event} qrUrl={qrUrl} onCopy={copy} /></div>
    </Modal>
  );
}
