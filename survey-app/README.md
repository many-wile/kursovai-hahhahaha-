# Survey Client (React + Vite)

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

## Быстрый старт

```bash
npm install
npm run dev
```

## Переменные окружения

Создай `.env` (или `.env.local`) в корне проекта и при необходимости подстрой пути под свой сервер.

```env
VITE_API_BASE_URL=http://localhost:5000/api

VITE_AUTH_LOGIN_PATH=/auth/login
VITE_AUTH_REGISTER_PATH=/auth/register
VITE_AUTH_REFRESH_PATH=/auth/refresh
VITE_AUTH_LOGOUT_PATH=/auth/logout

VITE_POLLS_PATH=/polls

VITE_FILE_UPLOAD_PATH=/files/upload
VITE_FILE_BASE_PATH=/files
```

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
