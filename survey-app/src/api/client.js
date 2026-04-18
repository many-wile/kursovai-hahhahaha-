import { ENDPOINTS, API_BASE_URL } from './endpoints.js'
import { USE_MOCK_API, mockRequest } from './mockServer.js'
import { ApiError } from '../lib/apiError.js'
import { clearStoredTokens, getStoredTokens, saveStoredTokens } from '../lib/tokenStorage.js'

let refreshPromise = null

function joinUrl(path) {
  const base = API_BASE_URL.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

async function parseResponseBody(response) {
  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

function inferMessage(status, fallback) {
  if (status === 400) {
    return fallback || 'Некорректные данные запроса.'
  }

  if (status === 401) {
    return fallback || 'Требуется авторизация.'
  }

  if (status === 403) {
    return fallback || 'Недостаточно прав для выполнения операции.'
  }

  if (status === 404) {
    return fallback || 'Ресурс не найден.'
  }

  if (status >= 500) {
    return fallback || 'Ошибка сервера. Попробуйте позже.'
  }

  return fallback || 'Ошибка запроса.'
}

function getErrorMessage(payload) {
  if (!payload) {
    return ''
  }

  if (typeof payload === 'string') {
    return payload
  }

  if (typeof payload === 'object') {
    return payload.message || payload.error || payload.title || ''
  }

  return ''
}

async function executeHttp(path, { method, headers, body, expect, signal }) {
  if (USE_MOCK_API) {
    return mockRequest(path, {
      method,
      headers,
      body,
      expect,
      signal,
    })
  }

  const response = await fetch(joinUrl(path), {
    method,
    headers,
    body,
    signal,
  })

    console.log(`%c[API Request] ${method} ${path}`, 'color: #gold; font-weight: bold');
    console.log(`[Response Status] ${response.status}`);

  if (!response.ok) {
    const payload = await parseResponseBody(response)
    const message = inferMessage(response.status, getErrorMessage(payload))
    throw new ApiError(message, response.status, payload)
  }

  if (expect === 'blob') {
    return response.blob()
  }

  return parseResponseBody(response)
}

async function refreshTokens() {
  const tokens = getStoredTokens()

  if (!tokens.refreshToken) {
    return false
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const payload = await request(ENDPOINTS.authRefresh, {
          method: 'POST',
          auth: false,
          retryOnUnauthorized: false,
          body: { refreshToken: tokens.refreshToken },
        })

        const accessToken = payload?.accessToken || payload?.token || payload?.jwt || ''
        const refreshToken = payload?.refreshToken || tokens.refreshToken

        if (!accessToken) {
          clearStoredTokens()
          return false
        }

        saveStoredTokens({ accessToken, refreshToken })
        return true
      } catch {
        clearStoredTokens()
        return false
      } finally {
        refreshPromise = null
      }
    })()
  }

  return refreshPromise
}

export async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    auth = true,
    retryOnUnauthorized = true,
    expect = 'json',
    headers = {},
    signal,
  } = options

  const tokens = getStoredTokens()

  const finalHeaders = {
    ...headers,
  }

  let finalBody = body

  if (body && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = 'application/json'
    finalBody = JSON.stringify(body)
  }

  if (auth && tokens.accessToken) {
    finalHeaders.Authorization = `Bearer ${tokens.accessToken}`
  }

  try {
    return await executeHttp(path, {
      method,
      headers: finalHeaders,
      body: finalBody,
      expect,
      signal,
    })
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error
    }

    if (error.status === 401 && auth && retryOnUnauthorized) {
      const refreshed = await refreshTokens()

      if (refreshed) {
        return request(path, {
          ...options,
          retryOnUnauthorized: false,
        })
      }
    }

    throw error
  }
}
