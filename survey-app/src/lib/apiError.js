export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export function toUserMessage(error) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Сессия истекла. Войдите снова.'
    }

    if (error.status === 404) {
      return 'Запрошенный ресурс не найден (404).'
    }

    return error.message || 'Ошибка запроса к API.'
  }

  if (error instanceof TypeError) {
    return 'Сетевая ошибка. Проверьте API URL и подключение.'
  }

  return 'Произошла непредвиденная ошибка.'
}
