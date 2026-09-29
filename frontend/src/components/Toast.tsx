'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Icon } from '@/ui/icons';
import { cx } from '@/utils/cx';

type Tone = 'success' | 'danger';
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

/** Show a short confirmation message: `const toast = useToast(); toast('Saved')`. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, tone: Tone = 'success') => {
    const id = ++nextId.current;
    setToasts(t => [...t, { id, message, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom)] sm:items-end sm:px-6">
        {toasts.map(t => (
          <div key={t.id} role="status"
            className="notif-slide pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl bg-fg px-4 py-3 text-sm font-semibold text-bg shadow-lg">
            <span className={cx('flex size-5 shrink-0 items-center justify-center rounded-full text-surface', t.tone === 'success' ? 'bg-success' : 'bg-danger')}>
              <Icon name={t.tone === 'success' ? 'check' : 'alert'} size={12} strokeWidth={3} />
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
