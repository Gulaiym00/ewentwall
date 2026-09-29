import type { Translate } from './locale';

// Display names for API enums in the interface language.

const pick = (t: Translate, map: Record<string, [string, string]>, key: string) => {
  const pair = map[key];
  return pair ? t(pair[0], pair[1]) : key;
};

const ROLES: Record<string, [string, string]> = {
  guest: ['guest', 'гость'], organizer: ['organizer', 'организатор'], admin: ['admin', 'админ'],
};
const USER_STATUSES: Record<string, [string, string]> = {
  active: ['Active', 'Активен'], pending: ['Pending', 'Ожидает'], blocked: ['Blocked', 'Заблокирован'],
};
const EVENT_STATUSES: Record<string, [string, string]> = {
  upcoming: ['Upcoming', 'Скоро'], active: ['Active', 'Идёт'], closed: ['Closed', 'Завершено'], flagged: ['Flagged', 'Под проверкой'],
};
const PHOTO_STATUSES: Record<string, [string, string]> = {
  pending: ['Pending', 'На проверке'], published: ['Published', 'Опубликовано'], hidden: ['Hidden', 'Скрыто'], removed: ['Removed', 'Удалено'],
};
const REPORT_REASONS: Record<string, [string, string]> = {
  inappropriate: ['Inappropriate', 'Неприемлемое'], spam: ['Spam', 'Спам'], copyright: ['Copyright', 'Авторские права'],
  privacy: ['Privacy', 'Приватность'], violence: ['Violence', 'Насилие'],
};
const REVIEW_STATUSES: Record<string, [string, string]> = {
  pending: ['Pending', 'На проверке'], approved: ['Approved', 'Одобрен'], published: ['Published', 'Опубликован'],
  featured: ['Featured', 'На главной'], rejected: ['Rejected', 'Отклонён'], hidden: ['Hidden', 'Скрыт'],
};
const EVENT_TYPES: Record<string, [string, string]> = {
  Wedding: ['Wedding', 'Свадьба'], Birthday: ['Birthday', 'День рождения'], Corporate: ['Corporate', 'Корпоратив'],
  Concert: ['Concert', 'Концерт'], Anniversary: ['Anniversary', 'Годовщина'], Party: ['Party', 'Вечеринка'],
  Conference: ['Conference', 'Конференция'], Graduation: ['Graduation', 'Выпускной'], Private: ['Private', 'Частное'], 'Private Party': ['Private Party', 'Частная вечеринка'], Other: ['Other', 'Другое'],
};

export const roleLabel = (t: Translate, v: string) => pick(t, ROLES, v);
export const userStatusLabel = (t: Translate, v: string) => pick(t, USER_STATUSES, v);
export const eventStatusLabel = (t: Translate, v: string) => pick(t, EVENT_STATUSES, v);
export const photoStatusLabel = (t: Translate, v: string) => pick(t, PHOTO_STATUSES, v);
export const reportReasonLabel = (t: Translate, v: string) => pick(t, REPORT_REASONS, v);
export const reviewStatusLabel = (t: Translate, v: string) => pick(t, REVIEW_STATUSES, v);
export const eventTypeLabel = (t: Translate, v: string) => pick(t, EVENT_TYPES, v);

// Audit entries are stored in English by the backend; show the known phrases in Russian.
const AUDIT_EXACT: Record<string, string> = {
  'Signed in': 'Вход в систему',
  'Failed admin sign-in': 'Неудачный вход админа',
  'Blocked user': 'Заблокировал(а) пользователя',
  'Unblocked user': 'Разблокировал(а) пользователя',
  'Deleted user': 'Удалил(а) пользователя',
  'Closed event': 'Завершил(а) событие',
  'Flagged event': 'Отметил(а) событие',
  'Cleared flag': 'Снял(а) отметку',
  'Deleted event': 'Удалил(а) событие',
  'Published review': 'Опубликовал(а) отзыв',
  'Hid review': 'Скрыл(а) отзыв',
  'Featured review on landing': 'Вывел(а) отзыв на главную',
  'Removed review from landing': 'Убрал(а) отзыв с главной',
  'Updated review': 'Изменил(а) отзыв',
  'Deleted review': 'Удалил(а) отзыв',
  'Enabled maintenance mode': 'Включил(а) режим обслуживания',
  'Disabled maintenance mode': 'Выключил(а) режим обслуживания',
  'Admin console': 'Админка',
  'Website content': 'Контент сайта',
  'Platform settings': 'Настройки платформы',
};
const AUDIT_PATTERNS: [RegExp, (...m: string[]) => string][] = [
  [/^Invited (\w+)$/, r => `Пригласил(а): ${ROLES[r]?.[1] ?? r}`],
  [/^Changed role (\w+) → (\w+)$/, (a, b) => `Сменил(а) роль: ${ROLES[a]?.[1] ?? a} → ${ROLES[b]?.[1] ?? b}`],
  [/^Set status (\w+)$/, s => `Сменил(а) статус: ${EVENT_STATUSES[s]?.[1] ?? s}`],
  [/^(Kept|Removed|Reopened) (\d+ photos|photo)$/, (v, w) =>
    `${{ Kept: 'Оставил(а)', Removed: 'Убрал(а)', Reopened: 'Вернул(а) на проверку' }[v]} ${w === 'photo' ? 'фото' : w.replace('photos', 'фото')}`],
  [/^Updated landing content \((\w+)\)$/, l => `Изменил(а) контент главной (${l})`],
  [/^Changed (.+)$/, f => `Изменил(а): ${f}`],
  [/^Auto-hid photo after (\d+) reports$/, n => `Фото скрыто автоматически после ${n} жалоб`],
];

export function auditText(t: Translate, text: string): string {
  if (t.locale !== 'ru') return text;
  if (AUDIT_EXACT[text]) return AUDIT_EXACT[text];
  for (const [re, fn] of AUDIT_PATTERNS) {
    const m = text.match(re);
    if (m) return fn(...m.slice(1));
  }
  return text;
}
