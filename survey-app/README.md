# Survey Client (React + Vite)

Клиентское приложение для курсовой: многостраничный сайт с авторизацией, CRUD опросов, файлами, уведомлениями и мок-API.

## Что реализовано

- Многостраничный web-клиент (`/`, `/login`, `/register`, `/polls`, `/polls/:id`, `/polls/new`, `/polls/:id/edit`, `/polls/:id/stats`, `/profile`).
- Авторизация: логин/регистрация/выход.
- Хранение `accessToken` + `refreshToken` в `localStorage`.
- Автообновление access-токена при `401` через refresh endpoint.
- CRUD опросов + пагинация + поиск.
- Работа с файлами: загрузка, отображение в UI, скачивание.
- Обработка ошибок: `401`, `404`, сетевые ошибки + toast-уведомления.
- Асинхронные состояния: загрузка и блокировки кнопок.
- Плейсхолдеры-прямоугольники под фото/графики по макету.

## Быстрый старт

```bash
npm install
npm run dev
```

## Режим без backend (по умолчанию)

Проект уже работает без сервера, потому что включен mock API.

```env
VITE_USE_MOCK_API=true
```

Тестовый аккаунт для входа в mock-режиме:

- `demo@mail.com`
- `123456`

## Переключение на реальный backend

Когда сервер будет готов, просто выключи mock-режим:

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:5000/api

VITE_AUTH_LOGIN_PATH=/auth/login
VITE_AUTH_REGISTER_PATH=/auth/register
VITE_AUTH_REFRESH_PATH=/auth/refresh
VITE_AUTH_LOGOUT_PATH=/auth/logout

VITE_POLLS_PATH=/polls
VITE_FILE_UPLOAD_PATH=/files/upload
VITE_FILE_BASE_PATH=/files
```

## Проверка качества

```bash
npm run lint
npm run build
```
