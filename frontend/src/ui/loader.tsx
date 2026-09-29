'use client';

import { cx } from '@/utils/cx';
import { useT } from '@/utils/locale';

export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" className={cx('spin', className)} aria-hidden="true">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

/** Centered spinner for whole screens (session check, first data load). */
export function PageLoader({ label, fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  const t = useT();
  return (
    <div role="status" className={cx('flex flex-col items-center justify-center gap-3 text-muted', fullScreen ? 'min-h-screen' : 'py-24')}>
      <Spinner />
      <p className="text-sm font-medium">{label ?? t('Loading…', 'Загрузка…')}</p>
    </div>
  );
}

/** Inline error with a retry button. */
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
      <p className="font-semibold">{t('Couldn’t load this', 'Не удалось загрузить')}</p>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-press mt-1 h-9 rounded-[10px] border border-line px-4 text-sm font-semibold hover:bg-bg">
          {t('Try again', 'Повторить')}
        </button>
      )}
    </div>
  );
}
