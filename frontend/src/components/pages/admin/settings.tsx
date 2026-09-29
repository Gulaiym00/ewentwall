'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { Icon } from '@/ui/icons';
import { Button, Card, CardHeader, ConfirmDialog, Field, Input, PageHeader, Select, SettingRow, Toggle } from '@/ui';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/client';
import type { PlatformSettings } from '@/api/types';
import { useApi } from '@/hooks/useApi';
import { LoadError, PageLoader } from '@/ui/loader';
import { useT } from '@/utils/locale';

type Settings = PlatformSettings;

export default function AdminSettings() {
  const t = useT();
  const settings = useApi(() => adminApi.settings(), []);
  if (settings.loading && !settings.data) return <PageLoader label={t('Loading settings…', 'Загружаем настройки…')} />;
  if (!settings.data) return <LoadError message={settings.error?.message ?? t('Failed to load', 'Не удалось загрузить')} onRetry={settings.reload} />;
  return <SettingsEditor initial={settings.data} />;
}

function SettingsEditor({ initial }: { initial: Settings }) {
  const t = useT();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);
  const dirty = JSON.stringify(saved) !== JSON.stringify(s);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS(x => ({ ...x, [k]: v }));

  /** Sends only the fields that differ from what's saved. */
  const saveSettings = async (next: Settings, message: string, tone: 'success' | 'danger' = 'success') => {
    const patch = Object.fromEntries(Object.entries(next).filter(([k, v]) => saved[k as keyof Settings] !== v)) as Partial<Settings>;
    if (!Object.keys(patch).length) return;
    setSaving(true);
    try {
      const updated = await adminApi.saveSettings(patch);
      setSaved(updated);
      setS(cur => ({ ...cur, ...patch }));
      toast(message, tone);
    } catch (err) {
      toast(errorMessage(err), 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Maintenance applies immediately, independent of the unsaved-changes bar
  const setMaintenance = (on: boolean) =>
    saveSettings({ ...saved, maintenance: on },
      on ? t('Maintenance mode enabled', 'Режим обслуживания включён') : t('Maintenance mode off', 'Режим обслуживания выключен'),
      on ? 'danger' : 'success');
  const num = (k: keyof Settings, min: number, max: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, Math.min(max, Math.max(min, Number(e.target.value) || min)) as never);

  return (
    <>
      <PageHeader title={t('Settings', 'Настройки')}
        description={t('Platform-wide configuration. Applies to all events and organizers.', 'Настройки всей платформы. Действуют для всех событий и организаторов.')} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('General', 'Основное')} />
          <div className="space-y-4">
            <Field label={t('Platform name', 'Название платформы')} htmlFor="s-name"><Input id="s-name" value={s.platformName} onChange={e => set('platformName', e.target.value)} /></Field>
            <Field label={t('Support email', 'Email поддержки')} htmlFor="s-email" hint={t('Shown to organizers in emails and error pages.', 'Показывается организаторам в письмах и на страницах ошибок.')}>
              <Input id="s-email" type="email" value={s.supportEmail} onChange={e => set('supportEmail', e.target.value)} />
            </Field>
            <Field label={t('Default language', 'Язык по умолчанию')} htmlFor="s-locale">
              <Select id="s-locale" value={s.defaultLocale} onChange={e => set('defaultLocale', e.target.value as Settings['defaultLocale'])}
                options={[{ value: 'en', label: 'English' }, { value: 'ru', label: 'Русский' }]} />
            </Field>
          </div>
          <div className="mt-2">
            <SettingRow title={t('Open registration', 'Открытая регистрация')} description={t('Anyone can sign up as an organizer.', 'Любой может зарегистрироваться как организатор.')}>
              <Toggle checked={s.allowSignups} onChange={v => set('allowSignups', v)} label={t('Open registration', 'Открытая регистрация')} />
            </SettingRow>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('Uploads & storage', 'Загрузки и хранилище')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('Max photo size, MB', 'Макс. размер фото, МБ')} htmlFor="s-size"><Input id="s-size" type="number" inputMode="numeric" min={1} max={50} value={s.maxPhotoMb} onChange={num('maxPhotoMb', 1, 50)} /></Field>
            <Field label={t('Photos per upload', 'Фото за одну загрузку')} htmlFor="s-per"><Input id="s-per" type="number" inputMode="numeric" min={1} max={50} value={s.maxPerUpload} onChange={num('maxPerUpload', 1, 50)} /></Field>
          </div>
          <div className="mt-4">
            <Field label={t('Keep photos after event', 'Хранить фото после события')} htmlFor="s-ret" hint={t('Photos are deleted automatically after this period.', 'По истечении срока фото удаляются автоматически.')}>
              <Select id="s-ret" value={String(s.retentionMonths)} onChange={e => set('retentionMonths', Number(e.target.value))}
                options={[3, 6, 12, 24].map(m => ({ value: String(m), label: t(`${m} months`, `${m} ${m === 3 ? 'месяца' : 'месяцев'}`) }))} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('Moderation', 'Модерация')} />
          <SettingRow title={t('AI moderation', 'AI-модерация')} description={t('Scan every upload and flag risky photos.', 'Проверять каждую загрузку и отмечать рискованные фото.')}>
            <Toggle checked={s.aiModeration} onChange={v => set('aiModeration', v)} label={t('AI moderation', 'AI-модерация')} />
          </SettingRow>
          <div className={s.aiModeration ? 'border-b border-line py-4' : 'pointer-events-none border-b border-line py-4 opacity-50'}>
            <div className="mb-2 flex justify-between text-sm">
              <label htmlFor="s-thr" className="font-semibold">{t('Hide automatically above AI score', 'Скрывать автоматически при оценке AI выше')}</label>
              <span className="font-bold tabular-nums">{s.aiThreshold}</span>
            </div>
            <input id="s-thr" type="range" min={40} max={95} step={5} value={s.aiThreshold} onChange={e => set('aiThreshold', Number(e.target.value))}
              className="w-full accent-[var(--accent)]" disabled={!s.aiModeration} />
          </div>
          <SettingRow title={t('Profanity filter', 'Фильтр мата')} description={t('Mask offensive words in captions and comments.', 'Скрывать грубые слова в подписях и комментариях.')}>
            <Toggle checked={s.profanityFilter} onChange={v => set('profanityFilter', v)} label={t('Profanity filter', 'Фильтр мата')} />
          </SettingRow>
          <SettingRow title={t('Auto-hide after reports', 'Автоскрытие по жалобам')} description={t('Hide a photo until review once it gets this many reports.', 'Скрывать фото до проверки, когда набирается столько жалоб.')}>
            <Input aria-label={t('Reports before auto-hide', 'Жалоб до автоскрытия')} type="number" inputMode="numeric" min={1} max={50} value={s.autoHideReports} onChange={num('autoHideReports', 1, 50)} className="w-20 text-center" />
          </SettingRow>
        </Card>

        <Card>
          <CardHeader title={t('Security', 'Безопасность')} />
          <SettingRow title={t('Require 2FA for admins', 'Обязательная 2FA для админов')} description={t('Admins must confirm sign-in with an authenticator app.', 'Админы подтверждают вход через приложение-аутентификатор.')}>
            <Toggle checked={s.require2fa} onChange={v => set('require2fa', v)} label={t('Require 2FA for admins', 'Обязательная 2FA для админов')} />
          </SettingRow>
          <SettingRow title={t('Admin session length', 'Длительность сессии админа')} description={t('Sign out inactive admins automatically.', 'Автоматически выходить из неактивных сессий.')}>
            <Select aria-label={t('Admin session length', 'Длительность сессии админа')} value={String(s.sessionHours)} onChange={e => set('sessionHours', Number(e.target.value))} className="w-32"
              options={[1, 4, 12, 24].map(h => ({ value: String(h), label: t(`${h} h`, `${h} ч`) }))} />
          </SettingRow>
        </Card>

        {/* Danger zone */}
        <Card className="border-danger/40 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger"><Icon name="alert" size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t('Maintenance mode', 'Режим обслуживания')} {s.maintenance && <span className="ml-1 text-danger">· {t('ON', 'ВКЛ')}</span>}</p>
              <p className="text-[13px] text-muted">{t('Guests and organizers see a maintenance page. Uploads to live events are paused.', 'Гости и организаторы видят страницу обслуживания. Загрузки на текущих событиях приостановлены.')}</p>
            </div>
            <Button variant={s.maintenance ? 'secondary' : 'danger'} onClick={() => (s.maintenance ? setMaintenance(false) : setConfirmMaintenance(true))}>
              {s.maintenance ? t('Turn off', 'Выключить') : t('Enable maintenance', 'Включить обслуживание')}
            </Button>
          </div>
        </Card>
      </div>

      {dirty && (
        <div className="notif-slide sticky bottom-4 z-20 mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface p-2 pl-4 shadow-lg">
          <span className="mr-auto text-sm font-semibold">{t('Unsaved changes', 'Есть несохранённые изменения')}</span>
          <Button size="sm" variant="ghost" onClick={() => setS(saved)}>{t('Discard', 'Отменить')}</Button>
          <Button size="sm" variant="primary" disabled={saving} onClick={() => saveSettings(s, t('Settings saved', 'Настройки сохранены'))}>{saving ? t('Saving…', 'Сохраняем…') : t('Save changes', 'Сохранить')}</Button>
        </div>
      )}

      <ConfirmDialog open={confirmMaintenance} onClose={() => setConfirmMaintenance(false)} title={t('Enable maintenance mode?', 'Включить режим обслуживания?')}
        confirmLabel={t('Enable', 'Включить')}
        description={t(`All ${s.platformName} pages will show a maintenance notice and live events will stop accepting uploads until you turn it off.`,
          `Все страницы ${s.platformName} покажут уведомление об обслуживании, а текущие события перестанут принимать фото, пока вы его не выключите.`)}
        onConfirm={() => setMaintenance(true)} />
    </>
  );
}
