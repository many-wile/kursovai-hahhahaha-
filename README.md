# Сервис для проведения опросов (Курсовой проект)

Единый репозиторий командного проекта: backend + frontend + тесты + опциональные улучшения.

## Структура проекта

- `SurveyService.Backend/SurveyService/Survey.Api` — основной WebAPI (опросы, голосование, файлы, Swagger, SignalR)
- `SurveyService.Backend/SurveyService/Survey.IdentityApi` — сервис авторизации
- `SurveyService.Backend/SurveyService/Survey.StorageApi` — сервис хранения/выдачи файлов
- `SurveyService.Backend/SurveyService/Survey.Data` — EF Core, контекст БД, миграции, репозитории
- `SurveyService.Backend/SurveyService/Survey.Models` — модели и DTO
- `SurveyService.Backend/SurveyService/Survey.Tests` — тесты (xUnit)
- `survey-app` — клиентское web-приложение (React + Vite)

## Технологии

- Backend: `ASP.NET Core`, `Entity Framework Core`, `SQLite`, `JWT`, `Swagger`, `SignalR`, `Serilog`
- Frontend: `React`, `Vite`, `React Router`, `Fetch API`, `localStorage`
- Тесты: `xUnit` (в проекте тестов)

## Как запустить

### 1) Backend

Из корня репозитория:

```powershell
dotnet run --project SurveyService.Backend\SurveyService\Survey.Api\Survey.Api.csproj --launch-profile https
```

Swagger:

- `https://localhost:7054/swagger`

### 2) Frontend

```powershell
cd survey-app
npm install
npm run dev
```

Обычно клиент поднимается на:

- `http://localhost:5173`

## Проверка

### Backend

```powershell
dotnet build SurveyService.Backend\SurveyService\Survey.Api\Survey.Api.csproj
dotnet test SurveyService.Backend\SurveyService\Survey.Tests\Survey.Tests.csproj
```

### Frontend

```powershell
cd survey-app
npm run build
```

## Реализованные требования (основные)

### Серверное приложение

- Реализовано WebAPI (CRUD операции) — **8 баллов**
- Настроена Entity Framework — **5 баллов**
- Реализована авторизация (JWT-токен, регистрация, логин, хеширование паролей) — **7 баллов**
- API соответствует REST (правильные HTTP-методы, статусы ответов) — **5 баллов**
- Подключен Swagger с описанием всех эндпоинтов — **3 балла**
- Функционал работы с файлами (загрузка/скачивание, валидация размера/типа) — **4 балла**
- Покрытие тестами NUnit/xUnit/Moq — **3 балла**

### Клиентское приложение

- Реализовано клиентское приложение (Web) — **8 баллов**
- Реализована авторизация на клиенте (хранение и обновление токена) — **5 баллов**
- Интеграция всех API-методов — **7 баллов**
- Асинхронные вызовы API (async/await, обработка загрузки) — **3 балла**
- Обработка ошибок (401, 404, сетевые ошибки с UI-уведомлениями) — **3 балла**
- Реализована работа с файлами (загрузка, отображение, скачивание) — **4 балла**

## Опциональные задания

### Серверное приложение

- Реализована пагинация и фильтрация в API — **+2 балла**
- Использован паттерн Repository или Unit of Work — **+2 балла**
- Логирование запросов (Serilog/NLog) — **+1 балл**
- Microservices (минимум 3 сервиса) — **+10 баллов**
- Identity Server (вместо простого JWT) — **+4 балла**
- Кеширование данных (IMemoryCache/Redis) — **+3 балла**

### Клиентское приложение

- Реализовано несколько клиентских приложений на разных платформах — **+5 баллов**
- SignalR Real-time обновления — **+4 балла**
- Адаптивный дизайн (для веб/мобильного клиента) — **+2 балла**
- Валидация данных на клиенте — **+1 балл**
- Реализована пагинация на UI — **+1 балл**
- Другое (согласовать лично) — **+1–5 баллов**
