'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth, useRequireAuth } from '@/hooks/useAuth';
import type { Role } from '@/api/types';
import { PageLoader } from '@/ui/loader';

const ALLOWED: Role[] = ['admin'];
import { Icon, type IconName } from '@/ui/icons';
import { Avatar, IconButton } from '@/ui';
import { cx } from '@/utils/cx';
import { LanguageToggle, useT } from '@/utils/locale';

// ─── Navigation ──────────────────────────────────────────────────────────────

type Counts = ReturnType<typeof useAdmin>['counts'];

const NAV: { href: string; label: string; ru: string; icon: IconName; badge?: keyof Counts }[] = [
  { href: '/admin', label: 'Dashboard', ru: 'Панель', icon: 'dashboard' },
  { href: '/admin/users', label: 'Users', ru: 'Пользователи', icon: 'users' },
  { href: '/admin/events', label: 'Events', ru: 'События', icon: 'calendar' },
  { href: '/admin/moderation', label: 'Moderation', ru: 'Модерация', icon: 'shield', badge: 'pendingReports' },
  { href: '/admin/reviews', label: 'Reviews', ru: 'Отзывы', icon: 'star', badge: 'pendingReviews' },
  { href: '/admin/support', label: 'Support', ru: 'Поддержка', icon: 'message', badge: 'openTickets' },
  { href: '/admin/content', label: 'Website content', ru: 'Контент сайта', icon: 'file' },
  { href: '/admin/settings', label: 'Settings', ru: 'Настройки', icon: 'settings' },
  { href: '/admin/audit', label: 'Audit log', ru: 'Журнал действий', icon: 'history' },
];

const isActive = (pathname: string, href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dark, toggleDark } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();
  const admin = useRequireAuth(ALLOWED);
  const t = useT();

  const { counts } = useAdmin();
  const current = NAV.find(n => isActive(pathname, n.href));

  // Close the mobile drawer on navigation and on Escape
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  if (!admin) return <PageLoader fullScreen label={t('Checking your session…', 'Проверяем сессию…')} />;

  const signOut = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <>
      <div className="flex min-h-screen bg-bg text-fg">
        {/* Mobile overlay */}
        {drawerOpen && <div className="fade-in fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setDrawerOpen(false)} />}

        {/* ── Sidebar: always dark to separate the console from the product ── */}
        <aside
          aria-label={t('Admin navigation', 'Навигация админки')}
          className={cx(
            'fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-[#121214] text-white/70 transition-transform duration-250 ease-out',
            'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
            drawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          )}>
          <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-accent text-white"><Icon name="camera" size={14} /></span>
            <span className="truncate text-sm font-bold tracking-tight text-white">EventWall</span>
            <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white/80 uppercase">Admin</span>
            <IconButton icon="x" label={t('Close menu', 'Закрыть меню')} onClick={() => setDrawerOpen(false)} className="ml-auto text-white/60 hover:bg-white/10 hover:text-white lg:hidden" />
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {NAV.map(item => {
              const active = isActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-semibold transition-colors',
                    active ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white',
                  )}>
                  <Icon name={item.icon} size={17} className={active ? 'text-accent' : undefined} />
                  <span className="flex-1">{t(item.label, item.ru)}</span>
                  {!!item.badge && counts[item.badge] > 0 && (
                    <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] leading-5 font-bold text-white">{counts[item.badge]}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-0.5 border-t border-white/10 p-3">
            <button type="button" onClick={toggleDark}
              className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium hover:bg-white/5 hover:text-white">
              <Icon name={dark ? 'sun' : 'moon'} size={16} /> {dark ? t('Light mode', 'Светлая тема') : t('Dark mode', 'Тёмная тема')}
            </button>
            <Link href="/" className="flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium hover:bg-white/5 hover:text-white">
              <Icon name="external" size={16} /> {t('Back to site', 'На сайт')}
            </Link>
            <Link href="/dashboard" className="flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium hover:bg-white/5 hover:text-white">
              <Icon name="calendar" size={16} /> {t('My events', 'Мои события')}
            </Link>
            <button type="button" onClick={signOut}
              className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium hover:bg-white/5 hover:text-white">
              <Icon name="logout" size={16} /> {t('Sign out', 'Выйти')}
            </button>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
            <IconButton icon="menu" label={t('Open menu', 'Открыть меню')} onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen} className="-ml-1 border border-line lg:hidden" />
            <nav aria-label={t('Breadcrumb', 'Навигация')} className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="hidden text-muted sm:inline">{t('Admin', 'Админка')}</span>
              <span className="hidden text-muted sm:inline" aria-hidden="true">/</span>
              <span className="truncate font-semibold">{current ? t(current.label, current.ru) : t('Admin', 'Админка')}</span>
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <LanguageToggle className="h-8 rounded-lg border border-line px-2.5 text-xs font-bold text-muted hover:text-fg" />
              <span className="hidden text-sm font-semibold sm:inline">{admin.name}</span>
              <Avatar src={admin.avatarUrl ?? undefined} name={admin.name} size={32} />
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 md:py-8 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
