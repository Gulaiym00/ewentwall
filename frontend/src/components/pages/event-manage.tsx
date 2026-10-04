'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorMessage } from '@/api/client';
import { eventsApi } from '@/api/events';
import type { EventInput, OrganizerEvent } from '@/api/types';
import { copyText, QrActions, useEventQr } from '@/components/EventQr';
import { useToast } from '@/components/Toast';
import { useApi } from '@/hooks/useApi';
import { useOrganizer } from '@/hooks/useOrganizer';
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Input, PageHeader, SettingRow, Toggle, type Tone } from '@/ui';
import { Icon } from '@/ui/icons';
import { LoadError, PageLoader, Spinner } from '@/ui/loader';
import { formatDate } from '@/utils/format';
import { useT } from '@/utils/locale';
import { eventTypeLabel } from '@/utils/labels';

const STATUS: Record<OrganizerEvent['status'], { label: string; ru: string; tone: Tone }> = {
  active: { label: 'Active', ru: 'Идёт', tone: 'success' },
  upcoming: { label: 'Upcoming', ru: 'Скоро', tone: 'warning' },
  closed: { label: 'Closed', ru: 'Завершено', tone: 'neutral' },
  flagged: { label: 'Under review', ru: 'На проверке', tone: 'danger' },
};

type GuestSetting = { key: keyof OrganizerEvent['settings'] & keyof EventInput; title: [string, string]; description: [string, string] };
const GUEST_SETTINGS: GuestSetting[] = [
  { key: 'premoderation', title: ['Pre-moderation', 'Премодерация'], description: ['Photos appear on the wall only after you approve them.', 'Фото появляются на стене только после вашего одобрения.'] },
  { key: 'allowComments', title: ['Comments', 'Комментарии'], description: ['Guests can comment on photos.', 'Гости могут комментировать фото.'] },
  { key: 'allowReactions', title: ['Reactions', 'Реакции'], description: ['Guests can react with emoji.', 'Гости могут ставить эмодзи-реакции.'] },
  { key: 'askGuestName', title: ['Ask guest name', 'Спрашивать имя'], description: ['Guests must enter a name before they upload.', 'Гости обязательно вводят имя перед загрузкой.'] },
  { key: 'allowDownloads', title: ['Allow downloads', 'Разрешить скачивание'], description: ['Guests can download photos from the wall.', 'Гости могут скачивать фото со стены.'] },
];

