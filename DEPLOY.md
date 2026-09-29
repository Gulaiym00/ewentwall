# Деплой EventWall

Схема: **Supabase** (база данных и фото) → **Render** (бэкенд, NestJS) → **Vercel** (фронтенд, Next.js).
Делайте шаги по порядку: каждому следующему сервису нужны адреса из предыдущего.

## 1. Supabase — база данных и хранилище фото

1. Зарегистрируйтесь на [supabase.com](https://supabase.com) и создайте проект (регион — Frankfurt / EU Central). Запомните пароль базы.
2. **Connect → ORMs → Prisma** — скопируйте две строки:
   - `DATABASE_URL` — пулер, порт **6543** (с `?pgbouncer=true`);
   - `DIRECT_URL` — прямое подключение, порт **5432**.
   В обе строки вместо `[YOUR-PASSWORD]` подставьте пароль базы.
3. **Project Settings → API**:
   - `Project URL` → это `SUPABASE_URL`;
   - ключ `service_role` (secret) → это `SUPABASE_SERVICE_ROLE_KEY`. Никому его не показывайте.

Бакет `photos` для фото бэкенд создаст сам при первом запуске.

## 2. Render — бэкенд

1. Зарегистрируйтесь на [render.com](https://render.com) через GitHub.
2. **New → Blueprint** → выберите репозиторий `ewent-wall`. Render прочитает `render.yaml`.
3. Заполните значения, которые он спросит:

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | строка с портом 6543 из Supabase |
| `DIRECT_URL` | строка с портом 5432 из Supabase |
| `FRONTEND_URL` | пока `https://example.com`, после шага 3 — адрес сайта на Vercel |
| `API_URL` | адрес сервиса на Render, обычно `https://eventwall-api.onrender.com` (без `/api`; точный адрес видно в карточке сервиса) |
| `ADMIN_EMAIL` | email администратора |
| `ADMIN_PASSWORD` | пароль администратора, **не короче 12 символов** |
| `SUPABASE_URL` | Project URL из Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ключ service_role из Supabase |

Секреты JWT Render сгенерирует сам. Проверка: `https://eventwall-api.onrender.com/api/health` должен ответить `{"status":"ok","database":"up"}`.

> Бесплатный сервер Render засыпает после 15 минут без запросов; первый запрос после этого идёт около минуты.

## 3. Vercel — фронтенд

1. Зарегистрируйтесь на [vercel.com](https://vercel.com) через GitHub.
2. **Add New → Project** → импортируйте репозиторий `ewent-wall`.
3. **Root Directory** → `frontend` (Framework определится как Next.js).
4. **Environment Variables**: `NEXT_PUBLIC_API_URL` = `https://eventwall-api.onrender.com/api`
5. **Deploy**. Получите адрес вида `https://ewent-wall.vercel.app`.

## 4. Связать фронтенд и бэкенд

На Render → сервис `eventwall-api` → **Environment** → `FRONTEND_URL` = адрес сайта на Vercel (без `/` в конце) → **Save**. Сервис перезапустится.

От `FRONTEND_URL` зависят разрешение запросов с сайта (CORS) и ссылки в QR-кодах.

## Обновления

`git push` в ветку `main` — Render и Vercel сами пересоберут проект.
