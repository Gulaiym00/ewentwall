'use client';

import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/client';
import { eventsApi } from '@/api/events';
import type { OrganizerEvent } from '@/api/types';
import { useToast } from '@/components/Toast';
import { Button, Modal } from '@/ui';
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

/** QR image of the event as an object URL (the endpoint needs the organizer's token). */
export function useEventQr(id: string | undefined) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let url: string | null = null;
    let alive = true;
    eventsApi.qrImage(id).then(u => { url = u; if (alive) setQrUrl(u); }, () => undefined);
    return () => { alive = false; setQrUrl(null); if (url) URL.revokeObjectURL(url); };
  }, [id]);
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

/** "Share photo": sends the poster image through the phone's share sheet, or saves it where sharing files isn't supported. */
export function useShareQrPoster() {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const share = async (event: QrEvent, qrUrl: string | null) => {
    if (!qrUrl || busy) return;
    setBusy(true);
    try {
      const blob = await renderPoster(event, qrUrl, t);
      const file = new File([blob], `${event.slug}-qr.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: event.name, text: `${tagline(t)}: ${event.joinUrl}` });
        } catch { /* cancelled */ }
      } else {
        const href = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href, download: file.name }).click();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
        toast(t('Image saved — share it with your guests', 'Картинка сохранена — отправьте её гостям'), 'success');
      }
    } catch (err) {
      toast(errorMessage(err), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return { share, busy };
}

/** Quick access to an event's QR from the event lists. */
export function EventQrModal({ event, onClose }: { event: QrEvent | null; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const qrUrl = useEventQr(event?.id);
  const { share, busy } = useShareQrPoster();
  if (!event) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(event.joinUrl);
      toast(t('Link copied', 'Ссылка скопирована'), 'success');
    } catch {
      toast(t('Copy failed — select the link and copy it manually', 'Не удалось скопировать — выделите ссылку и скопируйте вручную'), 'danger');
    }
  };

  return (
    <Modal open onClose={onClose} title={t('Event QR code', 'QR-код события')}
      footer={<>
        <Button icon="external" onClick={copy}>{t('Copy link', 'Скопировать ссылку')}</Button>
        <Button variant="primary" icon="share" disabled={!qrUrl || busy} onClick={() => share(event, qrUrl)}>
          {busy ? t('Preparing…', 'Готовим…') : t('Share photo', 'Поделиться фото')}
        </Button>
      </>}>
      <QrPoster event={event} qrUrl={qrUrl} />
      <p className="mt-3 truncate text-center text-xs text-muted" title={event.joinUrl}>{event.joinUrl}</p>
    </Modal>
  );
}
