# Survey Client (React + Vite)

<<<<<<< HEAD
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
=======
Клиентское приложение для курсовой: авторизация, CRUD опросов, работа с файлами, пагинация и обработка ошибок API.

## Что реализовано

- Регистрация / логин / логаут.
- Хранение `accessToken` и `refreshToken` в `localStorage`.
- Автообновление access-токена при `401` через refresh endpoint.
- CRUD интеграция с API опросов.
- Поиск и пагинация опросов в UI.
- Загрузка и скачивание файлов (через backend API).
- UI-обработка ошибок `401`, `404`, сетевых ошибок.
- Асинхронные состояния: загрузки, блокировки кнопок, уведомления.
>>>>>>> fd1a7d8e406d806b8f5118bffb0317aed23966f3

## Быстрый старт

```bash
npm install
npm run dev
```

<<<<<<< HEAD
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
=======
## Переменные окружения

Создай `.env` (или `.env.local`) в корне проекта и при необходимости подстрой пути под свой сервер.

```env
>>>>>>> fd1a7d8e406d806b8f5118bffb0317aed23966f3
VITE_API_BASE_URL=http://localhost:5000/api

VITE_AUTH_LOGIN_PATH=/auth/login
VITE_AUTH_REGISTER_PATH=/auth/register
VITE_AUTH_REFRESH_PATH=/auth/refresh
VITE_AUTH_LOGOUT_PATH=/auth/logout

VITE_POLLS_PATH=/polls
<<<<<<< HEAD
=======

>>>>>>> fd1a7d8e406d806b8f5118bffb0317aed23966f3
VITE_FILE_UPLOAD_PATH=/files/upload
VITE_FILE_BASE_PATH=/files
```

<<<<<<< HEAD
## Проверка качества

```bash
npm run lint
npm run build
```
=======
## Ожидаемый формат ответов API

### Auth login/register/refresh

```json
{
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "user": {
    "id": 1,
    "name": "Иван",
    "email": "ivan@mail.com"
  }
}
```

### Poll list

Поддерживается один из форматов:

```json
{
  "items": [{ "id": 1, "title": "...", "description": "..." }],
  "totalCount": 42,
  "page": 1,
  "pageSize": 5
}
```

или просто массив:

```json
[{ "id": 1, "title": "...", "description": "..." }]
```

### File upload

```json
{
  "id": "file-id",
  "fileName": "document.pdf",
  "url": "https://..."
}
```

Скачивание ожидается с endpoint вида `GET /files/{id}/download`.
>>>>>>> fd1a7d8e406d806b8f5118bffb0317aed23966f3
