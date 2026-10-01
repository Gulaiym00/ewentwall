import type { Language } from '@/api/types';

// Landing-page translations. Hero title, subtitle, buttons and FAQ are edited in
// Admin → Website content; everything else on the landing lives here.

export const LOCALE_COOKIE = 'lang';
export const LOCALES: Language[] = ['en', 'ru'];

export const isLocale = (v: unknown): v is Language => v === 'en' || v === 'ru';

/** Cookie wins; otherwise the browser's preferred language; otherwise English. */
export function pickLocale(cookie: string | undefined, acceptLanguage: string | null): Language {
  if (isLocale(cookie)) return cookie;
  return /^\s*ru\b/i.test(acceptLanguage ?? '') ? 'ru' : 'en';
}

/** Remember the choice for a year; read by the server on the next render. */
export function saveLocale(locale: Language) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export const intlLocale = (locale: Language) => (locale === 'ru' ? 'ru-RU' : 'en-US');

const en = {
  meta: {
    title: 'EventWall — live photo wall for your event',
    description: 'Let your guests create one shared live photo wall — directly from their phones.',
  },
  header: {
    nav: [
      { id: 'how-it-works', label: 'How it works' },
      { id: 'features', label: 'Features' },
      { id: 'examples', label: 'Examples' },
      { id: 'reviews', label: 'Reviews' },
      { id: 'faq', label: 'FAQ' },
    ],
    home: 'EventWall — home',
    switchLanguage: 'Switch language',
    lightMode: 'Switch to light mode',
    darkMode: 'Switch to dark mode',
    signIn: 'Sign in',
    createEvent: 'Create Event',
    menu: 'Menu',
  },
  hero: {
    badge: 'Live photo sharing',
    trustedBefore: 'Trusted by',
    trustedAfter: 'events',
    trustedCount: '2,400+',
    photos: '1,248 photos',
    scanShare: 'Scan & share',
    join: 'Join the event',
  },
  eventTypes: {
    title: 'Perfect for every occasion',
    items: ['Weddings', 'Birthdays', 'Concerts', 'Corporate', 'Private'],
  },
  howItWorks: {
    eyebrow: 'How it works',
    title: 'Three steps to a living memory.',
    subtitle: 'From setup to a gallery full of moments — in minutes, not hours.',
    qrCaption: 'Scan to share photos',
    steps: [
      { title: 'Create your event', desc: 'Set the name, date, and style. Customize settings like moderation, comments, and guest controls. Takes 2 minutes.' },
      { title: 'Share the QR code', desc: 'Print it on tables, display it on screen, or send the link. Guests scan and are instantly inside — no account needed.' },
      { title: 'Collect every moment', desc: 'Guests upload photos from their phones. The live wall updates in real time. React, comment, and treasure every memory.' },
    ],
  },
  features: {
    eyebrow: 'Features',
    title: 'Everything your event needs.',
    items: [
      { title: 'Live Photo Wall', desc: 'Beautiful masonry gallery updating in real time as guests upload.' },
      { title: 'Instant Upload', desc: 'Take a photo or choose from gallery. No app, no account needed.' },
      { title: 'Reactions & Comments', desc: 'Heart, fire, laugh — let guests react and comment on every moment.' },
      { title: 'AI Captions', desc: 'Generate beautiful captions instantly with a single tap.' },
      { title: 'Digital Album', desc: 'Auto-generated editorial album with chapter structure and cover.' },
      { title: 'Slideshow Mode', desc: 'Project photos live on screen during the event in fullscreen.' },
    ],
  },
  wallPreview: {
    eyebrow: 'Live wall preview',
    title: 'Your event in real time.',
    live: 'LIVE · 1,248 photos',
    view: 'View live wall',
  },
  testimonials: {
    eyebrow: 'Reviews',
    title: 'Loved by event organizers.',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Common questions.',
  },
  finalCta: {
    eyebrow: 'Get started',
    titleTop: 'Make your event',
    titleBottom: 'unforgettable.',
    subtitle: 'Free to start. No credit card. Your event, every memory — one beautiful wall.',
    primary: 'Create your event',
    secondary: 'See guest view',
    checklist: ['Free to start', 'No app download', 'Setup in 2 minutes', 'Cancel anytime'],
  },
  footer: {
    rights: 'All rights reserved.',
    links: ['Privacy', 'Terms', 'Contact'],
  },
};

