# EventWall — backend

NestJS 12 · TypeScript (ESM) · Prisma 7 · PostgreSQL (Supabase) · JWT access + refresh · Google sign-in.

## Быстрый старт (локально)

```bash
npm install                 # также генерирует Prisma Client
cp .env.example .env        # заполнить секреты (см. ниже)
npm run db:local            # локальный Postgres без установки (prisma dev), печатает URL
npm run db:migrate:dev      # применить миграции
npm run db:seed -- --demo   # админ из .env + демо-организатор, события, отзывы
npm run start:dev           # http://localhost:8000/api
```

Документация API (Swagger): **http://localhost:8000/api/docs**

Секреты генерируются так (по одному на каждый `JWT_*_SECRET`):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Сервер не стартует, если секрет короче 32 символов или остался `change-me`.

## Подключение Supabase

1. Supabase → проект → **Connect** → **ORMs → Prisma**.
2. В `.env`:
   - `DATABASE_URL` — *transaction pooler* (порт **6543**, с `?pgbouncer=true`), им пользуется приложение;
   - `DIRECT_URL` — *direct / session* (порт **5432**), им пользуются миграции.
3. `npm run db:migrate` (на сервере) или `npm run db:migrate:dev` (при разработке схемы).
4. `npm run db:seed` — создаст первого админа.

Supabase используется только как PostgreSQL: вход и файлы делает сам бэкенд.

## Вход через Google

1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web application).
2. Authorized redirect URI: `{API_URL}/api/auth/google/callback` (локально `http://localhost:8000/api/auth/google/callback`).
3. `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET` в `.env`.

Поток: фронтенд открывает `GET /api/auth/google` → Google → `/api/auth/google/callback` → редирект на
`{FRONTEND_URL}/auth/callback#accessToken=…&refreshToken=…&expiresIn=…`. Токены передаются во фрагменте URL,
он не уходит на сервер и не пишется в логи. Ошибка → `{FRONTEND_URL}/login?error=…`.
`GET /api/auth/google/status` отвечает, включён ли Google, чтобы показывать или прятать кнопку.

## Авторизация

| Кто | Токен | Как получить |
| --- | --- | --- |
| Организатор / админ | `Authorization: Bearer <accessToken>` (15 мин) | `POST /auth/login`, `/auth/register`, Google |
| — обновление | `refreshToken` (30 дней, одноразовый) | `POST /auth/refresh` → новая пара |
| Гость | `Authorization: Bearer <guestToken>` (30 дней) | `POST /e/:slug/join` (+ PIN, если задан) |

- Refresh-токен хранится в базе только как хеш и **меняется при каждом обновлении**. Повторное использование старого токена = кража → отзываются все сессии этой цепочки.
- Роль и блокировка проверяются по базе на каждом запросе: блокировка в админке действует сразу.
- Админ — это роль `ADMIN` в базе (первый создаётся сидом). Правило «email на admin» во фронтенде нужно заменить на `GET /auth/me`.
- Лимиты: 10 запросов/мин на `/auth/*` и вход гостя (защита от перебора пароля и PIN), 120/мин на остальное.

## Карта API (`/api`)

| Группа | Эндпоинты | Экран фронтенда |
| --- | --- | --- |
| auth | `POST register · login · refresh · logout`, `GET me`, `GET google`, `GET google/callback` | `/login`, `/register` |
| me | `PATCH /me`, `POST /me/password`, `POST·DELETE /me/avatar`, `DELETE /me` | `/dashboard/profile` |
| events | `GET·POST /events`, `GET·PATCH·DELETE /events/:id`, `GET /events/:id/qr?format=png\|svg`, `POST /events/:id/cover`, `GET /events/:id/photos`, `PATCH /events/:id/photos/:photoId` | `/dashboard`, `/dashboard/events`, `/dashboard/create` |
| guest | `GET /e/:slug`, `POST /e/:slug/join`, `GET·POST /e/:slug/photos`, `GET /e/:slug/stream` (SSE) | `/event`, `/wall` |
| photos | `POST /photos/:id/reactions`, `GET·POST /photos/:id/comments`, `POST /photos/:id/reports`, `DELETE /photos/:id` | `/wall` |
| reviews | `GET /reviews/featured`, `POST /reviews`, `GET /reviews/mine` | лендинг, кабинет |
| content | `GET /content/:locale` | лендинг |
| admin | `stats`, `users`, `events`, `reports`, `reviews`, `content/:locale`, `settings`, `audit` | `/admin/*` |

Ответы в терминах фронтенда: enum'ы в нижнем регистре (`organizer`, `active`, `en`), файлы — абсолютные URL.

## Как работает

- **Фото**: `POST /e/:slug/photos` (multipart `files`, до `maxPerUpload` штук по `maxPhotoMb` МБ из настроек платформы). Тип проверяется по первым байтам файла (JPEG/PNG/WebP/GIF), а не по заголовку клиента. При премодерации фото ждёт одобрения организатора.
- **Живая стена**: `GET /e/:slug/stream` — Server-Sent Events `photo.published` / `photo.removed`.
- **Модерация**: гость жалуется → после `autoHideReports` жалоб фото скрывается автоматически → админ оставляет или удаляет.
- **Настройки платформы** реально действуют: режим обслуживания останавливает загрузки, `allowSignups` закрывает регистрацию, фильтр мата маскирует комментарии.
- **Журнал**: все действия админа, входы админов и автоскрытия пишутся в `AuditLog`.
- **Файлы**: `STORAGE_DRIVER=local` — папка `UPLOAD_DIR`, раздаётся по `{API_URL}/uploads/…`. Для S3/R2/Supabase Storage нужен новый класс рядом с `src/storage/local-storage.service.ts`, остальной код менять не нужно.

## Структура

```
src/
├── main.ts, app.module.ts, health.controller.ts
├── config/env.ts            проверка .env при старте
├── common/                  декораторы (@Public, @Roles, @CurrentUser…), guards, сериализация
├── prisma/                  PrismaService (адаптер pg)
├── platform/                AuditService, SettingsService, ContentService (глобальные)
├── storage/                 StorageService (абстракция) + локальный драйвер, очистка файлов
├── realtime/                SSE для живой стены
├── auth/                    вход, токены, Google
├── users/                   /me
├── events/                  события организатора, QR
├── guest/                   /e/:slug и /photos/:id
├── photos/                  формат фото для стены
├── reviews/                 отзывы и публичный контент
└── admin/                   /admin/*
prisma/schema.prisma, migrations/, seed.ts
test/app.e2e-spec.ts         e2e: auth, организатор → гость → админ, премодерация
```

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run start:dev` | сервер с перезапуском при изменениях |
| `npm run build` / `start:prod` | сборка / запуск `dist` |
| `npm run test:e2e` | e2e-тесты (только на локальной базе) |
| `npm run lint` | oxlint |
| `npm run db:local` | локальный Postgres (`prisma dev`) |
| `npm run db:migrate:dev` / `db:migrate` | миграции: разработка / продакшен |
| `npm run db:seed` | админ + контент и настройки по умолчанию (`-- --demo` — демо-данные) |
| `npm run db:studio` | Prisma Studio — просмотр данных |

## Что дальше

- AI-подписи и AI-модерация: поле `Photo.aiScore` и настройки уже есть, провайдер не подключён.
- Отправка писем (приглашения, сброс пароля, уведомления) — сейчас приглашённый завершает регистрацию сам, по своему email.
- 2FA для админов (`require2fa` пока только хранится).
- Автоудаление фото через `retentionMonths` — нужна фоновая задача.
- S3-драйвер хранилища и Redis для SSE при нескольких инстансах API.
