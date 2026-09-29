'use client';

import { useState } from 'react';
import { errorMessage } from '@/api/client';
import { reviewsApi, type MyReview } from '@/api/reviews';
import type { OrganizerEvent } from '@/api/types';
import { useApi } from '@/hooks/useApi';
import { Icon } from '@/ui/icons';
import { Badge, Button, Field, Select, Textarea, type Tone } from '@/ui';
import { useT } from '@/utils/locale';

const MIN_TEXT = 10;
const MAX_TEXT = 1000;

const STATUS: Record<MyReview['status'], { tone: Tone; en: string; ru: string }> = {
  pending: { tone: 'warning', en: 'Under review', ru: 'На проверке' },
  published: { tone: 'success', en: 'Published', ru: 'Опубликован' },
  hidden: { tone: 'neutral', en: 'Not published', ru: 'Не опубликован' },
};

/** Dashboard card where an organizer rates the service; approved reviews appear on the landing page. */
export default function ReviewCard({ events }: { events: OrganizerEvent[] }) {
  const t = useT();
  const mine = useApi(() => reviewsApi.mine(), []);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [eventId, setEventId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [writing, setWriting] = useState(false);

  const reviews = mine.data ?? [];
  const showForm = writing || (!mine.loading && reviews.length === 0);
  const tooShort = text.trim().length < MIN_TEXT;

  const submit = async () => {
    if (!rating) return setError(t('Choose a rating from 1 to 5 stars.', 'Выберите оценку от 1 до 5 звёзд.'));
    if (tooShort) return setError(t(`Write at least ${MIN_TEXT} characters.`, `Напишите хотя бы ${MIN_TEXT} символов.`));
    setSending(true);
    setError('');
    try {
      await reviewsApi.create({ rating, text: text.trim(), eventId: eventId || undefined });
      setRating(0);
      setText('');
      setEventId('');
      setWriting(false);
      mine.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 min-w-0 rounded-2xl border border-line bg-surface p-5 md:mt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13px] font-bold tracking-wider text-muted uppercase">{t('Your review', 'Ваш отзыв')}</p>
        {!showForm && (
          <Button size="sm" icon="plus" onClick={() => setWriting(true)}>{t('Write another', 'Написать ещё')}</Button>
        )}
      </div>

      {reviews.length > 0 && (
        <ul className="mb-4 flex flex-col gap-3">
          {reviews.map(r => (
            <li key={r.id} className="rounded-xl border border-line p-3">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-accent" aria-label={t(`${r.rating} of 5`, `${r.rating} из 5`)}>
                  {[1, 2, 3, 4, 5].map(n => <Icon key={n} name="star" size={14} filled={n <= r.rating} className="inline-block" />)}
                </span>
                <Badge tone={STATUS[r.status].tone} dot>{t(STATUS[r.status].en, STATUS[r.status].ru)}</Badge>
              </div>
              <p className="text-sm break-words whitespace-pre-line">{r.text}</p>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {t('How was EventWall at your event? After a quick check your review may appear on the home page.',
              'Как вам EventWall на вашем событии? После проверки отзыв может появиться на главной странице.')}
          </p>

          <div>
            <p className="mb-2 text-sm font-semibold">{t('Rating', 'Оценка')}</p>
            <div className="flex gap-1" role="radiogroup" aria-label={t('Rating', 'Оценка')} onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t(`${n} of 5`, `${n} из 5`)}
                  onClick={() => { setRating(n); setError(''); }} onMouseEnter={() => setHover(n)}
                  className="btn-press rounded-lg p-1 text-accent">
                  <Icon name="star" size={28} filled={n <= (hover || rating)} />
                </button>
              ))}
            </div>
          </div>

          {events.length > 0 && (
            <Field label={t('Event (optional)', 'Событие (необязательно)')} htmlFor="review-event">
              <Select id="review-event" value={eventId} onChange={e => setEventId(e.target.value)}
                options={[{ value: '', label: t('Not about a specific event', 'Без привязки к событию') }, ...events.map(e => ({ value: e.id, label: e.name }))]} />
            </Field>
          )}

          <Field label={t('Your review', 'Ваш отзыв')} htmlFor="review-text" hint={`${text.trim().length} / ${MAX_TEXT}`}>
            <Textarea id="review-text" rows={4} maxLength={MAX_TEXT} value={text} onChange={e => { setText(e.target.value); setError(''); }}
              placeholder={t('What did your guests like? What could be better?', 'Что понравилось гостям? Что можно улучшить?')} />
          </Field>

          {error && <p className="text-sm font-medium text-danger" role="alert">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={submit} disabled={sending}>
              {sending ? t('Sending…', 'Отправляем…') : t('Send review', 'Отправить отзыв')}
            </Button>
            {writing && reviews.length > 0 && (
              <Button variant="ghost" onClick={() => { setWriting(false); setError(''); }} disabled={sending}>{t('Cancel', 'Отмена')}</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