export default function EventManage({ id }: { id: string }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const { reloadEvents } = useOrganizer();
  const event = useApi(() => eventsApi.get(id), [id]);
  const pending = useApi(() => eventsApi.photos(id, 'pending'), [id]);
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'close' | null>(null);

  const qrUrl = useEventQr(event.data?.joinUrl);

  if (event.loading && !event.data) return <PageLoader label={t('Loading event…', 'Загружаем событие…')} />;
  if (event.error && !event.data) return <LoadError message={event.error.message} onRetry={event.reload} />;
  const ev = event.data!;

  const save = async (patch: EventInput, message: string) => {
    setSaving(true);
    try {
      const updated = await eventsApi.update(id, patch);
      event.setData(() => updated);
      reloadEvents();
      toast(message);
      if ('premoderation' in patch) pending.reload();
    } catch (err) {
      toast(errorMessage(err), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const moderate = async (photoId: string, status: 'published' | 'removed') => {
    try {
      await eventsApi.moderatePhoto(id, photoId, status);
      pending.setData(list => list?.filter(p => p.id !== photoId));
      event.reload();
      reloadEvents();
      toast(status === 'published' ? t('Photo is on the wall', 'Фото на стене') : t('Photo removed', 'Фото удалено'), status === 'published' ? 'success' : 'danger');
    } catch (err) {
      toast(errorMessage(err), 'danger');
    }
  };

  const copyLink = async () => {
    if (await copyText(ev.joinUrl)) toast(t('Guest link copied', 'Ссылка для гостей скопирована'));
    else toast(t('Copy failed — tap the link above to select it', 'Не удалось скопировать — нажмите на ссылку выше, чтобы выделить её'), 'danger');
  };

  const s = STATUS[ev.status];
  const pendingPhotos = pending.data ?? [];

  return (
    <>
      <Link href="/dashboard/events" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <Icon name="arrowLeft" size={16} /> {t('My events', 'Мои события')}
      </Link>
      <PageHeader
        title={ev.name}
        description={[eventTypeLabel(t, ev.type), ev.startsAt && formatDate(ev.startsAt.slice(0, 10)), ev.location].filter(Boolean).join(' · ')}
        actions={<>
          <Link href={`/e/${ev.slug}/wall`} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-surface px-4 text-sm font-semibold hover:bg-bg">
            <Icon name="grid" size={16} /> {t('Live wall', 'Живая стена')}
          </Link>
          <Link href={`/e/${ev.slug}`} className="btn-press inline-flex h-10 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-white">
            <Icon name="external" size={16} /> {t('Guest page', 'Страница гостя')}
          </Link>
        </>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={s.tone} dot>{t(s.label, s.ru)}</Badge>
        <span className="text-sm text-muted">
          {t.count(ev.stats.photos, ['photo', 'photos'], ['фото', 'фото', 'фото'])} · {t.count(ev.stats.guests, ['guest', 'guests'], ['гость', 'гостя', 'гостей'])} · {t.count(ev.stats.reactions, ['reaction', 'reactions'], ['реакция', 'реакции', 'реакций'])}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          {/* Pending photos */}
          {(ev.settings.premoderation || pendingPhotos.length > 0) && (
            <Card>
              <CardHeader title={`${t('Waiting for approval', 'Ждут одобрения')} · ${pendingPhotos.length}`} />
              {pending.loading && !pending.data ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : pendingPhotos.length === 0 ? (
                <EmptyState icon="check" title={t('Nothing to approve', 'Проверять нечего')} description={t('New guest photos will show up here before they reach the wall.', 'Новые фото гостей появятся здесь до публикации на стене.')} />
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {pendingPhotos.map(p => (
                    <li key={p.id} className="overflow-hidden rounded-xl border border-line">
                      <img src={p.thumbUrl} alt={p.caption ?? ''} className="aspect-square w-full bg-line object-cover" />
                      <div className="p-2">
                        <p className="mb-2 truncate text-xs text-muted">{p.author}{p.caption ? ` · ${p.caption}` : ''}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <Button size="sm" variant="primary" onClick={() => moderate(p.id, 'published')}>{t('Approve', 'Одобрить')}</Button>
                          <Button size="sm" onClick={() => moderate(p.id, 'removed')}>{t('Remove', 'Удалить')}</Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Guest settings */}
          <Card>
            <CardHeader title={t('Guest settings', 'Настройки для гостей')} action={saving ? <Spinner size={16} /> : undefined} />
            {GUEST_SETTINGS.map(g => {
              const title = t(...g.title);
              return (
                <SettingRow key={g.key} title={title} description={t(...g.description)}>
                  <Toggle checked={ev.settings[g.key]} label={title} onChange={v => save({ [g.key]: v }, `${title}: ${v ? t('on', 'вкл') : t('off', 'выкл')}`)} />
                </SettingRow>
              );
            })}
            <SettingRow title={t('PIN protection', 'Защита PIN-кодом')}
              description={ev.settings.pinRequired ? t('Guests need a PIN to join.', 'Гостям нужен PIN для входа.') : t('Anyone with the link or QR can join.', 'Войти может любой, у кого есть ссылка или QR.')}>
              {ev.settings.pinRequired
                ? <Button size="sm" onClick={() => save({ pin: null }, t('PIN removed', 'PIN удалён'))}>{t('Remove PIN', 'Убрать PIN')}</Button>
                : (
                  <form className="flex gap-2" onSubmit={e => { e.preventDefault(); save({ pin }, t('PIN set', 'PIN установлен')); setPin(''); }}>
                    <Input aria-label={t('New PIN', 'Новый PIN')} inputMode="numeric" pattern="\d{4,6}" placeholder={t('4–6 digits', '4–6 цифр')} value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-28" />
                    <Button size="sm" type="submit" disabled={pin.length < 4}>{t('Set', 'Задать')}</Button>
                  </form>
                )}
            </SettingRow>
          </Card>
        </div>

        {/* QR & event actions */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-[84px] lg:self-start">
          <Card>
            <CardHeader title={t('QR code', 'QR-код')} />
            <div className="mx-auto flex aspect-square w-full max-w-[240px] items-center justify-center rounded-xl bg-white p-2">
              {qrUrl ? <img src={qrUrl} alt={t(`QR code for ${ev.name}`, `QR-код для ${ev.name}`)} className="h-full w-full" /> : <Spinner />}
            </div>
            <p className="mt-3 text-center text-xs break-all text-muted select-all">{ev.joinUrl}</p>
            <QrActions event={ev} qrUrl={qrUrl} onCopy={copyLink} />
          </Card>

          <Card>
            <CardHeader title={t('Event', 'Событие')} />
            <div className="flex flex-col gap-2">
              {ev.status === 'closed'
                ? <Button onClick={() => save({ status: 'active' }, t('Event reopened', 'Событие снова открыто'))}>{t('Reopen uploads', 'Снова открыть загрузки')}</Button>
                : ev.status !== 'flagged' && <Button icon="lock" onClick={() => setConfirm('close')}>{t('Close event', 'Завершить событие')}</Button>}
              {ev.status === 'flagged' && <p className="text-[13px] text-muted">{t('An admin is reviewing reports on this event.', 'Администратор проверяет жалобы на это событие.')}</p>}
              <Button variant="ghost" icon="trash" className="text-danger hover:text-danger" onClick={() => setConfirm('delete')}>{t('Delete event', 'Удалить событие')}</Button>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog open={confirm === 'close'} onClose={() => setConfirm(null)} tone="primary" title={t('Close event?', 'Завершить событие?')} confirmLabel={t('Close event', 'Завершить')}
        description={t('Guests will no longer be able to upload. The wall stays viewable and you can reopen it later.', 'Гости больше не смогут загружать фото. Стена останется доступной, а событие можно будет снова открыть.')}
        onConfirm={() => save({ status: 'closed' }, t('Event closed', 'Событие завершено'))} />
      <ConfirmDialog open={confirm === 'delete'} onClose={() => setConfirm(null)} title={t('Delete event?', 'Удалить событие?')} confirmLabel={t('Delete event', 'Удалить')}
        description={t(`“${ev.name}” and all ${ev.stats.photos} photos will be permanently deleted. Guests will lose access to the wall.`,
          `«${ev.name}» и все фото (${ev.stats.photos}) будут удалены навсегда. Гости потеряют доступ к стене.`)}
        onConfirm={async () => {
          try {
            await eventsApi.remove(id);
            reloadEvents();
            toast(t('Event deleted', 'Событие удалено'), 'danger');
            router.replace('/dashboard/events');
          } catch (err) {
            toast(errorMessage(err), 'danger');
          }
        }} />
    </>
  );
}
