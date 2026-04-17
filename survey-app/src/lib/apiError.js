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

    if (error.status === 405 || error.status === 501) {
      return 'Этот метод пока не реализован на backend.'
    }

    return error.message || 'Ошибка запроса к API.'
  }

  if (error instanceof TypeError) {
    return 'Сетевая ошибка. Проверьте запуск backend и frontend.'
  }

  return 'Произошла непредвиденная ошибка.'
}

