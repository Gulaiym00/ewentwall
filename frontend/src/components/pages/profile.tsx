'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { meApi } from '@/api/auth';
import { errorMessage } from '@/api/client';
import type { Language, User } from '@/api/types';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizer } from '@/hooks/useOrganizer';
import { Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, Field, Input, PageHeader, Select, SettingRow, Toggle } from '@/ui';
import { Spinner } from '@/ui/loader';
import { formatDate } from '@/utils/format';
import { useLocale, useT } from '@/utils/locale';

const MAX_AVATAR_MB = 5;

/** The editable part of the profile. */
type Draft = Pick<User, 'name' | 'email' | 'language' | 'notifications'> & { phone: string; city: string };
const toDraft = (u: User): Draft => ({
  name: u.name, email: u.email, phone: u.phone ?? '', city: u.city ?? '', language: u.language, notifications: { ...u.notifications },
});

export default function Profile() {
  const t = useT();
  const { setLocale } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { logout } = useAuth();
  const { profile, setProfile, events } = useOrganizer();
  const user = profile!; // OrganizerShell renders pages only for signed-in users

  const [draft, setDraft] = useState<Draft>(() => toDraft(user));
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(user));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }));
  const setNotif = (k: keyof Draft['notifications'], v: boolean) => setDraft(d => ({ ...d, notifications: { ...d.notifications, [k]: v } }));

  const pickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast(t('Please choose an image file', 'Выберите файл изображения'), 'danger'); return; }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) { toast(t(`Image must be under ${MAX_AVATAR_MB} MB`, `Изображение должно быть меньше ${MAX_AVATAR_MB} МБ`), 'danger'); return; }
    setAvatarBusy(true);
    try {
      setProfile(await meApi.uploadAvatar(file));
      toast(t('Photo updated', 'Фото обновлено'));
    } catch (err) {
      toast(errorMessage(err), 'danger');
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      setProfile(await meApi.removeAvatar());
    } catch (err) {
      toast(errorMessage(err), 'danger');
    } finally {
      setAvatarBusy(false);
    }
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.name.trim()) { toast(t('Name cannot be empty', 'Имя не может быть пустым'), 'danger'); return; }
    setSaving(true);
    try {
      const updated = await meApi.update({ ...draft, name: draft.name.trim() });
      setProfile(updated);
      setDraft(toDraft(updated));
      // The saved interface language applies right away
      if (updated.language !== t.locale) setLocale(updated.language);
      toast(updated.language === 'ru' ? 'Профиль сохранён' : 'Profile saved');
    } catch (err) {
      toast(errorMessage(err), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 8) { setPwError(t('New password must be at least 8 characters.', 'Новый пароль должен быть не короче 8 символов.')); return; }
    if (pw.next !== pw.confirm) { setPwError(t('Passwords do not match.', 'Пароли не совпадают.')); return; }
    setPwError('');
    setPwBusy(true);
    try {
      await meApi.changePassword({ currentPassword: user.hasPassword ? pw.current : undefined, newPassword: pw.next });
      // The backend ends every session on a password change: sign in again with the new password.
      setPw({ current: '', next: '', confirm: '' });
      toast(t('Password updated — please sign in again', 'Пароль изменён — войдите снова'));
      await logout();
      router.replace('/login');
    } catch (err) {
      setPwError(errorMessage(err));
    } finally {
      setPwBusy(false);
    }
  };

  const deleteAccount = async () => {
    try {
      await meApi.deleteAccount();
      await logout();
      toast(t('Account deleted', 'Аккаунт удалён'), 'danger');
      router.replace('/');
    } catch (err) {
      toast(errorMessage(err), 'danger');
    }
  };

  return (
    <>
      <PageHeader title={t('Profile', 'Профиль')} description={t('Your account and notifications.', 'Ваш аккаунт и уведомления.')} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          {/* Personal info */}
          <Card>
            <form onSubmit={save}>
              <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div className="relative">
                  <Avatar src={user.avatarUrl ?? undefined} name={draft.name || '?'} size={72} />
                  {avatarBusy && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40"><Spinner size={20} /></span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">{draft.name || t('Your name', 'Ваше имя')}</p>
                  <p className="truncate text-sm text-muted">{draft.email}</p>
                </div>
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={pickAvatar} />
                  <Button size="sm" icon="upload" disabled={avatarBusy} onClick={() => fileRef.current?.click()}>{t('Change photo', 'Сменить фото')}</Button>
                  {user.avatarUrl && <Button size="sm" variant="ghost" disabled={avatarBusy} onClick={removeAvatar}>{t('Remove', 'Удалить')}</Button>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('Full name', 'Имя и фамилия')} htmlFor="p-name">
                  <Input id="p-name" value={draft.name} onChange={e => set('name', e.target.value)} autoComplete="name" required maxLength={80} />
                </Field>
                <Field label="Email" htmlFor="p-email" hint={t('Used to sign in and for notifications.', 'Для входа и уведомлений.')}>
                  <Input id="p-email" type="email" value={draft.email} onChange={e => set('email', e.target.value)} autoComplete="email" required />
                </Field>
                <Field label={t('Phone', 'Телефон')} htmlFor="p-phone">
                  <Input id="p-phone" type="tel" value={draft.phone} onChange={e => set('phone', e.target.value)} autoComplete="tel" maxLength={30} />
                </Field>
                <Field label={t('City', 'Город')} htmlFor="p-city">
                  <Input id="p-city" value={draft.city} onChange={e => set('city', e.target.value)} autoComplete="address-level2" maxLength={80} />
                </Field>
                <Field label={t('Interface language', 'Язык интерфейса')} htmlFor="p-lang">
                  <Select id="p-lang" value={draft.language} onChange={e => set('language', e.target.value as Language)}
                    options={[{ value: 'en', label: 'English' }, { value: 'ru', label: 'Русский' }]} />
                </Field>
              </div>
            </form>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader title={t('Email notifications', 'Уведомления на email')} />
            <SettingRow title={t('New photos', 'Новые фото')} description={t('A digest when guests upload to your live events.', 'Сводка, когда гости загружают фото на ваши события.')}>
              <Toggle checked={draft.notifications.newPhotos} onChange={v => setNotif('newPhotos', v)} label={t('New photos', 'Новые фото')} />
            </SettingRow>
            <SettingRow title={t('Daily summary', 'Итоги дня')} description={t('Photos, guests and reactions for the day.', 'Фото, гости и реакции за день.')}>
              <Toggle checked={draft.notifications.dailySummary} onChange={v => setNotif('dailySummary', v)} label={t('Daily summary', 'Итоги дня')} />
            </SettingRow>
            <SettingRow title={t('Reported photos', 'Жалобы на фото')} description={t('When a guest reports a photo on your wall.', 'Когда гость жалуется на фото на вашей стене.')}>
              <Toggle checked={draft.notifications.reports} onChange={v => setNotif('reports', v)} label={t('Reported photos', 'Жалобы на фото')} />
            </SettingRow>
            <SettingRow title={t('Product news', 'Новости продукта')} description={t('New features and tips, about once a month.', 'Новые функции и советы, примерно раз в месяц.')}>
              <Toggle checked={draft.notifications.product} onChange={v => setNotif('product', v)} label={t('Product news', 'Новости продукта')} />
            </SettingRow>
          </Card>

          {/* Password */}
          <Card>
            <CardHeader title={user.hasPassword ? t('Password', 'Пароль') : t('Set a password', 'Задать пароль')} />
            {!user.hasPassword && (
              <p className="mb-4 text-[13px] text-muted">{t('You sign in with Google. Add a password to also sign in with your email.', 'Вы входите через Google. Задайте пароль, чтобы входить и по email.')}</p>
            )}
            <form onSubmit={changePassword} className="space-y-4">
              {user.hasPassword && (
                <Field label={t('Current password', 'Текущий пароль')} htmlFor="pw-cur">
                  <Input id="pw-cur" type="password" autoComplete="current-password" required value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
                </Field>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('New password', 'Новый пароль')} htmlFor="pw-new" hint={t('At least 8 characters.', 'Не короче 8 символов.')}>
                  <Input id="pw-new" type="password" autoComplete="new-password" required minLength={8} value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} />
                </Field>
                <Field label={t('Repeat new password', 'Повторите пароль')} htmlFor="pw-rep">
                  <Input id="pw-rep" type="password" autoComplete="new-password" required value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
                </Field>
              </div>
              {pwError && <p role="alert" className="text-sm font-medium text-danger">{pwError}</p>}
              <Button type="submit" disabled={pwBusy}>{pwBusy ? t('Saving…', 'Сохраняем…') : user.hasPassword ? t('Update password', 'Сменить пароль') : t('Set password', 'Задать пароль')}</Button>
              {user.hasPassword && <p className="text-xs text-muted">{t('Changing the password signs you out on all devices.', 'После смены пароля вы выйдете на всех устройствах.')}</p>}
            </form>
          </Card>
        </div>

        {/* Side column */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-[84px] lg:self-start">
          <Card>
            <CardHeader title={t('Account', 'Аккаунт')} action={<Badge tone="accent">{user.role === 'admin' ? t('Admin', 'Админ') : t('Free plan', 'Бесплатный тариф')}</Badge>} />
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">{t('Events', 'События')}</dt><dd className="font-semibold tabular-nums">{events.length}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">{t('Member since', 'С нами с')}</dt><dd className="font-semibold">{formatDate(user.createdAt.slice(0, 10))}</dd></div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t('Sign-in', 'Вход')}</dt>
                <dd className="text-right font-semibold">{[user.hasPassword && t('Email & password', 'Email и пароль'), user.googleLinked && 'Google'].filter(Boolean).join(', ')}</dd>
              </div>
            </dl>
          </Card>

          <Card className="border-danger/40">
            <p className="font-semibold">{t('Delete account', 'Удалить аккаунт')}</p>
            <p className="mt-1 text-[13px] text-muted">{t('Permanently removes your account, all events and every uploaded photo.', 'Навсегда удаляет аккаунт, все события и все загруженные фото.')}</p>
            <Button variant="danger" size="sm" className="mt-4" icon="trash" onClick={() => setDeleteOpen(true)}>{t('Delete account', 'Удалить аккаунт')}</Button>
          </Card>
        </div>
      </div>

      {dirty && (
        <div className="notif-slide sticky bottom-4 z-20 mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface p-2 pl-4 shadow-lg">
          <span className="mr-auto text-sm font-semibold">{t('Unsaved changes', 'Есть несохранённые изменения')}</span>
          <Button size="sm" variant="ghost" onClick={() => setDraft(toDraft(user))}>{t('Discard', 'Отменить')}</Button>
          <Button size="sm" variant="primary" disabled={saving} onClick={() => save()}>{saving ? t('Saving…', 'Сохраняем…') : t('Save changes', 'Сохранить')}</Button>
        </div>
      )}

      <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('Delete your account?', 'Удалить аккаунт?')} confirmLabel={t('Delete account', 'Удалить аккаунт')}
        description={t(`All ${events.length} events and their photos will be permanently deleted. Guests will lose access to your walls. This cannot be undone.`,
          `Все ваши события (${events.length}) и их фото будут удалены навсегда. Гости потеряют доступ к стенам. Это нельзя отменить.`)}
        onConfirm={deleteAccount} />
    </>
  );
}
