'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import {
  Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, PageHeader, SearchInput, Select, type Tone,
} from '@/ui';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/client';
import type { AdminUser, Role as UserRole, UserStatus } from '@/api/types';
import { formatDate, timeAgo } from '@/utils/format';
import { useAdmin } from '@/hooks/useAdmin';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useDebounced } from '@/hooks/useDebounced';
import { LoadError } from '@/ui/loader';
import { useT } from '@/utils/locale';
import { roleLabel, userStatusLabel } from '@/utils/labels';

/** Readable random password without look-alike characters (0/O, 1/l/I). */
const generatePassword = () => {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(12)), n => chars[n % chars.length]).join('');
};

const STATUS_TONE: Record<UserStatus, Tone> = { active: 'success', pending: 'warning', blocked: 'danger' };

export default function AdminUsers() {
  const t = useT();
  const toast = useToast();
  const { refreshCounts } = useAdmin();
  const { user: me } = useAuth();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'all' | UserRole>('all');
  const [status, setStatus] = useState<'all' | UserStatus>('all');
  // ?query=… comes from Admin → Support (“Set new password”).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('query');
    if (q) queueMicrotask(() => setQuery(q));
  }, []);
  const search = useDebounced(query.trim(), 300);
  const list = useApi(
    () => adminApi.users({ query: search || undefined, role: role === 'all' ? undefined : role, status: status === 'all' ? undefined : status, pageSize: 100 }),
    [search, role, status],
  );
  const filtered = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('guest');
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [access, setAccess] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'organizer' as UserRole });

  const ROLE_OPTIONS = [
    { value: 'guest', label: t('Guest', 'Гость') },
    { value: 'organizer', label: t('Organizer', 'Организатор') },
    { value: 'admin', label: t('Admin', 'Админ') },
  ];

  /** Runs an admin action, then reloads the list and the sidebar counters. */
  const run = async (action: () => Promise<unknown>, message: string, tone: 'success' | 'danger' = 'success') => {
    setBusy(true);
    try {
      await action();
      toast(message, tone);
      list.reload();
      refreshCounts();
      return true;
    } catch (err) {
      toast(errorMessage(err), 'danger');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = (u: AdminUser) => {
    const blocked = u.status !== 'blocked';
    run(() => adminApi.updateUser(u.id, { status: blocked ? 'blocked' : 'active' }),
      blocked ? t(`${u.name} blocked`, `${u.name} заблокирован(а)`) : t(`${u.name} unblocked`, `${u.name} разблокирован(а)`),
      blocked ? 'danger' : 'success');
  };

  const openEdit = (u: AdminUser) => { setEditing(u); setEditRole(u.role); };

  const saveRole = async () => {
    if (!editing) return;
    const msg = t(`${editing.name} is now ${editRole}`, `${editing.name} теперь ${roleLabel(t, editRole)}`);
    if (await run(() => adminApi.updateUser(editing.id, { role: editRole }), msg)) setEditing(null);
  };

  const openAccess = (u: AdminUser) => { setAccess(u); setNewPassword(generatePassword()); setShowPassword(true); setSavedPassword(null); };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!access) return;
    const password = newPassword;
    if (await run(() => adminApi.setUserPassword(access.id, password), t(`New password set for ${access.name}`, `Новый пароль для ${access.name} сохранён`))) {
      setSavedPassword(password);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('Copied', 'Скопировано'));
    } catch {
      toast(t('Could not copy — select the text manually', 'Не удалось скопировать — выделите текст вручную'), 'danger');
    }
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => adminApi.inviteUser({ name: invite.name || undefined, email: invite.email, role: invite.role }),
      t(`${invite.email} added — they finish signing up with this email`, `${invite.email} добавлен(а) — регистрацию нужно завершить с этим email`));
    if (ok) {
      setInvite({ name: '', email: '', role: 'organizer' });
      setInviteOpen(false);
    }
  };

  const actions = (u: AdminUser) => (
    <div className="flex justify-end gap-0.5">
      <IconButton icon="lock" label={t(`Login & password: ${u.name}`, `Логин и пароль: ${u.name}`)} onClick={() => openAccess(u)} disabled={busy} />
      <IconButton icon="key" label={t(`Change role for ${u.name}`, `Сменить роль: ${u.name}`)} onClick={() => openEdit(u)} disabled={u.id === me?.id || busy} />
      <IconButton icon={u.status === 'blocked' ? 'check' : 'ban'}
        label={u.status === 'blocked' ? t(`Unblock ${u.name}`, `Разблокировать: ${u.name}`) : t(`Block ${u.name}`, `Заблокировать: ${u.name}`)}
        onClick={() => toggleBlock(u)} disabled={u.id === me?.id || busy} />
      <IconButton icon="trash" label={t(`Delete ${u.name}`, `Удалить: ${u.name}`)} onClick={() => setDeleting(u)} disabled={u.id === me?.id || busy} className="hover:text-danger" />
    </div>
  );

  const filtersOn = search || role !== 'all' || status !== 'all';
  const description = list.loading && !list.data
    ? t('Loading…', 'Загрузка…')
    : t(`${total} account${total === 1 ? '' : 's'}${filtersOn ? ' match the filters' : ''}`,
      `${t.count(total, ['account', 'accounts'], ['аккаунт', 'аккаунта', 'аккаунтов'])}${filtersOn ? ' по фильтрам' : ''}`);

  return (
    <>
      <PageHeader title={t('Users', 'Пользователи')} description={description}
        actions={<Button variant="primary" icon="plus" onClick={() => setInviteOpen(true)}>{t('Invite user', 'Пригласить')}</Button>} />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <SearchInput value={query} onChange={setQuery} placeholder={t('Search by name or email', 'Поиск по имени или email')} />
        <Select aria-label={t('Filter by role', 'Фильтр по роли')} value={role} onChange={e => setRole(e.target.value as typeof role)}
          options={[{ value: 'all', label: t('All roles', 'Все роли') }, ...ROLE_OPTIONS]} className="sm:w-40" />
        <Select aria-label={t('Filter by status', 'Фильтр по статусу')} value={status} onChange={e => setStatus(e.target.value as typeof status)}
          options={[
            { value: 'all', label: t('All statuses', 'Все статусы') },
            { value: 'active', label: userStatusLabel(t, 'active') },
            { value: 'pending', label: userStatusLabel(t, 'pending') },
            { value: 'blocked', label: userStatusLabel(t, 'blocked') },
          ]} className="sm:w-40" />
      </div>

      <Card padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <LoadError message={list.error.message} onRetry={list.reload} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="users" title={t('No users found', 'Никого не нашли')} description={t('Try a different search or clear the filters.', 'Измените запрос или сбросьте фильтры.')} />
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">{t('User', 'Пользователь')}</th>
                  <th className="px-3 py-3 font-semibold">{t('Role', 'Роль')}</th>
                  <th className="px-3 py-3 font-semibold">{t('Status', 'Статус')}</th>
                  <th className="px-3 py-3 text-right font-semibold">{t('Events', 'События')}</th>
                  <th className="hidden px-3 py-3 font-semibold lg:table-cell">{t('Joined', 'Регистрация')}</th>
                  <th className="hidden px-3 py-3 font-semibold xl:table-cell">{t('Last seen', 'Был(а) в сети')}</th>
                  <th className="px-5 py-3"><span className="sr-only">{t('Actions', 'Действия')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map(u => (
                  <tr key={u.id} className="transition-colors hover:bg-bg">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.avatarUrl ?? undefined} name={u.name} size={36} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{u.name}</p>
                          <p className="truncate text-xs text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 capitalize">{roleLabel(t, u.role)}</td>
                    <td className="px-3 py-3"><Badge tone={STATUS_TONE[u.status]} dot>{userStatusLabel(t, u.status)}</Badge></td>
                    <td className="px-3 py-3 text-right tabular-nums">{u.events}</td>
                    <td className="hidden px-3 py-3 text-muted lg:table-cell">{formatDate(u.createdAt.slice(0, 10))}</td>
                    <td className="hidden px-3 py-3 text-muted xl:table-cell">{u.lastSeenAt ? timeAgo(u.lastSeenAt) : t('Never', 'Никогда')}</td>
                    <td className="px-5 py-3">{actions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile list */}
            <ul className="divide-y divide-line md:hidden">
              {filtered.map(u => (
                <li key={u.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={u.avatarUrl ?? undefined} name={u.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{u.name}</p>
                      <p className="truncate text-xs text-muted">{u.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge tone={STATUS_TONE[u.status]} dot>{userStatusLabel(t, u.status)}</Badge>
                    <span className="text-xs text-muted">
                      <span className="capitalize">{roleLabel(t, u.role)}</span> · {t.count(u.events, ['event', 'events'], ['событие', 'события', 'событий'])}
                    </span>
                    <div className="ml-auto">{actions(u)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">{t(`Showing ${filtered.length} of ${total}`, `Показано ${filtered.length} из ${total}`)}</p>

      {/* Change role */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={t('Change role', 'Сменить роль')}
        footer={<><Button onClick={() => setEditing(null)}>{t('Cancel', 'Отмена')}</Button><Button variant="primary" onClick={saveRole}>{t('Save', 'Сохранить')}</Button></>}>
        {editing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-bg p-3">
              <Avatar src={editing.avatarUrl ?? undefined} name={editing.name} size={40} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{editing.name}</p>
                <p className="truncate text-xs text-muted">{editing.email}</p>
              </div>
            </div>
            <Field label={t('Role', 'Роль')} htmlFor="edit-role" hint={t('Admins get full access to this console.', 'Админы получают полный доступ к этой панели.')}>
              <Select id="edit-role" value={editRole} onChange={e => setEditRole(e.target.value as UserRole)} options={ROLE_OPTIONS} />
            </Field>
          </div>
        )}
      </Modal>

      {/* Login & password */}
      <Modal open={!!access} onClose={() => setAccess(null)} title={t('Login & password', 'Логин и пароль')}>
        {access && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-bg p-3">
              <Avatar src={access.avatarUrl ?? undefined} name={access.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{access.name}</p>
                <p className="truncate text-xs text-muted">{access.email}</p>
              </div>
            </div>

            <Field label={t('Login (email)', 'Логин (email)')} htmlFor="acc-email">
              <div className="flex gap-2">
                <Input id="acc-email" value={access.email} readOnly />
                <IconButton icon="file" label={t('Copy login', 'Скопировать логин')} onClick={() => copy(access.email)} />
              </div>
            </Field>

            <p className="text-xs text-muted">
              {access.hasPassword
                ? t('Passwords are stored encrypted, so nobody — not even an admin — can see the current one. Set a new password and send it to the user.',
                  'Пароли хранятся в зашифрованном виде, поэтому текущий пароль не может увидеть никто, даже админ. Задайте новый пароль и передайте его пользователю.')
                : access.googleLinked
                  ? t('This account signs in with Google and has no password yet. You can set one so they can also sign in by email.',
                    'Этот аккаунт входит через Google и пароля пока нет. Можно задать пароль, чтобы входить и по email.')
                  : t('This account has no password yet. Setting one activates it.', 'У этого аккаунта пока нет пароля. После установки пароля аккаунт станет активным.')}
            </p>

            {savedPassword ? (
              <div className="space-y-3 rounded-xl border border-line p-3">
                <p className="text-sm font-semibold">{t('New sign-in details', 'Новые данные для входа')}</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-bg px-3 py-2 text-sm">{savedPassword}</code>
                  <IconButton icon="file" label={t('Copy password', 'Скопировать пароль')} onClick={() => copy(savedPassword)} />
                </div>
                <p className="text-xs text-muted">
                  {t('The user was signed out on all devices. This password is shown only now — copy it before closing.',
                    'Пользователь вышел на всех устройствах. Пароль показывается только сейчас — скопируйте его перед закрытием.')}
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button onClick={() => copy(`${t('Login', 'Логин')}: ${access.email}
${t('Password', 'Пароль')}: ${savedPassword}`)}>{t('Copy both', 'Скопировать всё')}</Button>
                  <Button variant="primary" onClick={() => setAccess(null)}>{t('Done', 'Готово')}</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={savePassword} className="space-y-4">
                <Field label={t('New password', 'Новый пароль')} htmlFor="acc-password" hint={t('At least 8 characters.', 'Минимум 8 символов.')}>
                  <div className="flex gap-2">
                    <Input id="acc-password" type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={128}
                      value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
                    <IconButton icon={showPassword ? 'eyeOff' : 'eye'} label={showPassword ? t('Hide password', 'Скрыть пароль') : t('Show password', 'Показать пароль')}
                      onClick={() => setShowPassword(v => !v)} />
                    <IconButton icon="sparkle" label={t('Generate password', 'Сгенерировать пароль')} onClick={() => setNewPassword(generatePassword())} />
                  </div>
                </Field>
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button onClick={() => setAccess(null)}>{t('Cancel', 'Отмена')}</Button>
                  <Button type="submit" variant="primary" icon="lock" disabled={busy || newPassword.length < 8}>{t('Set password', 'Сохранить пароль')}</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* Invite */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={t('Invite user', 'Пригласить пользователя')}>
        <form onSubmit={sendInvite} className="space-y-4">
          <Field label={t('Name', 'Имя')} htmlFor="inv-name"><Input id="inv-name" value={invite.name} onChange={e => setInvite(v => ({ ...v, name: e.target.value }))} placeholder={t('Optional', 'Необязательно')} autoComplete="off" /></Field>
          <Field label="Email" htmlFor="inv-email"><Input id="inv-email" type="email" required value={invite.email} onChange={e => setInvite(v => ({ ...v, email: e.target.value }))} placeholder="name@example.com" autoComplete="off" /></Field>
          <Field label={t('Role', 'Роль')} htmlFor="inv-role"><Select id="inv-role" value={invite.role} onChange={e => setInvite(v => ({ ...v, role: e.target.value as UserRole }))} options={ROLE_OPTIONS} /></Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button onClick={() => setInviteOpen(false)}>{t('Cancel', 'Отмена')}</Button>
            <Button type="submit" variant="primary" icon="plus">{t('Send invite', 'Пригласить')}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title={t('Delete user?', 'Удалить пользователя?')} confirmLabel={t('Delete user', 'Удалить')}
        description={t(`${deleting?.name} (${deleting?.email}) and all their events will be permanently deleted. This cannot be undone.`,
          `${deleting?.name} (${deleting?.email}) и все его события будут удалены навсегда. Это нельзя отменить.`)}
        onConfirm={() => { if (deleting) run(() => adminApi.deleteUser(deleting.id), t(`${deleting.name} deleted`, `${deleting.name} удалён(а)`), 'danger'); }} />
    </>
  );
}
