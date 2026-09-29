# EventWall — frontend

Next.js (App Router) + TypeScript + Tailwind CSS v4. UI перенесён из Figma Make-проекта «Prioritize MVP Design Elements».

```bash
npm install
cp .env.example .env.local   # адрес бэкенда
npm run dev                  # http://localhost:3000
```

Нужен запущенный бэкенд (`backend/`, см. его README): по умолчанию `http://localhost:8000/api`.

## Структура проекта

```
frontend/
├── app/                        РОУТИНГ — только page.tsx / layout.tsx
│   ├── layout.tsx              корень: шрифты, тема, тосты
│   ├── globals.css             дизайн-токены, тёмная тема, анимации
│   ├── (home)/page.tsx         /            лендинг
│   ├── login/                  /login
│   ├── register/               /register
│   ├── auth/callback/          /auth/callback  возврат после входа через Google
│   ├── e/[slug]/               /e/{slug}       страница гостя (ссылка из QR-кода)
│   │   └── wall/               /e/{slug}/wall  живая фотостена
│   ├── event/ · wall/          старые адреса → демо-событие (NEXT_PUBLIC_DEMO_EVENT_SLUG)
│   ├── dashboard/
│   │   ├── (shell)/            страницы с сайдбаром организатора
│   │   │   ├── layout.tsx      OrganizerShell
│   │   │   ├── page.tsx        /dashboard           обзор
│   │   │   ├── events/         /dashboard/events    мои события
│   │   │   │   └── [id]/       /dashboard/events/{id}  управление: QR, настройки, одобрение фото
│   │   │   └── profile/        /dashboard/profile   профиль
│   │   └── create/             /dashboard/create    мастер (без сайдбара)
│   └── admin/                  админка (тёмный сайдбар, noindex)
│       ├── layout.tsx          AdminShell
│       ├── page.tsx            /admin               дашборд
│       └── users · events · moderation · reviews · content · settings · audit
│
└── src/                        КОД (алиас `@/` → `src/`)
    ├── components/
    │   ├── pages/              ЭКРАНЫ целиком — их рендерит app/**/page.tsx:
    │   │   │                   landing, auth, guest-event, photo-wall, create-event,
    │   │   │                   dashboard, my-events, profile
    │   │   └── admin/          разделы админки: dashboard, users, events, moderation,
    │   │                       reviews, content, settings, audit
    │   ├── EventCard.tsx       карточка события организатора
    │   ├── ThemeProvider.tsx   светлая/тёмная тема
    │   └── Toast.tsx           уведомления useToast()
    ├── widgets/                БЛОКИ страниц: hero, event-types, how-it-works, features,
    │                           live-wall-preview, testimonials, faq, final-cta (лендинг);
    │                           uploads-chart (дашборд админки)
    ├── layout/
    │   ├── header.tsx          шапка сайта (навигация, язык, тема, вход)
    │   ├── footer.tsx          подвал сайта
    │   ├── AdminShell.tsx      каркас админки с сайдбаром
    │   └── OrganizerShell.tsx  каркас кабинета организатора с сайдбаром
    ├── hooks/
    │   ├── useAuth.ts          сессия: вход, регистрация, Google, выход (+ AuthProvider, useRequireAuth)
    │   ├── useApi.ts           загрузка данных: data / loading / error / reload
    │   ├── useAdmin.ts         счётчики админки для сайдбара (+ AdminProvider)
    │   ├── useOrganizer.ts     профиль и события организатора (+ OrganizerProvider)
    │   ├── useGuestSession.ts  токен гостя конкретного события
    │   ├── useDebounced.ts     задержка для поиска
    │   └── useNav.ts           навигация и тема для экранов
    ├── ui/                     UI-кит: index.tsx (Button, Card, Field, Modal…), icons.tsx, loader.tsx, fake-qr.tsx
    ├── utils/                  cx.ts, format.ts (даты, числа, «5 min ago»), routes.ts (карта роутов)
    └── api/
        ├── client.ts           fetch к бэкенду, автообновление токена, ошибки
        ├── session.ts          хранение токенов (пользователь и гости)
        ├── types.ts            типы ответов бэкенда
        ├── auth.ts, events.ts, guest.ts, admin.ts   запросы по разделам
        └── site.ts             контент и отзывы лендинга (на сервере, кеш 1 мин)
```

Слои и правила:
- `app/` — только URL и `metadata`. Каждый `page.tsx` — тонкий серверный компонент, который рендерит экран из `components/pages`.
- Экран собирается из виджетов (`widgets`), компонентов и UI-кита (`ui`). Данные берёт через `src/api/*` и хуки, а не вызывает `fetch` напрямую.
- Зависимости идут сверху вниз: `app → components/pages → widgets → components → ui → utils`. Нижний слой не импортирует верхний.
- Импорты только через алиас `@/`: `@/ui`, `@/widgets/hero`, `@/hooks/useAdmin`…
- Цвета — токены из `globals.css`, в Tailwind доступны как `bg-surface`, `text-muted`, `border-line`, `text-accent` и т. д.

## Роли и вход

Вход общий через `/login` (email + пароль или Google, если он настроен на бэкенде). Роль приходит с сервера: админ попадает в `/admin`, организатор — в `/dashboard`. Первого админа создаёт `npm run db:seed` на бэкенде.

- Access-токен живёт в памяти, refresh-токен — в `localStorage`; при 401 клиент сам обновляет токен (одна попытка), обновления между вкладками идут по очереди (Web Locks), выход в одной вкладке выходит во всех.
- `/dashboard/*` и `/admin/*` закрыты `useRequireAuth`: без входа — редирект на `/login?next=…`, без нужной роли — в свой раздел. Настоящая защита — на бэкенде, фронтенд только не показывает лишнее.
- Гости заходят без аккаунта по ссылке `/e/{slug}` из QR-кода; токен гостя хранится отдельно для каждого события. Если у события есть PIN, без него не видно ни фото, ни комментариев.

## Админ-панель

| Путь | Раздел |
| --- | --- |
| `/admin` | Дашборд: KPI, загрузки за 14 дней, очередь модерации, активность |
| `/admin/users` | Пользователи: поиск, фильтры, роли, блокировка, приглашения |
| `/admin/events` | События: статусы, закрытие, снятие флага, удаление |
| `/admin/moderation` | Глобальная модерация жалоб с AI-оценкой, массовые действия |
| `/admin/reviews` | Отзывы: публикация, скрытие, вывод на лендинг (до 3) |
| `/admin/content` | Контент лендинга EN/RU с живым превью |
| `/admin/settings` | Настройки платформы, режим обслуживания |
| `/admin/audit` | Журнал действий с фильтрами и экспортом CSV |

## Данные и настройки

Все данные идут с бэкенда. Переменные (`.env.local`, образец — `.env.example`):

| Переменная | Зачем |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | адрес API, по умолчанию `http://localhost:8000/api` |
| `API_URL_INTERNAL` | необязательно: адрес API для серверного рендеринга, если внутри сети он другой |
| `NEXT_PUBLIC_DEMO_EVENT_SLUG` | необязательно: демо-событие для кнопок лендинга «See guest view» / «View live wall» |

Лендинг берёт тексты (Admin → Website content) и отзывы (Admin → Reviews) с бэкенда при рендеринге на сервере и обновляется раз в минуту; если API недоступен, показывает встроенные тексты, а блок отзывов скрывается.
