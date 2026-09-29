import type { Language } from '@/api/types';

// The interface language, set by LocaleProvider in the browser (formatting happens client-side).
let active: Language = 'en';
export const setFormatLocale = (l: Language) => { active = l; };
const intl = () => (active === 'ru' ? 'ru-RU' : 'en-US');
const ru = () => active === 'ru';

/** "2026-09-25" → "Sep 25, 2026". Parsed as a local date, so it never shifts a day across time zones. */
export const formatDate = (isoDate: string) =>
  new Date(isoDate + 'T00:00:00').toLocaleDateString(intl(), { month: 'short', day: 'numeric', year: 'numeric' });

/** "September 24, 2026" / "24 сентября 2026 г." */
export const formatLongDate = (iso: string) =>
  new Date(iso).toLocaleDateString(intl(), { month: 'long', day: 'numeric', year: 'numeric' });

/** Date and time in the interface language. */
export const formatDateTime = (iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) =>
  new Date(iso).toLocaleString(intl(), opts);

/** 1248 → "1,248" */
export const formatNumber = (value: number) => value.toLocaleString(intl());

/** "Just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return ru() ? 'Только что' : 'Just now';
  if (s < 3600) return ru() ? `${Math.round(s / 60)} мин назад` : `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return ru() ? `${Math.round(s / 3600)} ч назад` : `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86_400) {
    const d = Math.round(s / 86_400);
    return ru() ? `${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'} назад` : `${d} day${d === 1 ? '' : 's'} ago`;
  }
  return formatDate(iso.slice(0, 10));
}

const RU_WORDS: Record<string, [string, string, string]> = {
  photo: ['фото', 'фото', 'фото'],
  guest: ['гость', 'гостя', 'гостей'],
  event: ['событие', 'события', 'событий'],
  reaction: ['реакция', 'реакции', 'реакций'],
  comment: ['комментарий', 'комментария', 'комментариев'],
  user: ['пользователь', 'пользователя', 'пользователей'],
  report: ['жалоба', 'жалобы', 'жалоб'],
  review: ['отзыв', 'отзыва', 'отзывов'],
  upload: ['загрузка', 'загрузки', 'загрузок'],
  day: ['день', 'дня', 'дней'],
};

/** 1 → "1 photo", 3 → "3 photos"; in Russian "1 фото", "3 гостя" (numbers with thousands separators). */
export function plural(n: number, word: string): string {
  const forms = ru() ? RU_WORDS[word] : undefined;
  if (forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    const f = a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2;
    return `${formatNumber(n)} ${forms[f]}`;
  }
  return `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
}
