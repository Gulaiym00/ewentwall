import type { FeaturedReview, Language, SiteContent } from './types';

// Public landing-page data, fetched on the server (no auth, cached for a minute).
// If the API is unreachable the landing falls back to the built-in texts.

/** Built-in texts used when the API can't be reached (same as the backend defaults). */
const FALLBACK: Record<Language, SiteContent> = {
  en: {
    heroTitle: 'One event. Every moment.',
    heroSubtitle: 'Let your guests create one shared live photo wall — directly from their phones. No app. No account.',
    ctaPrimary: 'Create an event',
    ctaSecondary: 'See how it works',
    faq: [
      { q: 'Do guests need to create an account?', a: 'No. Guests simply scan the QR code and instantly access the event.' },
      { q: 'Is the photo wall updated in real time?', a: 'Yes. New photos appear on the live wall within seconds of being uploaded.' },
      { q: 'How long are photos stored?', a: 'Photos are stored for 12 months after the event.' },
    ],
  },
  ru: {
    heroTitle: 'Одно событие. Каждый момент.',
    heroSubtitle: 'Гости создают общую живую фотостену прямо со своих телефонов. Без приложений и регистрации.',
    ctaPrimary: 'Создать событие',
    ctaSecondary: 'Как это работает',
    faq: [
      { q: 'Гостям нужно регистрироваться?', a: 'Нет. Достаточно отсканировать QR-код, и гость сразу попадает на событие.' },
      { q: 'Фотостена обновляется в реальном времени?', a: 'Да. Новые фото появляются на стене через несколько секунд после загрузки.' },
      { q: 'Сколько хранятся фотографии?', a: 'Фото хранятся 12 месяцев после события.' },
    ],
  },
};

const API_URL = (process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/$/, '');

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function getSiteContent(locale: Language = 'en'): Promise<SiteContent> {
  return (await getJson<SiteContent>(`/content/${locale}`)) ?? FALLBACK[locale];
}

export async function getFeaturedReviews(): Promise<FeaturedReview[]> {
  return (await getJson<FeaturedReview[]>('/reviews/featured')) ?? [];
}
