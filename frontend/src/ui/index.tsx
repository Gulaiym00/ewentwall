'use client';

import { useEffect, useId, useRef } from 'react';
import { Icon, type IconName } from '@/ui/icons';
import { cx } from '@/utils/cx';
import { useT } from '@/utils/locale';


// ─── Layout ──────────────────────────────────────────────────────────────────

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted md:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, padded = true }: { children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={cx('min-w-0 rounded-2xl border border-line bg-surface', padded && 'p-4 md:p-5', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">{title}</h2>
      {action}
    </div>
  );
}

// ─── Controls ────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:opacity-90',
  secondary: 'border border-line bg-surface text-fg hover:bg-bg',
  ghost: 'text-muted hover:bg-bg hover:text-fg',
  danger: 'bg-danger text-white hover:opacity-90',
};

export function Button({ variant = 'secondary', size = 'md', icon, children, className, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md'; icon?: IconName }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'btn-press inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold whitespace-nowrap transition-[background-color,opacity,color] disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        BUTTON_VARIANTS[variant],
        className,
      )}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={cx('inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] text-muted transition-colors hover:bg-bg hover:text-fg disabled:opacity-40', className)}>
      <Icon name={icon} size={17} />
    </button>
  );
}

const FIELD = 'w-full rounded-[10px] border-[1.5px] border-line bg-bg px-3 py-2.5 text-base text-fg outline-none transition-colors placeholder:text-muted focus:border-accent md:text-sm';

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(FIELD, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(FIELD, 'resize-y leading-relaxed', props.className)} />;
}

export function Select({ options, className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...rest} className={cx(FIELD, 'cursor-pointer appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A8A29E' stroke-width='2' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cx('relative min-w-0', className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"><Icon name="search" size={16} /></span>
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className={cx(FIELD, 'pl-9')} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}>
      <span className={cx('absolute top-[3px] size-[18px] rounded-full bg-white shadow transition-[left]', checked ? 'left-[23px]' : 'left-[3px]')} />
    </button>
  );
}

export function SettingRow({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{title}</p>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('no-scroll -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      {tabs.map(t => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cx('flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors',
            value === t.value ? 'bg-fg text-bg' : 'text-muted hover:bg-surface hover:text-fg')}>
          {t.label}
          {t.count !== undefined && (
            <span className={cx('rounded-full px-1.5 text-[11px] leading-[18px]', value === t.value ? 'bg-bg/20' : 'bg-line')}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Display ─────────────────────────────────────────────────────────────────

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const TONES: Record<Tone, string> = {
  neutral: 'bg-line text-muted',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  accent: 'bg-accent-soft text-accent',
};

export function Badge({ tone = 'neutral', children, dot }: { tone?: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap', TONES[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Avatar({ src, name, size = 32 }: { src?: string; name: string; size?: number }) {
  const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  return src ? (
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full bg-line object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-bold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">{initials}</span>
  );
}

export function EmptyState({ icon, title, description }: { icon: IconName; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-bg text-muted"><Icon name={icon} size={22} /></span>
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
    </div>
  );
}

// ─── Overlays ────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const t = useT();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the open/close effect (which moves focus).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80]">
      <div className="fade-in absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="sheet slide-up px-5 outline-none sm:px-6">
        <div className="sheet-handle mx-auto mt-3 mb-4 h-1 w-9 rounded-full bg-line" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold tracking-tight">{title}</h2>
          <IconButton icon="x" label={t('Close', 'Закрыть')} onClick={onClose} className="-mt-1 -mr-2" />
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel, tone = 'danger', onConfirm, onClose }:
  { open: boolean; title: string; description: string; confirmLabel: string; tone?: 'danger' | 'primary'; onConfirm: () => void; onClose: () => void }) {
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <Button onClick={onClose}>{t('Cancel', 'Отмена')}</Button>
        <Button variant={tone} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
      </>}>
      <p className="text-[15px] leading-relaxed text-muted">{description}</p>
    </Modal>
  );
}