export type LandingDict = typeof en;

const ru: LandingDict = {
  meta: {
    title: 'EventWall — живая фотостена для вашего события',
    description: 'Гости создают общую живую фотостену прямо со своих телефонов.',
  },
  header: {
    nav: [
      { id: 'how-it-works', label: 'Как это работает' },
      { id: 'features', label: 'Возможности' },
      { id: 'examples', label: 'Примеры' },
      { id: 'reviews', label: 'Отзывы' },
      { id: 'faq', label: 'Вопросы' },
    ],
    home: 'EventWall — на главную',
    switchLanguage: 'Сменить язык',
    lightMode: 'Светлая тема',
    darkMode: 'Тёмная тема',
    signIn: 'Войти',
    createEvent: 'Создать событие',
    menu: 'Меню',
  },
  hero: {
    badge: 'Фото в реальном времени',
    trustedBefore: 'Нам доверяют',
    trustedAfter: 'событий',
    trustedCount: '2 400+',
    photos: '1 248 фото',
    scanShare: 'Сканируй и делись',
    join: 'Присоединиться',
  },
  eventTypes: {
    title: 'Подходит для любого повода',
    items: ['Свадьбы', 'Дни рождения', 'Концерты', 'Корпоративы', 'Частные вечеринки'],
  },
  howItWorks: {
    eyebrow: 'Как это работает',
    title: 'Три шага к живым воспоминаниям.',
    subtitle: 'От создания до галереи, полной моментов, — за минуты, а не часы.',
    qrCaption: 'Сканируйте и делитесь фото',
    steps: [
      { title: 'Создайте событие', desc: 'Укажите название, дату и стиль. Настройте модерацию, комментарии и правила для гостей. Займёт 2 минуты.' },
      { title: 'Поделитесь QR-кодом', desc: 'Распечатайте его на столы, покажите на экране или отправьте ссылку. Гости сканируют и сразу попадают внутрь — без регистрации.' },
      { title: 'Соберите каждый момент', desc: 'Гости загружают фото с телефонов, стена обновляется в реальном времени. Реакции, комментарии и воспоминания — в одном месте.' },
    ],
  },
  features: {
    eyebrow: 'Возможности',
    title: 'Всё, что нужно вашему событию.',
    items: [
      { title: 'Живая фотостена', desc: 'Красивая галерея, которая обновляется в реальном времени по мере загрузки фото.' },
      { title: 'Мгновенная загрузка', desc: 'Сделайте снимок или выберите из галереи. Без приложения и регистрации.' },
      { title: 'Реакции и комментарии', desc: 'Сердечки, огонь, смех — гости реагируют и комментируют каждый момент.' },
      { title: 'AI-подписи', desc: 'Красивые подписи к фото одним нажатием.' },
      { title: 'Цифровой альбом', desc: 'Альбом собирается автоматически: главы, обложка, лучшие кадры.' },
      { title: 'Режим слайд-шоу', desc: 'Показывайте фото на большом экране во время события.' },
    ],
  },
  wallPreview: {
    eyebrow: 'Живая стена',
    title: 'Ваше событие в реальном времени.',
    live: 'LIVE · 1 248 фото',
    view: 'Открыть живую стену',
  },
  testimonials: {
    eyebrow: 'Отзывы',
    title: 'Организаторы нас любят.',
  },
  faq: {
    eyebrow: 'Вопросы',
    title: 'Частые вопросы.',
  },
  finalCta: {
    eyebrow: 'Начните сейчас',
    titleTop: 'Сделайте событие',
    titleBottom: 'незабываемым.',
    subtitle: 'Бесплатный старт. Без карты. Ваше событие и все воспоминания — на одной красивой стене.',
    primary: 'Создать событие',
    secondary: 'Посмотреть как гость',
    checklist: ['Бесплатный старт', 'Без приложения', 'Запуск за 2 минуты', 'Отмена в любой момент'],
  },
  footer: {
    rights: 'Все права защищены.',
    links: ['Конфиденциальность', 'Условия', 'Контакты'],
  },
};

export const landingDict: Record<Language, LandingDict> = { en, ru };
