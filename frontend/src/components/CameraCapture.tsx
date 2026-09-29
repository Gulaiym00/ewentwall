'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/utils/locale';

// In-browser camera for devices where <input capture> only opens a file dialog (laptops, desktops).
// Needs a secure context (https or localhost); the caller falls back to the file input otherwise.

type Facing = 'user' | 'environment';

export const canUseInAppCamera = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

export default function CameraCapture({ onCapture, onClose, onPickGallery }: {
  onCapture: (file: File) => void;
  onClose: () => void;
  onPickGallery: () => void;
}) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [canSwitch, setCanSwitch] = useState(false);
  const [flash, setFlash] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async stream => {
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        stop();
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) setCanSwitch(devices.filter(d => d.kind === 'videoinput').length > 1);
      })
      .catch((err: DOMException) => {
        if (cancelled) return;
        setError(
          err.name === 'NotAllowedError' || err.name === 'SecurityError'
            ? t('Camera access was blocked. Allow the camera in your browser settings, or choose a photo from the gallery.',
              'Доступ к камере запрещён. Разрешите камеру в настройках браузера или выберите фото из галереи.')
            : err.name === 'NotFoundError' || err.name === 'OverconstrainedError'
              ? t('No camera found on this device. Choose a photo from the gallery instead.',
                'На этом устройстве не найдена камера. Выберите фото из галереи.')
              : t('Could not start the camera. Close other apps that use it and try again.',
                'Не удалось включить камеру. Закройте другие приложения, которые её используют, и попробуйте снова.'),
        );
      });
    return () => { cancelled = true; stop(); };
    // t only changes the error text; re-requesting the camera for it is not needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  const close = useCallback(() => { stop(); onClose(); }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // The selfie preview is mirrored; save the photo the same way the guest saw it.
    if (facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    canvas.toBlob(blob => {
      if (!blob) return;
      stop();
      onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  const circle: React.CSSProperties = {
    width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(8px)',
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t('Camera', 'Камера')}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <video ref={videoRef} playsInline muted autoPlay onLoadedData={() => setReady(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', transform: facing === 'user' ? 'scaleX(-1)' : undefined, opacity: ready ? 1 : 0, transition: 'opacity 200ms' }} />
        {flash && <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.8 }} />}

        {!ready && !error && (
          <p style={{ position: 'absolute', color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: 500 }}>{t('Starting the camera…', 'Включаем камеру…')}</p>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
            <p role="alert" style={{ color: '#fff', fontSize: 16, fontWeight: 500, lineHeight: 1.5, maxWidth: 360, margin: 0 }}>{error}</p>
            <button onClick={() => { close(); onPickGallery(); }}
              style={{ padding: '12px 22px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {t('Choose from gallery', 'Выбрать из галереи')}
            </button>
          </div>
        )}

        <button onClick={close} aria-label={t('Close camera', 'Закрыть камеру')} style={{ ...circle, position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', left: 16 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '20px 28px calc(24px + env(safe-area-inset-bottom))' }}>
        <button onClick={() => { close(); onPickGallery(); }} aria-label={t('Choose from gallery', 'Выбрать из галереи')} style={{ ...circle, justifySelf: 'start' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        <button onClick={shoot} disabled={!ready} aria-label={t('Take photo', 'Сделать снимок')} className="btn-press"
          style={{ width: 76, height: 76, borderRadius: '50%', border: '4px solid #fff', background: ready ? 'var(--accent)' : 'rgba(255,255,255,0.2)', cursor: ready ? 'pointer' : 'default', boxShadow: '0 0 0 4px rgba(0,0,0,0.3)' }} />
        {canSwitch ? (
          <button onClick={() => { setReady(false); setError(''); setFacing(f => (f === 'user' ? 'environment' : 'user')); }} aria-label={t('Switch camera', 'Сменить камеру')} style={{ ...circle, justifySelf: 'end' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 7h-3l-2-3H9L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M9 13.5a3 3 0 0 1 5.2-2"/><polyline points="14.5 9 14.5 11.5 12 11.5"/><path d="M15 12.5a3 3 0 0 1-5.2 2"/><polyline points="9.5 17 9.5 14.5 12 14.5"/></svg>
          </button>
        ) : <span />}
      </div>
    </div>
  );
}
