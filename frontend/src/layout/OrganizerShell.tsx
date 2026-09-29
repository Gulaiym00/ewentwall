'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Icon, type IconName } from '@/ui/icons';
import { Avatar, IconButton } from '@/ui';
import { cx } from '@/utils/cx';
import { useAuth, useRequireAuth } from '@/hooks/useAuth';
import type { Role } from '@/api/types';
import { PageLoader } from '@/ui/loader';
import { LanguageToggle, useT } from '@/utils/locale';

// Admins can open the organizer area too (they may run their own events).
const ALLOWED: Role[] = ['organizer', 'admin'];

const NAV: { href: string; label: string; ru: string; icon: IconName; exact?: boolean }[] = [
  { href: '/dashboard', label: 'Overview', ru: 'Обзор', icon: 'dashboard', exact: true },
  { href: '/dashboard/events', label: 'My Events', ru: 'Мои события', icon: 'calendar' },
  { href: '/dashboard/create', label: 'Create Event', ru: 'Создать событие', icon: 'plus' },
  { href: '/dashboard/profile', label: 'Profile', ru: 'Профиль', icon: 'user' },
];

export default function OrganizerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dark, toggleDark } = useTheme();
  const router = useRouter();
  const { logout } = useAuth();
  const profile = useRequireAuth(ALLOWED);
  const t = useT();
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  if (!profile) return <PageLoader fullScreen label={t('Checking your session…', 'Проверяем сессию…')} />;

  const firstName = profile.name.split(' ')[0] || t('Profile', 'Профиль');
  const signOut = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <>
      <div className="flex min-h-screen bg-bg text-fg">
        {drawerOpen && <div className="fade-in fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setDrawerOpen(false)} />}

        <aside aria-label={t('Sidebar', 'Боковое меню')}
          className={cx(
            'fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-line bg-surface transition-transform duration-250 ease-out',
            'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
            drawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          )}>
          <div className="flex h-[60px] items-center gap-2 border-b border-line px-5">
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-2" aria-label={t('EventWall — home', 'EventWall — на главную')}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-accent text-white"><Icon name="camera" size={14} /></span>
              <span className="truncate text-sm font-bold tracking-tight">EventWall</span>
            </Link>
            <IconButton icon="x" label={t('Close menu', 'Закрыть меню')} onClick={() => setDrawerOpen(false)} className="lg:hidden" />
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
            {NAV.map(item => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
                  className={cx('flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-sm font-semibold transition-colors',
                    active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-bg hover:text-fg')}>
                  <Icon name={item.icon} size={18} />
                  {t(item.label, item.ru)}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-col gap-0.5 border-t border-line p-3">
            <button type="button" onClick={toggleDark}
              className="flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-medium text-muted hover:bg-bg hover:text-fg">
              <Icon name={dark ? 'sun' : 'moon'} size={16} /> {dark ? t('Light mode', 'Светлая тема') : t('Dark mode', 'Тёмная тема')}
            </button>
            {profile.role === 'admin' && (
              <Link href="/admin" className="flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-medium text-muted hover:bg-bg hover:text-fg">
                <Icon name="shield" size={16} /> {t('Admin console', 'Админка')}
              </Link>
            )}
            <button type="button" onClick={signOut}
              className="flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-medium text-muted hover:bg-bg hover:text-fg">
              <Icon name="logout" size={16} /> {t('Sign out', 'Выйти')}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-line bg-bg px-4 sm:px-7">
            <IconButton icon="menu" label={t('Open menu', 'Открыть меню')} onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen} className="border border-line lg:hidden" />
            <LanguageToggle className="ml-auto h-8 rounded-lg border border-line px-2.5 text-xs font-bold text-muted hover:text-fg" />
            <Link href="/dashboard/profile" className=" flex items-center gap-2.5 rounded-full py-1 pr-1 pl-3 hover:bg-surface">
              <span className="text-sm font-semibold">{firstName}</span>
              <Avatar src={profile.avatarUrl ?? undefined} name={profile.name} size={32} />
            </Link>
          </header>

          <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-6 sm:px-7 md:py-8">{children}</main>
        </div>
      </div>
    </>
  );
}
